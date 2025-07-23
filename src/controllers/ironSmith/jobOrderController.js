import { asyncHandler } from '../../utils/asyncHandler.js';
import Joi from 'joi';
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import {ironJobOrder} from '../../models/ironSmith/jobOrders.model.js';
import { ironCounter } from '../../models/ironSmith/ironCounter.model.js';

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
    bodyData.products.map((p) => console.log("product",p))
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
            match: { isDeleted: false }, // Exclude soft-deleted projects
          },
          {
            path: 'clientId',
            model: 'ironClient',
            select: '_id name',
            match: { isDeleted: false }, // Exclude soft-deleted clients
          },
        ],
      })
      .lean();
  
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

  const updateIronJobOrder = asyncHandler(async (req, res) => {
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

export { createIronJobOrder, getAllIronJobOrders, updateIronJobOrder};