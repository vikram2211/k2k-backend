import { Product } from '../../models/konkreteKlinkers/product.model.js';
import { z } from 'zod';
import { JobOrder } from '../../models/konkreteKlinkers/jobOrders.model.js';
import { Counter } from '../../models/konkreteKlinkers/counter.model.js';
import mongoose from 'mongoose';
import { WorkOrder } from '../../models/konkreteKlinkers/workOrder.model.js';
import { Plant } from '../../models/konkreteKlinkers/helpers/plant.model.js';
import { Machine } from '../../models/konkreteKlinkers/helpers/machine.model.js';
import { DailyProduction } from "../../models/konkreteKlinkers/dailyProductionPlanning.js";
import { ApiError } from '../../utils/ApiError.js';



// Helper for MongoDB ObjectId validation
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");


// ✅ Helper: Convert any valid format to ISO string (YYYY-MM-DD)
function normalizeDate(input) {
  if (typeof input === 'string') {
    // Try built-in parser
    let parsed = new Date(input);
    if (!isNaN(parsed)) return parsed;

    // Try DD/MM/YYYY manually
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
      const [day, month, year] = input.split('/');
      parsed = new Date(`${year}-${month}-${day}`);
      if (!isNaN(parsed)) return parsed;
    }

    throw new Error(`Invalid date format: ${input}`);
  }

  if (input instanceof Date && !isNaN(input)) {
    return input;
  }

  throw new Error(`Invalid date type: ${input}`);
}


// Zod schema for date range (from/to)
const dateRangeSchema = z.object({
  from: dateStringSchema, // Accepts ISO strings or Date objects
  to: dateStringSchema
}).refine(
  (data) => data.to >= data.from,
  "End date must be after start date"
);

// Zod schema for products array
const productSchema = z.object({
  product: objectIdSchema,
  machine_name: objectIdSchema,
  planned_quantity: z.number().min(1, "Planned quantity must be at least 1"),
  scheduled_date: dateStringSchema,
});

// Main JobOrder Zod schema
const jobOrderZodSchema = z.object({
  work_order: objectIdSchema,
  sales_order_number: z.string().trim().min(1, "Sales order number is required").optional(),
  products: z.array(productSchema).min(1, "At least one product is required"),
  batch_number: z.number().min(1, "Batch number must be at least 1"),
  date: dateRangeSchema,
  // plant_id: objectIdSchema,
  // factory_id: objectIdSchema,
  // created_by: objectIdSchema,
  // updated_by: objectIdSchema,
  // status: z.enum(['Pending QC', 'Approved', 'Rejected', 'In Progress']).default('Pending QC'),
});

// export const createJobOrder = async (req, res, next) => {
//     try {
//         // Validate input using Zod schema
//         const validatedData = jobOrderZodSchema.parse(req.body);
//         console.log("validatedData",validatedData);

//         // Ensure req.user._id exists (from auth middleware)
//         if (!req.user || !req.user._id) {
//             return next(new ApiError(401, 'Unauthorized: User not authenticated'));
//         }

//         // Convert dates to proper Date objects
//         const dataToSave = {
//             ...validatedData,
//             products: validatedData.products.map(product => ({
//                 ...product,
//                 scheduled_date: new Date(product.scheduled_date)
//             })),
//             date: {
//                 from: new Date(validatedData.date.from),
//                 to: new Date(validatedData.date.to)
//             },
//             created_by: req.user._id,
//             updated_by: req.user._id,
//             status: 'Pending QC'
//         };

//         // Validate work_order exists
//         const workOrderExists = await mongoose.model('WorkOrder').findById(validatedData.work_order);
//         if (!workOrderExists) {
//             return next(new ApiError(400, 'Invalid work_order ID'));
//         }

//         // Create job order
//         const jobOrder = await JobOrder.create(dataToSave);

//         // Check if a DailyProduction already exists for this job_order with status 'In Progress'
//         const existingProduction = await DailyProduction.findOne({
//             job_order: jobOrder._id,
//             status: 'In Progress'
//         });
//         if (existingProduction) {
//             return next(new ApiError(400, 'Production is already in progress for this job order'));
//         }

//         // Map job order products to DailyProduction schema
//         const schemaProducts = jobOrder.products.map(product => ({
//             product_id: product.product,
//             achieved_quantity: 0,
//             rejected_quantity: 0,
//             recycled_quantity: 0
//         }));

//         // Create new DailyProduction document
//         const newProduction = new DailyProduction({
//             work_order: validatedData.work_order,
//             job_order: jobOrder._id,
//             products: schemaProducts,
//         });

//         const savedProduction = await newProduction.save();

//         // Return both job order and daily production data
//         res.status(201).json({
//             success: true,
//             message: 'Job order and production started successfully',
//             data: {
//                 jobOrder,
//                 dailyProduction: savedProduction
//             }
//         });
//     } catch (error) {
//         if (error instanceof z.ZodError) {
//             const errors = error.errors.map(err => ({
//                 field: err.path.join('.'),
//                 message: err.message
//             }));
//             return next(new ApiError(400, 'Validation failed', errors));
//         }
//         next(error);
//     }
// };


//WORKING FINE ====>
// export const createJobOrder = async (req, res, next) => {
//     try {
//       // Validate input using Zod schema
//       const validatedData = jobOrderZodSchema.parse(req.body);
//       console.log("validatedData", validatedData);

//       // Ensure req.user._id exists (from auth middleware)
//       if (!req.user || !req.user._id) {
//         return next(new ApiError(401, 'Unauthorized: User not authenticated'));
//       }

//       // Convert dates to proper Date objects
//       const dataToSave = {
//         ...validatedData,
//         products: validatedData.products.map(product => ({
//           ...product,
//           scheduled_date: new Date(product.scheduled_date),
//         })),
//         date: {
//           from: new Date(validatedData.date.from),
//           to: new Date(validatedData.date.to),
//         },
//         created_by: req.user._id,
//         updated_by: req.user._id,
//         status: 'Pending QC',
//       };

//       // Validate work_order exists
//       const workOrderExists = await mongoose.model('WorkOrder').findById(validatedData.work_order);
//       if (!workOrderExists) {
//         return next(new ApiError(400, 'Invalid work_order ID'));
//       }

//       // Create job order
//       const jobOrder = await JobOrder.create(dataToSave);

//       // Check if a DailyProduction already exists for this job_order with status 'In Progress'
//       const existingProduction = await DailyProduction.findOne({
//         job_order: jobOrder._id,
//         status: 'In Progress',
//       });
//       if (existingProduction) {
//         return next(new ApiError(400, 'Production is already in progress for this job order'));
//       }

//       // Create a separate DailyProduction document for each product
//       const dailyProductionPromises = validatedData.products.map(async (product) => {
//         const schemaProduct = {
//           product_id: product.product,
//           achieved_quantity: 0,
//           rejected_quantity: 0,
//           recycled_quantity: 0,
//         };

//         const newProduction = new DailyProduction({
//           work_order: validatedData.work_order,
//           job_order: jobOrder._id,
//           products: [schemaProduct], // Single product in the products array
//           date: new Date(validatedData.date.from), // Use 'from' date as production date
//           submitted_by: req.user._id,
//           created_by: req.user._id,
//           updated_by: req.user._id,
//           status: 'Pending QC',
//         });

//         return newProduction.save();
//       });

//       // Wait for all DailyProduction documents to be saved
//       const savedProductions = await Promise.all(dailyProductionPromises);

//       // Return job order and array of daily production documents
//       res.status(201).json({
//         success: true,
//         message: 'Job order and production records created successfully',
//         data: {
//           jobOrder,
//           dailyProductions: savedProductions,
//         },
//       });
//     } catch (error) {
//       if (error instanceof z.ZodError) {
//         const errors = error.errors.map(err => ({
//           field: err.path.join('.'),
//           message: err.message,
//         }));
//         return next(new ApiError(400, 'Validation failed', errors));
//       }
//       next(error);
//     }
//   };

///////////////////////////////////////////////////===========================================////////////////////////////////////

export const createJobOrder1 = async (req, res, next) => {
  console.log("came here");
  // const session = await mongoose.startSession();
  // session.startTransaction();


  try {
    // Validate input using Zod schema
    const validatedData = jobOrderZodSchema.parse(req.body);

    // Ensure req.user._id exists (from auth middleware)
    if (!req.user || !req.user._id) {
      // await session.abortTransaction();
      // session.endSession();
      return next(new ApiError(401, 'Unauthorized: User not authenticated'));
    }

    // Validate work_order exists
    const workOrderExists = await mongoose
      .model('WorkOrder')
      .findById(validatedData.work_order);
    // .session(session);
    if (!workOrderExists) {
      // await session.abortTransaction();
      // session.endSession();
      return next(new ApiError(400, 'Invalid work_order ID'));
    }

    const workOrder = await WorkOrder.findById(validatedData.work_order);
    // .session(session);
    for (const product of validatedData.products) {
      const woProduct = workOrder.products.find((p) => p.product_id.equals(product.product));
      if (!woProduct) {
        // await session.abortTransaction();
        // session.endSession();
        throw new ApiError(400, `Product ${product.product} not found in work order`);
      }
      if (product.planned_quantity > woProduct.qty_in_nos) {
        // await session.abortTransaction();
        // session.endSession();
        throw new ApiError(400, `Planned quantity for product ${product.product} exceeds work order quantity`);
      }
    }

    // Generate job_order_id
    const counter = await Counter.findOneAndUpdate(
      { _id: 'job_order' },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true } //session
    );
    const jobOrderId = `JO-${String(counter.sequence_value).padStart(3, '0')}`; // e.g., JO-001

    // Prepare data to save
    const dataToSave = {
      job_order_id: jobOrderId,
      ...validatedData,
      products: validatedData.products.map((product) => ({
        ...product,
        scheduled_date: new Date(product.scheduled_date),
      })),
      date: {
        from: new Date(validatedData.date.from),
        to: new Date(validatedData.date.to),
      },
      created_by: req.user._id,
      updated_by: req.user._id,
      status: 'Pending',
    };

    // Create job order
    const jobOrder = await JobOrder.create([dataToSave]); //, { session }

    // Check if a DailyProduction already exists for this job_order with status 'In Progress'
    const existingProduction = await DailyProduction.findOne({
      job_order: jobOrder[0]._id,
      status: 'In Progress',
    });
    // .session(session);
    if (existingProduction) {
      // await session.abortTransaction();
      // session.endSession();
      return next(new ApiError(400, 'Production is already in progress for this job order'));
    }

    // Create a separate DailyProduction document for each product
    const dailyProductionPromises = validatedData.products.map(async (product) => {
      const schemaProduct = {
        product_id: product.product,
        achieved_quantity: 0,
        rejected_quantity: 0,
        recycled_quantity: 0,
      };

      const newProduction = new DailyProduction({
        work_order: validatedData.work_order,
        job_order: jobOrder[0]._id,
        products: [schemaProduct],
        date: new Date(product.scheduled_date),
        submitted_by: req.user._id,
        created_by: req.user._id,
        updated_by: req.user._id,
        status: 'Pending',
      });
      console.log("newProduction", newProduction);

      return newProduction.save({}); //session
    });

    // Wait for all DailyProduction documents to be saved
    const savedProductions = await Promise.all(dailyProductionPromises);

    // Commit transaction
    // await session.commitTransaction();
    // session.endSession();

    // Return job order and array of daily production documents
    res.status(201).json({
      success: true,
      message: 'Job order and production records created successfully',
      data: {
        jobOrder: jobOrder[0],
        dailyProductions: savedProductions,
      },
    });
  } catch (error) {
    console.log("error", error);
    // await session.abortTransaction();
    // session.endSession();
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(new ApiError(400, 'Validation failed', errors));
    }
    next(error);
  }
};

export const createJobOrder = async (req, res, next) => {
  console.log("came here");
  try {


    // ✅ Normalize date inputs before validation
    if (req.body.date) {
      req.body.date.from = normalizeDate(req.body.date.from).toISOString().split('T')[0];
      req.body.date.to = normalizeDate(req.body.date.to).toISOString().split('T')[0];
    }

    if (Array.isArray(req.body.products)) {
      req.body.products = req.body.products.map((p) => ({
        ...p,
        scheduled_date: normalizeDate(p.scheduled_date).toISOString().split('T')[0],
      }));
    }



    const validatedData = jobOrderZodSchema.parse(req.body);
    console.log("validatedData", validatedData);

    if (!req.user || !req.user._id) {
      return next(new ApiError(401, 'Unauthorized: User not authenticated'));
    }

    const workOrder = await WorkOrder.findById(validatedData.work_order);
    if (!workOrder) {
      return next(new ApiError(400, 'Invalid work_order ID'));
    }

    for (const product of validatedData.products) {
      const woProduct = workOrder.products.find((p) => p.product_id.equals(product.product));
      if (!woProduct) {
        throw new ApiError(400, `Product ${product.product} not found in work order`);
      }

      const existingJobOrders = await JobOrder.find({
        work_order: validatedData.work_order,
        'products.product': product.product,
      });

      const totalExistingPlannedQuantity = existingJobOrders.reduce((total, jo) => {
        const joProduct = jo.products.find((p) => p.product.equals(product.product));
        return total + (joProduct ? joProduct.planned_quantity : 0);
      }, 0);

      const totalPlannedQuantity = totalExistingPlannedQuantity + product.planned_quantity;

      if (totalPlannedQuantity > woProduct.qty_in_nos) {
        throw new ApiError(
          400,
          `Planned quantity for product ${product.product} exceeds available work order quantity. ` +
          `Work order has qty_in_nos of ${woProduct.qty_in_nos}, ` +
          `existing job orders have a total planned quantity of ${totalExistingPlannedQuantity}, ` +
          `and you are trying to add ${product.planned_quantity}. ` +
          `Maximum allowed additional quantity is ${woProduct.qty_in_nos - totalExistingPlannedQuantity}.`
        );
      }
    }

    const counter = await Counter.findOneAndUpdate(
      { _id: 'job_order' },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    const jobOrderId = `JO-${String(counter.sequence_value).padStart(3, '0')}`;

    const dataToSave = {
      job_order_id: jobOrderId,
      ...validatedData,
      products: validatedData.products.map((product) => ({
        ...product,
        scheduled_date: new Date(product.scheduled_date),
      })),
      date: {
        from: new Date(validatedData.date.from),
        to: new Date(validatedData.date.to),
      },
      created_by: req.user._id,
      updated_by: req.user._id,
      status: 'Pending',
    };

    const jobOrder = await JobOrder.create([dataToSave]);

    const existingProduction = await DailyProduction.findOne({
      job_order: jobOrder[0]._id,
      status: 'In Progress',
    });
    if (existingProduction) {
      return next(new ApiError(400, 'Production is already in progress for this job order'));
    }

    const dailyProductionPromises = validatedData.products.map(async (product) => {
      const schemaProduct = {
        product_id: product.product,
        achieved_quantity: 0,
        rejected_quantity: 0,
        recycled_quantity: 0,
      };
      console.log("validatedData", validatedData);

      console.log("date", product.scheduled_date
      );
      // date:new Date(product.scheduled_date),


      const newProduction = new DailyProduction({
        work_order: validatedData.work_order,
        job_order: jobOrder[0]._id,
        products: [schemaProduct],
        date: new Date(product.scheduled_date),
        submitted_by: req.user._id,
        created_by: req.user._id,
        updated_by: req.user._id,
        status: 'Pending',
      });

      return newProduction.save();
    });

    const savedProductions = await Promise.all(dailyProductionPromises);

    res.status(201).json({
      success: true,
      message: 'Job order and production records created successfully',
      data: {
        jobOrder: jobOrder[0],
        // dailyProductions: savedProductions,
      },
    });
  } catch (error) {
    // console.log("error",error);
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(new ApiError(400, 'Validation failed', errors));
    }
    next(error);
  }
};


//////////////////////////////////////////////////===========================================//////////////////////////////////////

export const getJobOrders = async (req, res) => {
  try {
    const jobOrders = await JobOrder.find()
      .populate({
        path: 'work_order',
        select: 'project_id work_order_number',
        populate: {
          path: 'project_id',
          select: 'name'
        },
        populate: {
          path: 'created_by',
          select: 'username'
        }
      })

      // .populate({
      //   path: 'work_order',
      //   select: 'project_id work_order_number',
      //   populate: {
      //     path: 'project_id',
      //     select: 'name'
      //   }
      // })
      // .populate({
      //   path: 'work_order',
      //   select: 'created_by',
      //   populate: {
      //     path: 'created_by',
      //     select: 'username'
      //   }
      // })
      .populate({ path: 'created_by', select: 'username' })

    // Transform the response to include project_name at the top level
    const transformedOrders = jobOrders.map(order => {
      const orderObj = order.toObject();
      console.log("orderObj***********",orderObj);
      return {
        ...orderObj,
        project_name: orderObj.work_order?.project_id?.name || 'N/A',
        work_order_number: orderObj.work_order?.work_order_number || 'N/A' // Optional
      };
    });

    // console.log("jobOrders", transformedOrders);
    return res.status(200).json({
      success: true,
      message: "Job Order data fetched successfully",
      data: transformedOrders
    });
  } catch (error) {
    console.error("Error getting JobOrder:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message // Optional: include error message for debugging
    });
  }
};

// export const getJobOrders = async (req, res) => {
//   try {
//     const jobOrders = await JobOrder.find()
//       .populate({
//         path: 'work_order',
//         select: 'project_id work_order_number',
//         populate: {
//           path: 'project_id',
//           select: 'name'
//         }
//       })
//       .populate({
//         path: 'work_order',
//         select: 'created_by',
//         populate: {
//           path: 'created_by',
//           select: 'username'
//         }
//       })
//       .populate({ path: 'created_by', select: 'username' });

//     const transformedOrders = jobOrders.map(order => {
//       const orderObj = order.toObject();
//       return {
//         ...orderObj,
//         project_name: orderObj.work_order?.project_id?.name || 'N/A',
//         work_order_number: orderObj.work_order?.work_order_number || 'N/A'
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Job Order data fetched successfully",
//       data: transformedOrders
//     });
//   } catch (error) {
//     console.error("Error getting JobOrder:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message
//     });
//   }
// };



// export const getJobOrderById = async (req, res) => {
//     try {
//         const joId = req.params.id;
//         const joData = await JobOrder.findById(joId);

//         if (!joData) {
//             return res.status(404).json({
//                 success: false,
//                 message: `Job Order with id ${joId} not found`
//             });
//         }
//         return res.status(200).json({
//             success: true,
//             message: `Work Order Data for id ${joId} found.`,
//             data: joData
//         });

//     } catch (error) {
//         // Handle Zod validation errors
//         if (error instanceof z.ZodError) {
//             return res.status(400).json({
//                 success: false,
//                 errors: error.errors.map(err => ({
//                     field: err.path.join('.'),
//                     message: err.message,
//                 })),
//             });
//         }

//         // Handle Mongoose validation errors
//         if (error.name === 'ValidationError') {
//             const formattedErrors = Object.values(error.errors).map(err => ({
//                 field: err.path,
//                 message: err.message,
//             }));
//             return res.status(400).json({
//                 success: false,
//                 errors: formattedErrors,
//             });
//         }

//         // Handle duplicate key errors (e.g., unique batch_number)
//         if (error.code === 11000) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Duplicate key error",
//                 field: Object.keys(error.keyPattern)[0],
//             });
//         }

//         // Handle other errors
//         console.error("Error creating JobOrder:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error"
//         });
//     }
// };


// export const getJobOrderById = async (req, res) => {
//     try {
//         const joId = req.params.id;
//         const joData = await JobOrder.findById(joId)
//             .populate({
//                 path: 'work_order',
//                 populate: [
//                     {
//                         path: 'client_id',
//                         select: 'name address'
//                     },
//                     {
//                         path: 'project_id',
//                         select: 'name'
//                     },
//                     {
//                         path: 'created_by',
//                         select: 'username'
//                     }
//                 ],
//                 select: 'work_order_number date status createdAt created_by'
//             })
//             .populate({
//                 path:'created_by',
//                 select:''
//             })
//             // .populate('created_by', 'name')
//             // .populate('products.product', 'name')
//             // .populate('products.machine_name', 'name');

//         if (!joData) {
//             return res.status(404).json({
//                 success: false,
//                 message: `Job Order with id ${joId} not found`
//             });
//         }

//         // Transform the data for better response structure
//         const transformedData = {
//             ...joData.toObject(),
//             client: {
//                 name: joData.work_order?.client_id?.name || 'N/A',
//                 address: joData.work_order?.client_id?.address || 'N/A'
//             },
//             project_name: joData.work_order?.project_id?.name || 'N/A',
//             work_order_details: {
//                 work_order_number: joData.work_order?.work_order_number || 'N/A',
//                 date: joData.work_order?.date || 'N/A',
//                 status: joData.work_order?.status || 'N/A',
//                 created_at: joData.work_order?.createdAt || 'N/A',
//                 created_by: joData.work_order?.created_by?.name || 'N/A'
//             },
//             job_order_status: joData.status,
//             created_by: joData.created_by?.name || 'N/A'
//         };

//         return res.status(200).json({
//             success: true,
//             message: `Job Order Data for id ${joId} found.`,
//             data: transformedData
//         });

//     } catch (error) {
//         console.error("Error getting JobOrder by ID:", error);

//         // Handle Zod validation errors
//         if (error instanceof z.ZodError) {
//             return res.status(400).json({
//                 success: false,
//                 errors: error.errors.map(err => ({
//                     field: err.path.join('.'),
//                     message: err.message,
//                 })),
//             });
//         }

//         // Handle Mongoose validation errors
//         if (error.name === 'ValidationError') {
//             const formattedErrors = Object.values(error.errors).map(err => ({
//                 field: err.path,
//                 message: err.message,
//             }));
//             return res.status(400).json({
//                 success: false,
//                 errors: formattedErrors,
//             });
//         }

//         // Handle other errors
//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


//NOT PROPERELY SHOWING DATA ->
// export const getJobOrderById = async (req, res) => {
//     try {
//         const joId = req.params.id;

//         const joData = await JobOrder.aggregate([
//             { $match: { _id: new mongoose.Types.ObjectId(joId) } },

//             // Lookup work order details
//             {
//                 $lookup: {
//                     from: 'workorders',
//                     localField: 'work_order',
//                     foreignField: '_id',
//                     as: 'work_order'
//                 }
//             },
//             { $unwind: '$work_order' },

//             // Lookup client details
//             {
//                 $lookup: {
//                     from: 'clients',
//                     localField: 'work_order.client_id',
//                     foreignField: '_id',
//                     as: 'client'
//                 }
//             },
//             { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },

//             // Lookup project details
//             {
//                 $lookup: {
//                     from: 'projects',
//                     localField: 'work_order.project_id',
//                     foreignField: '_id',
//                     as: 'project'
//                 }
//             },
//             { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },

//             // Lookup work order creator
//             {
//                 $lookup: {
//                     from: 'users',
//                     localField: 'work_order.created_by',
//                     foreignField: '_id',
//                     as: 'work_order_creator'
//                 }
//             },
//             { $unwind: { path: '$work_order_creator', preserveNullAndEmptyArrays: true } },

//             // Lookup job order creator
//             {
//                 $lookup: {
//                     from: 'users',
//                     localField: 'created_by',
//                     foreignField: '_id',
//                     as: 'job_order_creator'
//                 }
//             },
//             { $unwind: { path: '$job_order_creator', preserveNullAndEmptyArrays: true } },

//             // Add product and machine details to each product
//             {
//                 $addFields: {
//                     products: {
//                         $map: {
//                             input: '$products',
//                             as: 'product',
//                             in: {
//                                 $mergeObjects: [
//                                     '$$product',
//                                     {
//                                         product_details: { $toObjectId: '$$product.product' },
//                                         machine_details: { $toObjectId: '$$product.machine_name' }
//                                     }
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             },

//             // Lookup product details
//             {
//                 $lookup: {
//                     from: 'products',
//                     localField: 'products.product_details',
//                     foreignField: '_id',
//                     as: 'product_details'
//                 }
//             },

//             // Lookup machine details
//             {
//                 $lookup: {
//                     from: 'machines',
//                     localField: 'products.machine_details',
//                     foreignField: '_id',
//                     as: 'machine_details'
//                 }
//             },

//             // Match work order products with job order products
//             {
//                 $addFields: {
//                     products: {
//                         $map: {
//                             input: '$products',
//                             as: 'p',
//                             in: {
//                                 $mergeObjects: [
//                                     '$$p',
//                                     {
//                                         work_order_product: {
//                                             $first: {
//                                                 $filter: {
//                                                     input: '$work_order.products',
//                                                     as: 'wop',
//                                                     cond: {
//                                                         $eq: [
//                                                             { $toString: '$$wop.product_id' },
//                                                             { $toString: '$$p.product' }
//                                                         ]
//                                                     }
//                                                 }
//                                             }
//                                         },
//                                         plant_id: {
//                                             $ifNull: [
//                                                 {
//                                                     $first: {
//                                                         $filter: {
//                                                             input: '$work_order.products',
//                                                             as: 'wop',
//                                                             cond: {
//                                                                 $eq: [
//                                                                     { $toString: '$$wop.product_id' },
//                                                                     { $toString: '$$p.product' }
//                                                                 ]
//                                                             }
//                                                         }
//                                                     }
//                                                 },
//                                                 null
//                                             ]
//                                         }
//                                     }
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             },

//             // Lookup plant details
//             {
//                 $lookup: {
//                     from: 'plants',
//                     localField: 'products.work_order_product.plant_code',
//                     foreignField: '_id',
//                     as: 'plant_details'
//                 }
//             },

//             // Final transformation
//             {
//                 $addFields: {
//                     products: {
//                         $map: {
//                             input: '$products',
//                             as: 'p',
//                             in: {
//                                 $mergeObjects: [
//                                     {
//                                         _id: '$$p._id',
//                                         product: '$$p.product',
//                                         machine_name: '$$p.machine_name',
//                                         planned_quantity: '$$p.planned_quantity',
//                                         scheduled_date: '$$p.scheduled_date'
//                                     },
//                                     {
//                                         product_name: {
//                                             $let: {
//                                                 vars: {
//                                                     pd: {
//                                                         $first: {
//                                                             $filter: {
//                                                                 input: '$product_details',
//                                                                 as: 'pd',
//                                                                 cond: {
//                                                                     $eq: [
//                                                                         { $toString: '$$pd._id' },
//                                                                         { $toString: '$$p.product' }
//                                                                     ]
//                                                                 }
//                                                             }
//                                                         }
//                                                     }
//                                                 },
//                                                 in: '$$pd.description'
//                                             }
//                                         },
//                                         machine_name_text: {
//                                             $let: {
//                                                 vars: {
//                                                     md: {
//                                                         $first: {
//                                                             $filter: {
//                                                                 input: '$machine_details',
//                                                                 as: 'md',
//                                                                 cond: {
//                                                                     $eq: [
//                                                                         { $toString: '$$md._id' },
//                                                                         { $toString: '$$p.machine_name' }
//                                                                     ]
//                                                                 }
//                                                             }
//                                                         }
//                                                     }
//                                                 },
//                                                 in: '$$md.name'
//                                             }
//                                         },
//                                         plant_name: {
//                                             $let: {
//                                                 vars: {
//                                                     pld: {
//                                                         $first: {
//                                                             $filter: {
//                                                                 input: '$plant_details',
//                                                                 as: 'pld',
//                                                                 cond: {
//                                                                     $eq: [
//                                                                         { $toString: '$$pld._id' },
//                                                                         { $toString: '$$p.work_order_product.plant_code' }
//                                                                     ]
//                                                                 }
//                                                             }
//                                                         }
//                                                     }
//                                                 },
//                                                 in: '$$pld.plant_name'
//                                             }
//                                         }
//                                     }
//                                 ]
//                             }
//                         }
//                     },
//                     client_name: '$client.name',
//                     client_address: '$client.address',
//                     project_name: '$project.name',
//                     work_order_details: {
//                         work_order_number: '$work_order.work_order_number',
//                         date: '$work_order.date',
//                         status: '$work_order.status',
//                         created_at: '$work_order.createdAt',
//                         created_by: '$work_order_creator.username'
//                     },
//                     job_order_status: '$status',
//                     created_by_name: '$job_order_creator.username'
//                 }
//             },

//             // Project only needed fields
//             {
//                 $project: {
//                     _id: 1,
//                     date: 1,
//                     sales_order_number: 1,
//                     products: {
//                         _id: 1,
//                         product: 1,
//                         product_name: 1,
//                         machine_name: '$machine_name_text',
//                         planned_quantity: 1,
//                         scheduled_date: 1,
//                         plant_name: 1
//                     },
//                     batch_number: 1,
//                     status: 1,
//                     createdAt: 1,
//                     updatedAt: 1,
//                     client: {
//                         name: '$client_name',
//                         address: '$client_address'
//                     },
//                     project_name: 1,
//                     work_order_details: 1,
//                     job_order_status: 1,
//                     created_by: '$created_by_name'
//                 }
//             }
//         ]);

//         if (!joData || joData.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: `Job Order with id ${joId} not found`
//             });
//         }

//         // Format the response
//         const result = joData[0];
//         result.products = result.products.map(p => ({
//             ...p,
//             // Ensure we're not returning null or undefined values
//             product_name: p.product_name || 'N/A',
//             machine_name: p.machine_name || 'N/A',
//             plant_name: p.plant_name || 'N/A'
//         }));

//         return res.status(200).json({
//             success: true,
//             message: `Job Order Data for id ${joId} found.`,
//             data: result
//         });

//     } catch (error) {
//         console.error("Error getting JobOrder by ID:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };



export const getJobOrderById1 = async (req, res) => {
  try {
    const joId = req.params.id;
    console.log("joId", joId);

    // Validate joId
    if (!mongoose.isValidObjectId(joId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Job Order ID',
      });
    }

    const joData = await JobOrder.aggregate([
      // Match the JobOrder by ID
      { $match: { _id: new mongoose.Types.ObjectId(joId) } },

      // Lookup WorkOrder details
      {
        $lookup: {
          from: 'workorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'work_order',
        },
      },
      { $unwind: { path: '$work_order', preserveNullAndEmptyArrays: true } },

      // Lookup Client details
      {
        $lookup: {
          from: 'clients',
          localField: 'work_order.client_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },

      // Lookup WorkOrder creator
      {
        $lookup: {
          from: 'users',
          localField: 'work_order.created_by',
          foreignField: '_id',
          as: 'work_order_creator',
        },
      },
      { $unwind: { path: '$work_order_creator', preserveNullAndEmptyArrays: true } },

      // Lookup JobOrder creator
      {
        $lookup: {
          from: 'users',
          localField: 'created_by',
          foreignField: '_id',
          as: 'job_order_creator',
        },
      },
      { $unwind: { path: '$job_order_creator', preserveNullAndEmptyArrays: true } },

      // Lookup Product details for each product in JobOrder
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'product_details',
        },
      },

      // Lookup Machine details for each product in JobOrder
      {
        $lookup: {
          from: 'machines',
          localField: 'products.machine_name',
          foreignField: '_id',
          as: 'machine_details',
        },
      },

      // Lookup Plant details via Product's plant_id
      {
        $lookup: {
          from: 'plants',
          localField: 'product_details.plant',
          foreignField: '_id',
          as: 'plant_details',
        },
      },

      // Transform the products array
      {
        $addFields: {
          products: {
            $map: {
              input: '$products',
              as: 'p',
              in: {
                _id: '$$p._id',
                product: '$$p.product',
                planned_quantity: '$$p.planned_quantity',
                scheduled_date: '$$p.scheduled_date',
                description: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                    },
                    in: '$$pd.description',
                  },
                },
                material_code: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                    },
                    in: '$$pd.material_code',
                  },
                },
                machine_id: '$$p.machine_name',
                machine_name: {
                  $let: {
                    vars: {
                      md: {
                        $arrayElemAt: [
                          '$machine_details',
                          {
                            $indexOfArray: ['$machine_details._id', '$$p.machine_name'],
                          },
                        ],
                      },
                    },
                    in: '$$md.name',
                  },
                },
                plant_id: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                      pld: {
                        $arrayElemAt: [
                          '$plant_details',
                          {
                            $indexOfArray: ['$plant_details._id', {
                              $let: {
                                vars: {
                                  pd: {
                                    $arrayElemAt: [
                                      '$product_details',
                                      {
                                        $indexOfArray: ['$product_details._id', '$$p.product'],
                                      },
                                    ],
                                  },
                                },
                                in: '$$pd.plant',
                              },
                            }],
                          },
                        ],
                      },
                    },
                    in: '$$pld._id',
                  },
                },
                plant_name: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                      pld: {
                        $arrayElemAt: [
                          '$plant_details',
                          {
                            $indexOfArray: ['$plant_details._id', {
                              $let: {
                                vars: {
                                  pd: {
                                    $arrayElemAt: [
                                      '$product_details',
                                      {
                                        $indexOfArray: ['$product_details._id', '$$p.product'],
                                      },
                                    ],
                                  },
                                },
                                in: '$$pd.plant',
                              },
                            }],
                          },
                        ],
                      },
                    },
                    in: '$$pld.plant_name',
                  },
                },
              },
            },
          },
          client_name: { $ifNull: ['$client.name', 'N/A'] },
          client_address: { $ifNull: ['$client.address', 'N/A'] },
          work_order_details: {
            _id: '$work_order._id',
            work_order_number: '$work_order.work_order_number',
            status: '$work_order.status',
            created_at: '$work_order.createdAt',
            created_by: { $ifNull: ['$work_order_creator.username', 'N/A'] },
          },
          job_order_status: '$status',
          created_by_name: { $ifNull: ['$job_order_creator.username', 'N/A'] },
        },
      },

      // Project final fields
      {
        $project: {
          _id: 1,
          sales_order_number: 1,
          products: {
            _id: 1,
            product: 1,
            description: 1,
            material_code: 1,
            machine_id: 1,
            machine_name: 1,
            plant_id: 1,
            plant_name: 1,
            planned_quantity: 1,
            scheduled_date: 1,
          },
          batch_number: 1,
          date: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          work_order_details: 1,
          job_order_status: 1,
          created_by: '$created_by_name',
          client: {
            name: '$client_name',
            address: '$client_address',
          },
        },
      },
    ]);

    if (!joData || joData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Job Order with id ${joId} not found`,
      });
    }

    // Format the response
    const result = joData[0];
    result.products = result.products.map(p => ({
      ...p,
      description: p.description || 'N/A',
      material_code: p.material_code || 'N/A',
      machine_id: p.machine_id || 'N/A',
      machine_name: p.machine_name || 'N/A',
      plant_id: p.plant_id || 'N/A',
      plant_name: p.plant_name || 'N/A',
    }));

    return res.status(200).json({
      success: true,
      message: `Job Order Data for id ${joId} found.`,
      data: result,
    });

  } catch (error) {
    console.error('Error getting JobOrder by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


export const getJobOrderById = async (req, res) => {
  try {
    const joId = req.params.id;
    console.log("joId", joId);

    // Validate joId
    if (!mongoose.isValidObjectId(joId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Job Order ID',
      });
    }

    const joData = await JobOrder.aggregate([
      // Match the JobOrder by ID
      { $match: { _id: new mongoose.Types.ObjectId(joId) } },

      // Lookup WorkOrder details
      {
        $lookup: {
          from: 'workorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'work_order',
        },
      },
      { $unwind: { path: '$work_order', preserveNullAndEmptyArrays: true } },

      // Lookup Client details
      {
        $lookup: {
          from: 'clients',
          localField: 'work_order.client_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },

      // Lookup WorkOrder creator
      {
        $lookup: {
          from: 'users',
          localField: 'work_order.created_by',
          foreignField: '_id',
          as: 'work_order_creator',
        },
      },
      { $unwind: { path: '$work_order_creator', preserveNullAndEmptyArrays: true } },

      // Lookup JobOrder creator
      {
        $lookup: {
          from: 'users',
          localField: 'created_by',
          foreignField: '_id',
          as: 'job_order_creator',
        },
      },
      { $unwind: { path: '$job_order_creator', preserveNullAndEmptyArrays: true } },

      // Lookup Product details for each product in JobOrder
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'product_details',
        },
      },

      // Lookup Machine details for each product in JobOrder
      {
        $lookup: {
          from: 'machines',
          localField: 'products.machine_name',
          foreignField: '_id',
          as: 'machine_details',
        },
      },

      // Lookup Plant details via Product's plant_id
      {
        $lookup: {
          from: 'plants',
          localField: 'product_details.plant',
          foreignField: '_id',
          as: 'plant_details',
        },
      },

      // Lookup DailyProduction data to get achieved_quantity and rejected_quantity
      {
        $lookup: {
          from: 'dailyproductions',
          let: { job_order_id: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$job_order', '$$job_order_id'] } } },
            { $unwind: '$products' },
            {
              $group: {
                _id: '$products.product_id',
                achieved_quantity: { $sum: '$products.achieved_quantity' },
                rejected_quantity: { $sum: '$products.rejected_quantity' },
              },
            },
          ],
          as: 'daily_production_data',
        },
      },

      // Transform the products array
      {
        $addFields: {
          products: {
            $map: {
              input: '$products',
              as: 'p',
              in: {
                _id: '$$p._id',
                product: '$$p.product',
                planned_quantity: '$$p.planned_quantity',
                scheduled_date: '$$p.scheduled_date',
                description: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                    },
                    in: '$$pd.description',
                  },
                },
                material_code: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                    },
                    in: '$$pd.material_code',
                  },
                },
                machine_id: '$$p.machine_name',
                machine_name: {
                  $let: {
                    vars: {
                      md: {
                        $arrayElemAt: [
                          '$machine_details',
                          {
                            $indexOfArray: ['$machine_details._id', '$$p.machine_name'],
                          },
                        ],
                      },
                    },
                    in: '$$md.name',
                  },
                },
                plant_id: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                      pld: {
                        $arrayElemAt: [
                          '$plant_details',
                          {
                            $indexOfArray: ['$plant_details._id', {
                              $let: {
                                vars: {
                                  pd: {
                                    $arrayElemAt: [
                                      '$product_details',
                                      {
                                        $indexOfArray: ['$product_details._id', '$$p.product'],
                                      },
                                    ],
                                  },
                                },
                                in: '$$pd.plant',
                              },
                            }],
                          },
                        ],
                      },
                    },
                    in: '$$pld._id',
                  },
                },
                plant_name: {
                  $let: {
                    vars: {
                      pd: {
                        $arrayElemAt: [
                          '$product_details',
                          {
                            $indexOfArray: ['$product_details._id', '$$p.product'],
                          },
                        ],
                      },
                      pld: {
                        $arrayElemAt: [
                          '$plant_details',
                          {
                            $indexOfArray: ['$plant_details._id', {
                              $let: {
                                vars: {
                                  pd: {
                                    $arrayElemAt: [
                                      '$product_details',
                                      {
                                        $indexOfArray: ['$product_details._id', '$$p.product'],
                                      },
                                    ],
                                  },
                                },
                                in: '$$pd.plant',
                              },
                            }],
                          },
                        ],
                      },
                    },
                    in: '$$pld.plant_name',
                  },
                },
                achieved_quantity: {
                  $let: {
                    vars: {
                      dp: {
                        $arrayElemAt: [
                          '$daily_production_data',
                          {
                            $indexOfArray: ['$daily_production_data._id', '$$p.product'],
                          },
                        ],
                      },
                    },
                    in: { $ifNull: ['$$dp.achieved_quantity', 0] },
                  },
                },
                rejected_quantity: {
                  $let: {
                    vars: {
                      dp: {
                        $arrayElemAt: [
                          '$daily_production_data',
                          {
                            $indexOfArray: ['$daily_production_data._id', '$$p.product'],
                          },
                        ],
                      },
                    },
                    in: { $ifNull: ['$$dp.rejected_quantity', 0] },
                  },
                },
              },
            },
          },
          client_name: { $ifNull: ['$client.name', 'N/A'] },
          client_address: { $ifNull: ['$client.address', 'N/A'] },
          work_order_details: {
            _id: '$work_order._id',
            work_order_number: '$work_order.work_order_number',
            status: '$work_order.status',
            created_at: '$work_order.createdAt',
            created_by: { $ifNull: ['$work_order_creator.username', 'N/A'] },
          },
          job_order_status: '$status',
          created_by_name: { $ifNull: ['$job_order_creator.username', 'N/A'] },
        },
      },

      // Project final fields
      {
        $project: {
          _id: 1,
          sales_order_number: 1,
          products: {
            _id: 1,
            product: 1,
            description: 1,
            material_code: 1,
            machine_id: 1,
            machine_name: 1,
            plant_id: 1,
            plant_name: 1,
            planned_quantity: 1,
            scheduled_date: 1,
            achieved_quantity: 1,
            rejected_quantity: 1,
          },
          batch_number: 1,
          date: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          work_order_details: 1,
          job_order_status: 1,
          created_by: '$created_by_name',
          client: {
            name: '$client_name',
            address: '$client_address',
          },
        },
      },
    ]);

    if (!joData || joData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Job Order with id ${joId} not found`,
      });
    }

    // Format the response
    const result = joData[0];
    result.products = result.products.map((p) => ({
      ...p,
      description: p.description || 'N/A',
      material_code: p.material_code || 'N/A',
      machine_id: p.machine_id || 'N/A',
      machine_name: p.machine_name || 'N/A',
      plant_id: p.plant_id || 'N/A',
      plant_name: p.plant_name || 'N/A',
      achieved_quantity: p.achieved_quantity || 0,
      rejected_quantity: p.rejected_quantity || 0,
    }));

    return res.status(200).json({
      success: true,
      message: `Job Order with id ${joId} found.`,
      data: result,
    });

  } catch (error) {
    console.error('Error getting JobOrder by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateJobOrder = async (req, res) => {
  try {
    // 1. Get job order ID from params
    const { id } = req.params;

    // 2. Check if job order exists
    const existingJobOrder = await JobOrder.findById(id);
    if (!existingJobOrder) {
      return res.status(404).json({
        success: false,
        message: "Job order not found",
      });
    }

    // 3. Parse request body
    const bodyData = req.body;

    // 4. Initialize update data object
    const updateData = {};

    // 5. Handle sales_order_number update if provided
    if (bodyData.sales_order_number !== undefined) {
      updateData.sales_order_number = bodyData.sales_order_number;
    }

    // 6. Handle batch_number update if provided
    if (bodyData.batch_number !== undefined) {
      updateData.batch_number = bodyData.batch_number;
    }

    // 7. Handle status update if provided
    if (bodyData.status !== undefined) {
      updateData.status = bodyData.status;
    }

    // 8. Handle date update if provided
    if (bodyData.date) {
      updateData.date = {
        from: new Date(bodyData.date.from),
        to: new Date(bodyData.date.to)
      };
    }

    // 9. Handle products update if provided
    if (bodyData.products !== undefined) {
      let updatedProducts = bodyData.products;

      // Parse stringified products array if needed
      if (typeof bodyData.products === 'string') {
        updatedProducts = JSON.parse(bodyData.products);
      }

      // Validate and process each product
      updateData.products = await Promise.all(
        updatedProducts.map(async (product) => {
          // Validate required fields
          if (!product.product || !product.machine_name || !product.planned_quantity || !product.scheduled_date) {
            throw new Error('All product fields (product, machine_name, planned_quantity, scheduled_date) are required');
          }

          // Convert scheduled_date to Date object
          return {
            product: product.product,
            machine_name: product.machine_name,
            planned_quantity: product.planned_quantity,
            scheduled_date: new Date(product.scheduled_date)
          };
        })
      );
    }

    // 10. Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

    // 11. Update job order
    const updatedJobOrder = await JobOrder.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true,
        runValidators: true
      }
    );

    // 12. Populate the updated job order for better response
    const populatedJobOrder = await JobOrder.findById(updatedJobOrder._id)
      .populate({
        path: 'work_order',
        populate: [
          { path: 'client_id', select: 'name address' },
          { path: 'project_id', select: 'name' }
        ],
        select: 'work_order_number'
      })
      .populate('products.product', 'description')
      .populate('products.machine_name', 'name');

    res.status(200).json({
      success: true,
      data: populatedJobOrder,
      message: "Job order updated successfully",
    });

  } catch (error) {
    // Handle different error types
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    if (error.name === "ValidationError") {
      const formattedErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors: formattedErrors,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format: ${error.value}`,
      });
    }

    console.error("Error updating job order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const deleteJobOrder = async (req, res) => {
  try {
    let ids = req.body.ids;
    console.log('ids', ids);

    // Validate input
    if (!ids) {
      return res.status(400).json({
        success: false,
        message: 'No IDs provided'
      });
    }

    // Convert single ID to array if needed
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    // Check for empty array
    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IDs array cannot be empty'
      });
    }

    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID(s): ${invalidIds.join(', ')}`
      });
    }

    // Permanent deletion
    const result = await JobOrder.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No job orders found to delete'
      });
    }

    // Optional: Remove references from work orders
    await WorkOrder.updateMany(
      { job_orders: { $in: ids } },
      { $pull: { job_orders: { $in: ids } } }
    );

    return res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        deletedIds: ids
      },
      message: `${result.deletedCount} job order(s) deleted successfully`
    });

  } catch (error) {
    console.error("Error deleting job order(s):", error);

    // Handle different error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format: ${error.value}`
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    if (error.name === "ValidationError") {
      const formattedErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors: formattedErrors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

export const getMachinesByProduct1 = async (req, res) => {
  try {
    const materialCode = req.query.material_code;
    // const workOrderId = req.query.work_order_id;

    // Validate input
    if (!materialCode) {
      return res.status(400).json({
        success: false,
        message: "material_code query parameter is required"
      });
    }


    const result = await Product.aggregate([
      {
        $match: { material_code: materialCode }
      },
      {
        $lookup: {
          from: 'machines',
          localField: 'plant',
          foreignField: 'plant_id',
          as: 'machines'
        }
      },
      {
        $unwind: '$machines'
      },
      {
        $replaceRoot: { newRoot: '$machines' }
      },
      {
        $project: {
          _id: 1,
          name: 1,
        }
      }
    ]);





    return res.status(200).json({
      success: true,
      data: result,
      message: "Machines retrieved successfully"
    });

  } catch (error) {
    console.error("Error in getMachinesByProduct:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors: formattedErrors,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getMachinesByProduct = async (req, res) => {
  try {
    const materialCode = req.query.material_code;
    console.log("materialCode", materialCode);

    if (!materialCode) {
      return res.status(400).json({
        success: false,
        message: 'material_code query parameter is required',
      });
    }

    const result = await Product.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(materialCode) },
      },
      {
        $lookup: {
          from: 'machines',
          localField: 'plant',
          foreignField: 'plant_id',
          as: 'machines',
        },
      },
      {
        $unwind: '$machines',
      },
      {
        $lookup: {
          from: 'workorders',
          let: { productId: '$_id' },
          pipeline: [
            {
              $unwind: '$products',
            },
            {
              $match: {
                $expr: {
                  $eq: ['$products.product_id', '$$productId'],
                },
              },
            },
            {
              $limit: 1,
            },
            {
              $project: {
                uom: '$products.uom',
              },
            },
          ],
          as: 'workOrderUOM',
        },
      },
      {
        $unwind: {
          path: '$workOrderUOM',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$machines._id',
          name: { $first: '$machines.name' },
          uom: { $first: '$workOrderUOM.uom' },
          product_id: { $first: '$_id' },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          uom: 1,
          product_id: 1,
        },
      },
    ]);
    console.log("result", result);

    const formattedResult = result.map(item => ({
      _id: item._id,
      name: item.name,
      uom: item.uom || '', // Ensure uom is a string, default to empty string if null
      product_id: item.product_id,
    }));

    return res.status(200).json({
      success: true,
      data: formattedResult,
      message: 'Machines and UOM retrieved successfully',
    });
  } catch (error) {
    console.error('Error in getMachinesByProduct:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors: formattedErrors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};




