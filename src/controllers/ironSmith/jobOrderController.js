import { asyncHandler } from '../../utils/asyncHandler.js';
import Joi from 'joi';
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ironJobOrder } from '../../models/ironSmith/jobOrders.model.js';
import { ironCounter } from '../../models/ironSmith/ironCounter.model.js';
import QRCode from 'qrcode';
import { putObject } from '../../../util/putObject.js';
import { deleteObject } from '../../../util/deleteObject.js';
import { v4 as uuidv4 } from 'uuid';
import { ironWorkOrder } from '../../models/ironSmith/workOrder.model.js';
import { ironShape } from '../../models/ironSmith/helpers/ironShape.model.js';
import {ironDailyProduction} from '../../models/ironSmith/dailyProductionPlanning.js';


const createIronJobOrder_24_07_2025 = asyncHandler(async (req, res) => {
  // 1. Validation schema
  const productSchema = Joi.object({
    shape: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }, 'ObjectId validation'),
    planned_quantity: Joi.number().min(0).required().messages({
      'number.base': 'Planned quantity must be a number',
      'number.min': 'Planned quantity must be non-negative',
    }),
    schedule_date: Joi.date().required().messages({
      'date.base': 'Schedule date must be a valid date',
    }),
    dia: Joi.number().min(0).required().messages({
      'number.base': 'Diameter must be a number',
      'number.min': 'Diameter must be non-negative',
    }),
    selected_machines: Joi.array()
      .items(
        Joi.string().custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `Machine ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation')
      )
      .optional(),
  });

  const jobOrderSchema = Joi.object({
    work_order: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Work order ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }, 'ObjectId validation'),
    sales_order_number: Joi.string().optional().allow(''),
    date_range: Joi.object({
      from: Joi.date().required().messages({
        'date.base': 'Start date must be a valid date',
      }),
      to: Joi.date().required().messages({
        'date.base': 'End date must be a valid date',
      }),
    }).required(),
    products: Joi.array().items(productSchema).min(1).required().messages({
      'array.min': 'At least one product is required',
    }),
  });

  // 2. Parse form-data
  const bodyData = req.body;
  console.log("bodyData", bodyData);
  bodyData.products.map((p) => console.log("product", p))
  const userId = req.user?._id?.toString();
  console.log("userId", userId);

  // Validate userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(401, 'Invalid or missing user ID in request');
  }

  // 3. Parse stringified fields
  if (typeof bodyData.products === 'string') {
    try {
      bodyData.products = JSON.parse(bodyData.products);
    } catch (e) {
      throw new ApiError(400, 'Invalid products JSON format');
    }
  }

  // 4. Validate request body with Joi
  const { error, value } = jobOrderSchema.validate(bodyData, { abortEarly: false });
  if (error) {
    console.log("error", error);
    throw new ApiError(400, 'Validation failed for job order creation', error.details);
  }

  // 7. Generate job order number
  const counter = await ironCounter.findOneAndUpdate(
    { _id: 'job_order' },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  const jobOrderNumber = `JO-${String(counter.sequence_value).padStart(3, '0')}`;
  // 5. Prepare job order data with created_by and updated_by
  const jobOrderData = {
    ...value,
    job_order_number: jobOrderNumber,
    date_range: {
      from: value.date_range?.from ? new Date(value.date_range.from) : undefined,
      to: value.date_range?.to ? new Date(value.date_range.to) : undefined,
    },
    products: value.products.map((product) => ({
      ...product,
      schedule_date: product.schedule_date ? new Date(product.schedule_date) : undefined,
      selected_machines: product.selected_machines || [],
    })),
    created_by: userId,
    updated_by: userId,
  };

  // 6. Validate referenced documents
  const [workOrder, shapes] = await Promise.all([
    mongoose.model('ironWorkOrder').findById(value.work_order),
    Promise.all(value.products.map((p) => mongoose.model('ironShape').findById(p.shape))),
  ]);

  if (!workOrder) throw new ApiError(404, `Work order not found with ID: ${value.work_order}`);
  const invalidShape = shapes.findIndex((s) => !s);
  if (invalidShape !== -1) {
    throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shape}`);
  }

  // 7. Validate product-specific machines
  for (const product of value.products) {
    if (product.selected_machines && product.selected_machines.length) {
      const productMachines = await mongoose.model('ironMachine').find({ _id: { $in: product.selected_machines } });
      if (productMachines.length !== product.selected_machines.length) {
        throw new ApiError(404, `One or more machines not found for shape ID: ${product.shape}`);
      }
    }
  }



  // 8. Save to MongoDB
  const jobOrder = await ironJobOrder.create(jobOrderData);

  // 9. Populate and format response
  const populatedJobOrder = await mongoose
    .model('ironJobOrder')
    .findById(jobOrder._id)
    .populate({
      path: 'work_order',
      select: '_id po_quantity', // Include po_quantity for auto-fetch
    })
    .populate({
      path: 'products.shape',
      select: 'name uom', // Include uom for auto-fetch
    })
    .populate({
      path: 'products.selected_machines',
      select: 'name',
    })
    .populate({
      path: 'created_by',
      select: 'username email',
    })
    .populate({
      path: 'updated_by',
      select: 'username email',
    })
    .lean();

  if (!populatedJobOrder) {
    throw new ApiError(404, 'Failed to retrieve created job order');
  }

  // 10. Convert timestamps to IST
  const formatDateToIST = (data) => {
    const convertToIST = (date) => {
      if (!date) return null;
      return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    };
    return {
      ...data,
      date_range: {
        from: convertToIST(data.date_range.from),
        to: convertToIST(data.date_range.to),
      },
      createdAt: convertToIST(data.createdAt),
      updatedAt: convertToIST(data.updatedAt),
      products: data.products.map((p) => ({
        ...p,
        schedule_date: convertToIST(p.schedule_date),
      })),
    };
  };

  const formattedJobOrder = formatDateToIST(populatedJobOrder);

  return res.status(201).json(new ApiResponse(201, formattedJobOrder, 'Job order created successfully'));
});


const createIronJobOrder = asyncHandler(async (req, res) => {
  // 1. Validation schema
  const productSchema = Joi.object({
    shape: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }, 'ObjectId validation'),
    planned_quantity: Joi.number().min(0).required().messages({
      'number.base': 'Planned quantity must be a number',
      'number.min': 'Planned quantity must be non-negative',
    }),
    schedule_date: Joi.date().required().messages({
      'date.base': 'Schedule date must be a valid date',
    }),
    dia: Joi.number().min(0).required().messages({
      'number.base': 'Diameter must be a number',
      'number.min': 'Diameter must be non-negative',
    }),
    selected_machines: Joi.array()
      .items(
        Joi.string().custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `Machine ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation')
      )
      .optional(),
  });

  const jobOrderSchema = Joi.object({
    work_order: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Work order ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }, 'ObjectId validation'),
    sales_order_number: Joi.string().optional().allow(''),
    date_range: Joi.object({
      from: Joi.date().required().messages({
        'date.base': 'Start date must be a valid date',
      }),
      to: Joi.date().required().messages({
        'date.base': 'End date must be a valid date',
      }),
    }).required(),
    products: Joi.array().items(productSchema).min(1).required().messages({
      'array.min': 'At least one product is required',
    }),
  });

  // 2. Parse form-data
  const bodyData = req.body;
  console.log("bodyData", bodyData);
  bodyData.products.map((p) => console.log("product", p));
  const userId = req.user?._id?.toString();
  console.log("userId", userId);

  // Validate userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(401, 'Invalid or missing user ID in request');
  }

  // 3. Parse stringified fields
  if (typeof bodyData.products === 'string') {
    try {
      bodyData.products = JSON.parse(bodyData.products);
    } catch (e) {
      throw new ApiError(400, 'Invalid products JSON format');
    }
  }

  // 4. Validate request body with Joi
  const { error, value } = jobOrderSchema.validate(bodyData, { abortEarly: false });
  if (error) {
    console.log("error", error);
    throw new ApiError(400, 'Validation failed for job order creation', error.details);
  }

  // 5. Generate job order number
  const counter = await ironCounter.findOneAndUpdate(
    { _id: 'job_order' },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  const jobOrderNumber = `JO-${String(counter.sequence_value).padStart(3, '0')}`;

  // 6. Generate QR codes and upload to S3 for each product
  const productsWithQr = await Promise.all(
    value.products.map(async (product) => {
      // Generate unique ID for QR code content
      const qrCodeId = `${jobOrderNumber}-${uuidv4()}`;
      const qrContent = `joborder/${jobOrderNumber}/product/${qrCodeId}`; // URL to fetch product details

      // Generate QR code
      let qrCodeBuffer;
      try {
        qrCodeBuffer = await QRCode.toBuffer(qrContent, {
          type: 'png',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 200,
        });
      } catch (error) {
        throw new ApiError(500, `Failed to generate QR code for ${qrCodeId}: ${error.message}`);
      }

      // Upload QR code to S3
      const fileName = `qr-codes/${qrCodeId}-${Date.now()}.png`;
      const file = {
        data: qrCodeBuffer,
        mimetype: 'image/png',
      };
      let qrCodeUrl;
      try {
        const { url } = await putObject(file, fileName);
        qrCodeUrl = url;
      } catch (error) {
        throw new ApiError(500, `Failed to upload QR code to S3 for ${qrCodeId}: ${error.message}`);
      }

      return {
        ...product,
        qr_code_id: qrCodeId, // Store for reference
        qr_code_url: qrCodeUrl,
        schedule_date: product.schedule_date ? new Date(product.schedule_date) : undefined,
        selected_machines: product.selected_machines || [],
      };
    })
  );

  // 7. Prepare job order data with created_by and updated_by
  const jobOrderData = {
    ...value,
    job_order_number: jobOrderNumber,
    date_range: {
      from: value.date_range?.from ? new Date(value.date_range.from) : undefined,
      to: value.date_range?.to ? new Date(value.date_range.to) : undefined,
    },
    products: productsWithQr,
    created_by: userId,
    updated_by: userId,
  };

  // 8. Validate referenced documents
  const [workOrder, shapes] = await Promise.all([
    mongoose.model('ironWorkOrder').findById(value.work_order),
    Promise.all(value.products.map((p) => mongoose.model('ironShape').findById(p.shape))),
  ]);

  if (!workOrder) throw new ApiError(404, `Work order not found with ID: ${value.work_order}`);
  const invalidShape = shapes.findIndex((s) => !s);
  if (invalidShape !== -1) {
    throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shape}`);
  }

  // 9. Validate product-specific machines
  for (const product of value.products) {
    if (product.selected_machines && product.selected_machines.length) {
      const productMachines = await mongoose.model('ironMachine').find({ _id: { $in: product.selected_machines } });
      if (productMachines.length !== product.selected_machines.length) {
        throw new ApiError(404, `One or more machines not found for shape ID: ${product.shape}`);
      }
    }
  }

  // 10. Save to MongoDB
  const jobOrder = await ironJobOrder.create(jobOrderData);




// Check for existing production
const existingProduction = await ironDailyProduction.findOne({
  job_order: jobOrder._id,
  status: 'In Progress',
});
if (existingProduction) {
  throw new ApiError(400, 'Production is already in progress for this job order');
}

// Create production records
const dailyProductionPromises = jobOrderData.products.map(async (product) => {
  const schemaProduct = {
    shape_id: product.shape,
    planned_quantity: product.planned_quantity,
    achieved_quantity: 0,
    rejected_quantity: 0,
    recycled_quantity: 0,
    machines: product.selected_machines || [],
  };

  const newProduction = new ironDailyProduction({
    work_order: jobOrderData.work_order,
    job_order: jobOrder._id,
    products: [schemaProduct],
    date: new Date(product.schedule_date),
    submitted_by: userId,
    created_by: userId,
    updated_by: userId,
    status: 'Pending',
  });

  return newProduction.save();
});

const savedProductions = await Promise.all(dailyProductionPromises);






  // 11. Populate and format response
  const populatedJobOrder = await mongoose
    .model('ironJobOrder')
    .findById(jobOrder._id)
    .populate({
      path: 'work_order',
      select: '_id po_quantity',
    })
    .populate({
      path: 'products.shape',
      select: 'name uom',
    })
    .populate({
      path: 'products.selected_machines',
      select: 'name',
    })
    .populate({
      path: 'created_by',
      select: 'username email',
    })
    .populate({
      path: 'updated_by',
      select: 'username email',
    })
    .lean();

  if (!populatedJobOrder) {
    throw new ApiError(404, 'Failed to retrieve created job order');
  }

  // 12. Convert timestamps to IST
  const formatDateToIST = (data) => {
    const convertToIST = (date) => {
      if (!date) return null;
      return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    };
    return {
      ...data,
      date_range: {
        from: convertToIST(data.date_range.from),
        to: convertToIST(data.date_range.to),
      },
      createdAt: convertToIST(data.createdAt),
      updatedAt: convertToIST(data.updatedAt),
      products: data.products.map((p) => ({
        ...p,
        schedule_date: convertToIST(p.schedule_date),
      })),
    };
  };

  const formattedJobOrder = formatDateToIST(populatedJobOrder);

  return res.status(201).json(new ApiResponse(201, formattedJobOrder, 'Job order created successfully'));
});

  const getAllIronJobOrders = asyncHandler(async (req, res) => {
    // 1. Query all job orders with population
    const jobOrders = await ironJobOrder
      .find({})
      .populate({
        path: 'work_order',
        select: '_id workOrderNumber projectId clientId',
        populate: [
          {
            path: 'projectId',
            model: 'ironProject',
            select: '_id name',
            // match: { isDeleted: false }, // Exclude soft-deleted projects
          },
          {
            path: 'clientId',
            model: 'ironClient',
            select: '_id name',
            // match: { isDeleted: false }, // Exclude soft-deleted clients
          },
        ],
      })
      .lean();
      console.log("jobOrders",jobOrders);

    // 2. Filter out job orders with missing project or client (due to isDeleted: true)
    const filteredJobOrders = jobOrders.filter(
      (jobOrder) => jobOrder.work_order?.projectId && jobOrder.work_order?.clientId
    );

    if (!filteredJobOrders.length) {
      throw new ApiError(404, 'No job orders found with valid project and client');
    }
    // filteredJobOrders.map((jobOrder) => {console.log("jobOrder",jobOrder)})
    // 3. Format the response to include only requested fields
    const formattedJobOrders = filteredJobOrders.map((jobOrder) => ({
        _id: jobOrder._id,
      job_order_number: jobOrder.job_order_number,
      work_order: {
        _id: jobOrder.work_order._id,
        workOrderNumber: jobOrder.work_order.workOrderNumber,
      },
      project: {
        _id: jobOrder.work_order.projectId._id,
        name: jobOrder.work_order.projectId.name,
      },
      client: {
        _id: jobOrder.work_order.clientId._id,
        name: jobOrder.work_order.clientId.name,
      },
      createdAt: jobOrder.createdAt, // Pass raw timestamps to formatDateToIST
      updatedAt: jobOrder.updatedAt,
    }));

    // 4. Convert timestamps to IST
    const formatDateToIST = (data) => {
      const convertToIST = (date) => {
        if (!date) return null;
        return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      };
      return data.map((item) => ({
        ...item,
        createdAt: convertToIST(item.createdAt),
        updatedAt: convertToIST(item.updatedAt),
      }));
    };

    const responseData = formatDateToIST(formattedJobOrders);

    return res.status(200).json(new ApiResponse(200, responseData, 'Job orders retrieved successfully'));
  });




// const getAllIronJobOrders = asyncHandler(async (req, res) => {
//   // 1. Parse pagination parameters
//   const page = parseInt(req.query.page) || 1;
//   console.log("page", page);
//   const limit = parseInt(req.query.limit) || 10;
//   console.log("limit", limit);
//   const skip = (page - 1) * limit;

//   // 2. Count total job orders that meet the criteria
//   const totalJobOrders = await ironJobOrder
//     .find({})
//     .populate({
//       path: 'work_order',
//       select: '_id projectId clientId',
//       populate: [
//         {
//           path: 'projectId',
//           model: 'ironProject',
//           select: '_id',
//           match: { isDeleted: false },
//         },
//         {
//           path: 'clientId',
//           model: 'ironClient',
//           select: '_id',
//           match: { isDeleted: false },
//         },
//       ],
//     })
//     .then(jobOrders => jobOrders.filter(jobOrder => jobOrder.work_order?.projectId && jobOrder.work_order?.clientId).length);

//   // 3. Query job orders with population and pagination
//   const jobOrders = await ironJobOrder
//     .find({})
//     .populate({
//       path: 'work_order',
//       select: '_id workOrderNumber projectId clientId',
//       populate: [
//         {
//           path: 'projectId',
//           model: 'ironProject',
//           select: '_id name',
//           match: { isDeleted: false },
//         },
//         {
//           path: 'clientId',
//           model: 'ironClient',
//           select: '_id name',
//           match: { isDeleted: false },
//         },
//       ],
//     })
//     .skip(skip)
//     .limit(limit)
//     .sort({ createdAt: -1 })
//     .lean();

//   // 4. Filter out job orders with missing project or client
//   const filteredJobOrders = jobOrders.filter(
//     (jobOrder) => jobOrder.work_order?.projectId && jobOrder.work_order?.clientId
//   );

//   if (!filteredJobOrders.length) {
//     throw new ApiError(404, 'No job orders found with valid project and client');
//   }

//   // 5. Format the response to include only requested fields
//   const formattedJobOrders = filteredJobOrders.map((jobOrder) => ({
//     _id: jobOrder._id,
//     job_order_number: jobOrder.job_order_number,
//     work_order: {
//       _id: jobOrder.work_order._id,
//       workOrderNumber: jobOrder.work_order.workOrderNumber,
//     },
//     project: {
//       _id: jobOrder.work_order.projectId._id,
//       name: jobOrder.work_order.projectId.name,
//     },
//     client: {
//       _id: jobOrder.work_order.clientId._id,
//       name: jobOrder.work_order.clientId.name,
//     },
//     createdAt: jobOrder.createdAt,
//     updatedAt: jobOrder.updatedAt,
//   }));

//   // 6. Convert timestamps to IST
//   const formatDateToIST = (data) => {
//     const convertToIST = (date) => {
//       if (!date) return null;
//       return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
//     };
//     return data.map((item) => ({
//       ...item,
//       createdAt: convertToIST(item.createdAt),
//       updatedAt: convertToIST(item.updatedAt),
//     }));
//   };

//   const formattedData = formatDateToIST(formattedJobOrders);

//   // 7. Return response with pagination
//   return res.status(200).json(new ApiResponse(200, {
//     jobOrders: formattedData,
//     pagination: {
//       total: totalJobOrders,
//       page,
//       limit,
//       totalPages: Math.ceil(totalJobOrders / limit),
//     },
//   }, 'Job orders fetched successfully'));
// });



const updateIronJobOrder_28_07_2025 = asyncHandler(async (req, res) => {
  // 1. Validation schema (all fields optional for partial updates)
  const productSchema = Joi.object({
    shape: Joi.string()
      .optional()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }, 'ObjectId validation'),
    planned_quantity: Joi.number().min(0).optional().messages({
      'number.base': 'Planned quantity must be a number',
      'number.min': 'Planned quantity must be non-negative',
    }),
    schedule_date: Joi.date().optional().messages({
      'date.base': 'Schedule date must be a valid date',
    }),
    dia: Joi.number().min(0).optional().messages({
      'number.base': 'Diameter must be a number',
      'number.min': 'Diameter must be non-negative',
    }),
    selected_machines: Joi.array()
      .items(
        Joi.string().custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `Machine ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation')
      )
      .optional(),
  });

  const jobOrderSchema = Joi.object({
    work_order: Joi.string()
      .optional()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Work order ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }, 'ObjectId validation'),
    sales_order_number: Joi.string().optional().allow(''),
    date_range: Joi.object({
      from: Joi.date().optional().messages({
        'date.base': 'Start date must be a valid date',
      }),
      to: Joi.date().optional().messages({
        'date.base': 'End date must be a valid date',
      }),
    }).optional(),
    products: Joi.array().items(productSchema).min(1).optional().messages({
      'array.min': 'At least one product is required if products array is provided',
    }),
  });

  // 2. Parse form-data
  const bodyData = req.body;
  const userId = req.user?._id?.toString();
  const jobOrderId = req.params.id;

  // Validate jobOrderId
  if (!mongoose.Types.ObjectId.isValid(jobOrderId)) {
    throw new ApiError(400, `Invalid job order ID: ${jobOrderId}`);
  }

  // Validate userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(401, 'Invalid or missing user ID in request');
  }

  // 3. Parse stringified fields
  if (typeof bodyData.products === 'string') {
    try {
      bodyData.products = JSON.parse(bodyData.products);
    } catch (e) {
      throw new ApiError(400, 'Invalid products JSON format');
    }
  }

  // 4. Validate request body with Joi
  const { error, value } = jobOrderSchema.validate(bodyData, { abortEarly: false });
  if (error) {
    throw new ApiError(400, 'Validation failed for job order update', error.details);
  }

  // 5. Check if job order exists
  const existingJobOrder = await ironJobOrder.findById(jobOrderId);
  if (!existingJobOrder) {
    throw new ApiError(404, `Job order not found with ID: ${jobOrderId}`);
  }

  // 6. Validate referenced documents if provided
  if (value.work_order) {
    const workOrder = await mongoose.model('ironWorkOrder').findById(value.work_order);
    if (!workOrder) throw new ApiError(404, `Work order not found with ID: ${value.work_order}`);
  }

  if (value.products) {
    const shapes = await Promise.all(
      value.products.map((p) => mongoose.model('ironShape').findById(p.shape))
    );
    const invalidShape = shapes.findIndex((s) => !s);
    if (invalidShape !== -1) {
      throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shape}`);
    }

    for (const product of value.products) {
      if (product.selected_machines && product.selected_machines.length) {
        const productMachines = await mongoose.model('ironMachine').find({ _id: { $in: product.selected_machines } });
        if (productMachines.length !== product.selected_machines.length) {
          throw new ApiError(404, `One or more machines not found for shape ID: ${product.shape}`);
        }
      }
    }
  }

  // 7. Prepare update data
  const updateData = {
    ...(value.work_order && { work_order: value.work_order }),
    ...(value.sales_order_number !== undefined && { sales_order_number: value.sales_order_number }),
    ...(value.date_range && {
      date_range: {
        from: value.date_range.from ? new Date(value.date_range.from) : existingJobOrder.date_range.from,
        to: value.date_range.to ? new Date(value.date_range.to) : existingJobOrder.date_range.to,
      },
    }),
    ...(value.products && {
      products: value.products.map((product) => ({
        shape: product.shape || undefined,
        planned_quantity: product.planned_quantity ?? undefined,
        schedule_date: product.schedule_date ? new Date(product.schedule_date) : undefined,
        dia: product.dia ?? undefined,
        selected_machines: product.selected_machines || [],
      })),
    }),
    updated_by: userId,
    updatedAt: new Date(),
  };

  // 8. Update job order in MongoDB
  const updatedJobOrder = await ironJobOrder
    .findByIdAndUpdate(jobOrderId, { $set: updateData }, { new: true })
    .populate({
      path: 'work_order',
      select: '_id po_quantity',
    })
    .populate({
      path: 'products.shape',
      select: 'name uom',
    })
    .populate({
      path: 'products.selected_machines',
      select: 'name',
    })
    .populate({
      path: 'created_by',
      select: 'username email',
    })
    .populate({
      path: 'updated_by',
      select: 'username email',
    })
    .lean();

  if (!updatedJobOrder) {
    throw new ApiError(404, 'Failed to retrieve updated job order');
  }

  // 9. Convert timestamps to IST
  const formatDateToIST = (data) => {
    const convertToIST = (date) => {
      if (!date) return null;
      return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    };
    return {
      ...data,
      date_range: {
        from: convertToIST(data.date_range.from),
        to: convertToIST(data.date_range.to),
      },
      createdAt: convertToIST(data.createdAt),
      updatedAt: convertToIST(data.updatedAt),
      products: data.products.map((p) => ({
        ...p,
        schedule_date: convertToIST(p.schedule_date),
      })),
    };
  };

  const formattedJobOrder = formatDateToIST(updatedJobOrder);

  return res.status(200).json(new ApiResponse(200, formattedJobOrder, 'Job order updated successfully'));
});


const updateIronJobOrder = asyncHandler(async (req, res) => {
  const productSchema = Joi.object({
    _id: Joi.string().optional(), // include _id to identify existing products
    shape: Joi.string()
      .optional()
      .custom((value, helpers) => {
        if (value && !mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
        }
        return value;
      }),
    planned_quantity: Joi.number().min(0).optional(),
    schedule_date: Joi.date().optional(),
    dia: Joi.number().min(0).optional(),
    selected_machines: Joi.array().items(
      Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid', { message: `Machine ID (${value}) is not a valid ObjectId` });
        }
        return value;
      })
    ).optional(),
  });

  const jobOrderSchema = Joi.object({
    work_order: Joi.string().optional(),
    sales_order_number: Joi.string().optional().allow(''),
    date_range: Joi.object({
      from: Joi.date().optional(),
      to: Joi.date().optional(),
    }).optional(),
    products: Joi.array().items(productSchema).optional(),
  });

  const bodyData = req.body;
  const userId = req.user?._id?.toString();
  const jobOrderId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(jobOrderId)) {
    throw new ApiError(400, `Invalid job order ID: ${jobOrderId}`);
  }
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(401, 'Invalid or missing user ID in request');
  }

  if (typeof bodyData.products === 'string') {
    try {
      bodyData.products = JSON.parse(bodyData.products);
    } catch {
      throw new ApiError(400, 'Invalid products JSON format');
    }
  }

  const { error, value } = jobOrderSchema.validate(bodyData, { abortEarly: false });
  if (error) throw new ApiError(400, 'Validation failed for job order update', error.details);

  // Fetch existing Job Order
  const existingJobOrder = await ironJobOrder.findById(jobOrderId);
  if (!existingJobOrder) throw new ApiError(404, `Job order not found with ID: ${jobOrderId}`);

  // Validate work_order if updated
  if (value.work_order) {
    const workOrder = await mongoose.model('ironWorkOrder').findById(value.work_order);
    if (!workOrder) throw new ApiError(404, `Work order not found with ID: ${value.work_order}`);
  }

  let updatedProducts = existingJobOrder.products;

  if (value.products) {
    updatedProducts = await Promise.all(
      value.products.map(async (product) => {
        let existingProduct = null;

        // Find if product exists in DB (match by _id)
        if (product._id) {
          existingProduct = existingJobOrder.products.find(
            (p) => p._id.toString() === product._id
          );
        }

        if (existingProduct) {
          // ✅ Merge existing QR code fields
          return {
            ...existingProduct.toObject(),
            shape: product.shape || existingProduct.shape,
            planned_quantity: product.planned_quantity ?? existingProduct.planned_quantity,
            schedule_date: product.schedule_date ? new Date(product.schedule_date) : existingProduct.schedule_date,
            dia: product.dia ?? existingProduct.dia,
            selected_machines: product.selected_machines || existingProduct.selected_machines,
            qr_code_id: existingProduct.qr_code_id,
            qr_code_url: existingProduct.qr_code_url,
          };
        } else {
          // ✅ New product → generate QR code
          const qrCodeId = `${existingJobOrder.job_order_number}-${uuidv4()}`;
          const qrContent = `joborder/${existingJobOrder.job_order_number}/product/${qrCodeId}`;

          let qrCodeBuffer;
          try {
            qrCodeBuffer = await QRCode.toBuffer(qrContent, {
              type: 'png',
              errorCorrectionLevel: 'H',
              margin: 1,
              width: 200,
            });
          } catch (error) {
            throw new ApiError(500, `Failed to generate QR code for new product: ${error.message}`);
          }

          const fileName = `qr-codes/${qrCodeId}-${Date.now()}.png`;
          let qrCodeUrl;
          try {
            const { url } = await putObject(
              { data: qrCodeBuffer, mimetype: 'image/png' },
              fileName
            );
            qrCodeUrl = url;
          } catch (error) {
            throw new ApiError(500, `Failed to upload QR code: ${error.message}`);
          }

          return {
            shape: product.shape,
            planned_quantity: product.planned_quantity,
            schedule_date: new Date(product.schedule_date),
            dia: product.dia,
            selected_machines: product.selected_machines || [],
            qr_code_id: qrCodeId,
            qr_code_url: qrCodeUrl,
            achieved_quantity: 0,
            rejected_quantity: 0,
          };
        }
      })
    );
  }

  // Prepare update object
  const updateData = {
    ...(value.work_order && { work_order: value.work_order }),
    ...(value.sales_order_number !== undefined && { sales_order_number: value.sales_order_number }),
    ...(value.date_range && {
      date_range: {
        from: value.date_range.from ? new Date(value.date_range.from) : existingJobOrder.date_range.from,
        to: value.date_range.to ? new Date(value.date_range.to) : existingJobOrder.date_range.to,
      },
    }),
    products: updatedProducts,
    updated_by: userId,
    updatedAt: new Date(),
  };

  // Update in DB
  const updatedJobOrder = await ironJobOrder
    .findByIdAndUpdate(jobOrderId, { $set: updateData }, { new: true })
    .populate('work_order', '_id po_quantity')
    .populate('products.shape', 'name uom')
    .populate('products.selected_machines', 'name')
    .populate('created_by', 'username email')
    .populate('updated_by', 'username email')
    .lean();

  if (!updatedJobOrder) throw new ApiError(404, 'Failed to retrieve updated job order');

  const formatDateToIST = (data) => {
    const convertToIST = (date) =>
      date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null;

    return {
      ...data,
      date_range: {
        from: convertToIST(data.date_range.from),
        to: convertToIST(data.date_range.to),
      },
      createdAt: convertToIST(data.createdAt),
      updatedAt: convertToIST(data.updatedAt),
      products: data.products.map((p) => ({
        ...p,
        schedule_date: convertToIST(p.schedule_date),
      })),
    };
  };

  return res
    .status(200)
    .json(new ApiResponse(200, formatDateToIST(updatedJobOrder), 'Job order updated successfully'));
});


const getProductDetailsByQrCode = asyncHandler(async (req, res) => {
  const { jobOrderNumber, qrCodeId } = req.params;

  // 1. Find the job order by job_order_number
  const jobOrder = await mongoose
    .model('ironJobOrder')
    .findOne({ job_order_number: jobOrderNumber })
    .populate({
      path: 'work_order',
      select: '_id po_quantity',
    })
    .populate({
      path: 'products.shape',
      select: 'name uom',
    })
    .populate({
      path: 'products.selected_machines',
      select: 'name',
    })
    .lean();

  if (!jobOrder) {
    throw new ApiError(404, `Job order not found with number: ${jobOrderNumber}`);
  }

  // 2. Find the product by qr_code_id
  const product = jobOrder.products.find((p) => p.qr_code_id === qrCodeId);
  if (!product) {
    throw new ApiError(404, `Product not found with QR code ID: ${qrCodeId}`);
  }

  // 3. Format dates to IST
  const convertToIST = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  const formattedProduct = {
    ...product,
    schedule_date: convertToIST(product.schedule_date),
    job_order_number: jobOrder.job_order_number,
    work_order: jobOrder.work_order,
    status: jobOrder.status,
  };

  return res.status(200).json(new ApiResponse(200, formattedProduct, 'Product details retrieved successfully'));
});


const getJobOrderById_27_07_2025 = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Validate job order ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid job order ID: ${id}`);
  }

  // 2. Find the job order and populate related fields
  const jobOrder = await mongoose
    .model('ironJobOrder')
    .findById(id)
    .populate({
      path: 'work_order',
      select: '_id po_quantity',
    })
    .populate({
      path: 'products.shape',
      select: 'name uom',
    })
    .populate({
      path: 'products.selected_machines',
      select: 'name',
    })
    .populate({
      path: 'created_by',
      select: 'username email',
    })
    .populate({
      path: 'updated_by',
      select: 'username email',
    })
    .lean();

  if (!jobOrder) {
    throw new ApiError(404, `Job order not found with ID: ${id}`);
  }

  // 3. Format dates to IST
  const convertToIST = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  const formattedJobOrder = {
    ...jobOrder,
    date_range: {
      from: convertToIST(jobOrder.date_range.from),
      to: convertToIST(jobOrder.date_range.to),
    },
    createdAt: convertToIST(jobOrder.createdAt),
    updatedAt: convertToIST(jobOrder.updatedAt),
    products: jobOrder.products.map((product) => ({
      ...product,
      schedule_date: convertToIST(product.schedule_date),
    })),
  };

  return res.status(200).json(new ApiResponse(200, formattedJobOrder, 'Job order retrieved successfully'));
});

const getJobOrderById1 = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Validate job order ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid job order ID: ${id}`);
  }

  // 2. Find the job order and populate related fields
  const jobOrder = await mongoose
    .model('ironJobOrder')
    .findById(id)
    .populate({
      path: 'work_order',
      select: '_id workOrderNumber',
      populate: {
        path: 'products.shapeId',
        select: '_id',
      },
    })
    .populate({
      path: 'products.shape',
      select: 'name uom shape_code',
    })
    .populate({
      path: 'products.selected_machines',
      select: '_id name',
    })
    .populate({
      path: 'created_by',
      select: 'username email',
    })
    .populate({
      path: 'updated_by',
      select: 'username email',
    })
    .lean();
  console.log("jobOrder", jobOrder);

  if (!jobOrder) {
    throw new ApiError(404, `Job order not found with ID: ${id}`);
  }

  // 3. Format dates to IST
  const convertToIST = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  // 4. Map PO quantity to products based on shape relationship
  const formattedJobOrder = {
    ...jobOrder,
    workOrderId: jobOrder.work_order._id,
    workOrderNumber: jobOrder.work_order.workOrderNumber,
    date_range: {
      from: convertToIST(jobOrder.date_range.from),
      to: convertToIST(jobOrder.date_range.to),
    },
    createdAt: convertToIST(jobOrder.createdAt),
    updatedAt: convertToIST(jobOrder.updatedAt),
    products: jobOrder.products.map((product) => {
      const workOrderProduct = jobOrder.work_order.products.find(
        (wp) => wp.shapeId && wp.shapeId._id && product.shape._id && wp.shapeId._id.toString() === product.shape._id.toString()
      );
      console.log("workOrderProduct", workOrderProduct);
      console.log("product", product);
      return {
        _id: product._id,
        shape_id: product.shape._id,
        shape_code: product.shape.shape_code,
        uom: product.shape.uom,
        planned_quantity: product.planned_quantity,
        schedule_date: convertToIST(product.schedule_date),
        dia: product.dia,
        achieved_quantity: product.achieved_quantity,
        rejected_quantity: product.rejected_quantity,
        selected_machines: product.selected_machines.map((machine) => ({
          _id: machine._id,
          name: machine.name,
        })),
        qr_code_id: product.qr_code_id,
        qr_code_url: product.qr_code_url,
        po_quantity: workOrderProduct ? workOrderProduct.quantity : 0,
      };
    }),
  };

  // Remove only the unnecessary nested fields
  delete formattedJobOrder.work_order;
  formattedJobOrder.products.forEach((p) => {
    delete p.shape; // Remove the nested shape object
  });

  return res.status(200).json(new ApiResponse(200, formattedJobOrder, 'Job order retrieved successfully'));
});
const getJobOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Validate job order ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid job order ID: ${id}`);
  }

  // 2. Find the job order and populate related fields
  const jobOrder = await mongoose
    .model('ironJobOrder')
    .findById(id)
    .populate({
      path: 'work_order',
      select: '_id workOrderNumber',
      populate: {
        path: 'products', // Populate the entire products array, including quantity
        select: 'shapeId quantity', // Include shapeId and quantity
      },
    })
    .populate({
      path: 'products.shape',
      select: 'name uom shape_code', // Include uom and shape_code
    })
    .populate({
      path: 'products.selected_machines',
      select: '_id name',
    })
    .populate({
      path: 'created_by',
      select: 'username email',
    })
    .populate({
      path: 'updated_by',
      select: 'username email',
    })
    .lean();
  console.log("jobOrder", jobOrder);

  if (!jobOrder) {
    throw new ApiError(404, `Job order not found with ID: ${id}`);
  }

  // 3. Format dates to IST
  const convertToIST = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  // 4. Map PO quantity and uom to products based on shape relationship
  const formattedJobOrder = {
    ...jobOrder,
    workOrderId: jobOrder.work_order._id,
    workOrderNumber: jobOrder.work_order.workOrderNumber,
    date_range: {
      from: convertToIST(jobOrder.date_range.from),
      to: convertToIST(jobOrder.date_range.to),
    },
    createdAt: convertToIST(jobOrder.createdAt),
    updatedAt: convertToIST(jobOrder.updatedAt),
    products: jobOrder.products.map((product) => {
      const workOrderProduct = jobOrder.work_order.products.find(
        (wp) => wp.shapeId && wp.shapeId._id && product.shape._id && wp.shapeId._id.toString() === product.shape._id.toString()
      );
      console.log("workOrderProduct", workOrderProduct); // Debug log
      console.log("product", product); // Debug log
      return {
        _id: product._id,
        shape_id: product.shape._id,
        shape_code: product.shape.shape_code,
        uom: workOrderProduct.uom, // Add uom from shape
        planned_quantity: product.planned_quantity,
        schedule_date: convertToIST(product.schedule_date),
        dia: product.dia,
        achieved_quantity: product.achieved_quantity,
        rejected_quantity: product.rejected_quantity,
        selected_machines: product.selected_machines.map((machine) => ({
          _id: machine._id,
          name: machine.name,
        })),
        qr_code_id: product.qr_code_id,
        qr_code_url: product.qr_code_url,
        po_quantity: workOrderProduct ? workOrderProduct.quantity : 0, // Map po_quantity from quantity
      };
    }),
  };

  // Remove only the unnecessary nested fields
  delete formattedJobOrder.work_order;
  formattedJobOrder.products.forEach((p) => {
    delete p.shape; // Remove the nested shape object
  });

  return res.status(200).json(new ApiResponse(200, formattedJobOrder, 'Job order retrieved successfully'));
});

const deleteIronJobOrder = asyncHandler(async (req, res) => {
  let ids = req.body.ids;
  console.log('ids', ids);

  // 1. Validate input
  if (!ids) {
    return res.status(400).json(new ApiResponse(400, null, 'No IDs provided'));
  }

  // 2. Convert single ID to array if needed
  if (!Array.isArray(ids)) {
    ids = [ids];
  }

  // 3. Check for empty array
  if (ids.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, 'IDs array cannot be empty'));
  }

  // 4. Validate MongoDB ObjectIds
  const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
  }

  try {
    // 5. Find job orders to collect QR code URLs
    const jobOrders = await ironJobOrder.find({ _id: { $in: ids } });

    // 6. Collect all QR code URLs to delete from S3
    const fileKeys = jobOrders.flatMap(jobOrder =>
      jobOrder.products.map(product => {
        if (product.qr_code_url) {
          const urlParts = product.qr_code_url.split('/');
          return urlParts.slice(3).join('/'); // Extract the key part after the bucket name
        }
        return null;
      }).filter(key => key) // Remove null entries
    );

    // 7. Delete QR code images from S3
    await Promise.all(fileKeys.map(key => deleteObject(key)));

    // 8. Permanent deletion of job orders
    const result = await ironJobOrder.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json(new ApiResponse(404, null, 'No job orders found to delete'));
    }

    return res.status(200).json(new ApiResponse(200, {
      deletedCount: result.deletedCount,
      deletedIds: ids
    }, `${result.deletedCount} job order(s) deleted successfully`));
  } catch (error) {
    console.log('Error:', error);
    return res.status(500).json(new ApiResponse(500, null, `Error deleting job orders: ${error.message}`));
  }
});

const workOrderData = asyncHandler(async (req, res) => {
  // 1. Extract workOrderId from request parameters
  const { workOrderId } = req.params;

  // 2. Validate workOrderId
  if (!workOrderId || !mongoose.Types.ObjectId.isValid(workOrderId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid or missing workOrderId'));
  }

  try {
    // 3. Fetch the work order with populated client, project, and shape
    const workOrder = await ironWorkOrder
      .findById(workOrderId)
      .populate('clientId', 'name address') // Populate client details
      .populate('projectId', 'name address client') // Populate project details, including client reference
      .lean();

    if (!workOrder) {
      return res.status(404).json(new ApiResponse(404, null, 'Work order not found'));
    }

    // 4. Fetch job orders related to this work order
    const jobOrders = await ironJobOrder
      .find({ work_order: workOrderId })
      .populate('products.shape', 'name') // Populate shape details if needed
      .lean();

    // 5. Fetch shape details for all shapeIds in workOrder.products
    const shapeIds = workOrder.products.map(product => product.shapeId);
    const shapes = await ironShape
      .find({ _id: { $in: shapeIds } })
      .select('shape_code') // Changed to select shape_code instead of description
      .lean();

    // Create a map of shapeId to shape_code for quick lookup
    const shapeMap = shapes.reduce((map, shape) => {
      map[shape._id.toString()] = shape.shape_code;
      return map;
    }, {});

    // 6. Map work order products with job order data and shape name
    const enrichedProducts = workOrder.products.map((workProduct) => {
      const matchingJobProducts = jobOrders.flatMap((jobOrder) =>
        jobOrder.products.filter((jobProduct) => jobProduct.shape.toString() === workProduct.shapeId.toString())
      );

      // Aggregate achieved and rejected quantities
      const achievedQuantity = matchingJobProducts.reduce((sum, jobProduct) => sum + jobProduct.achieved_quantity, 0);
      const rejectedQuantity = matchingJobProducts.reduce((sum, jobProduct) => sum + jobProduct.rejected_quantity, 0);

      return {
        shapeId: workProduct.shapeId,
        shapeName: shapeMap[workProduct.shapeId.toString()] || 'Unknown', // Use shape_code as shapeName
        uom: workProduct.uom,
        poQuantity: workProduct.quantity,
        achievedQuantity,
        rejectedQuantity,
        deliveryDate: workProduct.deliveryDate,
        barMark: workProduct.barMark,
        memberDetails: workProduct.memberDetails,
        memberQuantity: workProduct.memberQuantity,
        diameter: workProduct.diameter,
        weight: workProduct.weight,
        dimensions: workProduct.dimensions,
      };
    });

    // 7. Prepare the response
    const responseData = {
      workOrderId: workOrder._id,
      workOrderNumber: workOrder.workOrderNumber,
      workOrderDate: workOrder.workOrderDate,
      client: workOrder.clientId,
      project: workOrder.projectId,
      products: enrichedProducts,
      status: workOrder.status,
      files: workOrder.files,
    };

    return res.status(200).json(new ApiResponse(200, responseData, 'Work order data retrieved successfully'));
  } catch (error) {
    console.error('Error fetching work order data:', error);
    return res.status(500).json(new ApiResponse(500, null, `Error fetching work order data: ${error.message}`));
  }
});

export { createIronJobOrder, getAllIronJobOrders, updateIronJobOrder, getProductDetailsByQrCode, getJobOrderById, deleteIronJobOrder, workOrderData };