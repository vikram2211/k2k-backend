import mongoose from 'mongoose';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { falconWorkOrder } from '../../models/falconFacade/falconWorkOrder.model.js';
import { formatDateToIST } from '../../utils/formatDate.js';
import { putObject } from '../../../util/putObject.js';
import { z } from 'zod';
import { falconProject } from '../../models/falconFacade/helpers/falconProject.model.js';
import { deleteObject } from '../../../util/deleteObject.js';
import { falconJobOrder } from '../../models/falconFacade/falconJobOrder.model.js';
import { falconInternalWorkOrder } from '../../models/falconFacade/falconInternalWorder.model.js';
import { falconProduction } from '../../models/falconFacade/falconProduction.model.js';
import { falconQCCheck } from '../../models/falconFacade/falconQcCheck.model.js';
import { falconSystem } from '../../models/falconFacade/helpers/falconSystem.model.js';
import { falconProductSystem } from '../../models/falconFacade/helpers/falconProductSystem.model.js';
import { falconProduct } from '../../models/falconFacade/helpers/falconProduct.model.js';
import { falconPacking } from '../../models/falconFacade/falconPacking.model.js';
import { falocnDispatch } from '../../models/falconFacade/falconDispatch.model.js';
// import { falconQCCheck } from '../../models/falconFacade/falconQcCheck.model.js';falocnDispatch
// const { formatDateToIST, formatDateOnly } = require('../../utils/formatDate.js');




const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};


const createFalconWorkOrder = asyncHandler(async (req, res) => {
    try {
        // 1. Validation schema
        const productSchema = Joi.object({
            // product_id: Joi.string()
            //     .required()
            //     .custom((value, helpers) => {
            //         if (!mongoose.Types.ObjectId.isValid(value)) {
            //             return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
            //         }
            //         return value;
            //     }, 'ObjectId validation'),
            product_name: Joi.string().required().messages({ 'string.empty': 'Product name is required' }),
            sac_code: Joi.string().required().messages({ 'string.empty': 'SAC code is required' }),
            uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
            po_quantity: Joi.number().min(0).required().messages({
                'number.base': 'PO quantity must be a number',
                'number.min': 'PO quantity must be non-negative',
            }),
        });

        // const fileSchema = Joi.object({
        //     file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
        //     file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
        // });

        const fileSchema = Joi.object({
            file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
            file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
            uploaded_at: Joi.date().optional(), // Allow uploaded_at
        });

        // const workOrderSchema = Joi.object({
        //     client_id: Joi.string()
        //         .required()
        //         .custom((value, helpers) => {
        //             if (!mongoose.Types.ObjectId.isValid(value)) {
        //                 return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
        //             }
        //             return value;
        //         }, 'ObjectId validation'),
        //     project_id: Joi.string()
        //         .required()
        //         .custom((value, helpers) => {
        //             if (!mongoose.Types.ObjectId.isValid(value)) {
        //                 return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
        //             }
        //             return value;
        //         }, 'ObjectId validation'),
        //     work_order_number: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
        //     date: Joi.date().required().messages({ 'date.base': 'Date is required and must be a valid date' }),
        //     remarks: Joi.string().required().messages({ 'string.empty': 'Remarks are required' }),
        //     products: Joi.array().items(productSchema).min(1).required().messages({
        //         'array.min': 'At least one product is required',
        //     }),
        //     files: Joi.array().items(fileSchema).optional(),
        //     status: Joi.string()
        //         .valid('Pending', 'In Progress', 'Completed', 'Cancelled')
        //         .default('Pending')
        //         .messages({ 'any.only': 'Status must be Pending, In Progress, Completed, or Cancelled' }).optional(),
        //     created_by: Joi.string()
        //         .required()
        //         .custom((value, helpers) => {
        //             if (!mongoose.Types.ObjectId.isValid(value)) {
        //                 return helpers.error('any.invalid', { message: `Created by ID (${value}) is not a valid ObjectId` });
        //             }
        //             return value;
        //         }, 'ObjectId validation'),
        //     updated_by: Joi.string()
        //         .required()
        //         .custom((value, helpers) => {
        //             if (!mongoose.Types.ObjectId.isValid(value)) {
        //                 return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
        //             }
        //             return value;
        //         }, 'ObjectId validation'),
        // });

        // 2. Parse form-data




        const workOrderSchema = Joi.object({
            client_id: Joi.string()
                .required()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                    }
                    return value;
                }, 'ObjectId validation'),
            project_id: Joi.string()
                .required()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                    }
                    return value;
                }, 'ObjectId validation'),
            work_order_number: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
            date: Joi.date().required().messages({ 'date.base': 'Date is required and must be a valid date' }),
            remarks: Joi.string().required().messages({ 'string.empty': 'Remarks are required' }),
            products: Joi.array().items(productSchema).min(1).required().messages({
                'array.min': 'At least one product is required',
            }),
            files: Joi.array().items(fileSchema).optional(),
            status: Joi.string()
                .valid('Pending', 'In Progress', 'Completed', 'Cancelled')
                .default('Pending')
                .messages({ 'any.only': 'Status must be Pending, In Progress, Completed, or Cancelled' }).optional(),
            created_by: Joi.string()
                .required()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid', { message: `Created by ID (${value}) is not a valid ObjectId` });
                    }
                    return value;
                }, 'ObjectId validation'),
            updated_by: Joi.string()
                .required()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
                    }
                    return value;
                }, 'ObjectId validation'),
        });



        const bodyData = req.body;
        // console.log("bodyData", bodyData);
        const userId = req.user?._id?.toString();
        // console.log("userId", userId);

        // Validate userId
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError(400, 'Invalid or missing user ID in request');
        }

        // 3. Parse stringified fields if needed
        if (typeof bodyData.products === 'string') {
            try {
                bodyData.products = JSON.parse(bodyData.products);
            } catch (e) {
                throw new ApiError(400, 'Invalid products JSON format');
            }
        }

        // 4. Handle file uploads
        // const uploadedFiles = [];
        // if (req.files && req.files.length > 0) {
        //     try {
        //         for (const file of req.files) {
        //             const tempFilePath = path.join('./public/temp', file.filename);
        //             console.log("tempFilePath",tempFilePath);
        //             const fileBuffer = fs.readFileSync(tempFilePath);
        //             const sanitizedFilename = sanitizeFilename(file.originalname);
        //             console.log("fimename", file.originalname);
        //             console.log("sanitizedFilename", sanitizedFilename);


        //             // Upload to S3
        //             const { url } = await putObject(
        //                 { data: fileBuffer, mimetype: file.mimetype },
        //                 `falcon-work-orders/${Date.now()}-${sanitizedFilename}`
        //             );

        //             // Delete temp file
        //             fs.unlinkSync(tempFilePath);

        //             uploadedFiles.push({
        //                 file_name: file.originalname,
        //                 file_url: url,
        //                 uploaded_at: new Date(),
        //             });
        //         }
        //     } catch (error) {
        //         // Cleanup temp files on upload error
        //         if (req.files) {
        //             console.log("file***",req.files);
        //             req.files.forEach((file) => {
        //                 const tempFilePath = path.join('./public/temp', file.filename);
        //                 if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        //             });
        //         }
        //         throw new ApiError(500, `File upload failed: ${error.message}`);
        //     }
        // }

        // 4. Handle file uploads
        const uploadedFiles = [];
        if (req.files && req.files.length > 0) {
            try {
                for (const file of req.files) {
                    const sanitizedFilename = sanitizeFilename(file.originalname);

                    // Upload directly from memory (buffer)
                    const { url } = await putObject(
                        { data: file.buffer, mimetype: file.mimetype },  // no need fs.readFileSync
                        `falcon-work-orders/${Date.now()}-${sanitizedFilename}`
                    );

                    uploadedFiles.push({
                        file_name: file.originalname,
                        file_url: url,
                        uploaded_at: new Date(),
                    });
                }
            } catch (error) {
                throw new ApiError(500, `File upload failed: ${error.message}`);
            }
        }


        // 5. Prepare work order data
        const workOrderData = {
            ...bodyData,
            products: bodyData.products,
            files: uploadedFiles,
            date: bodyData.date ? new Date(bodyData.date) : undefined,
            status: bodyData.status || 'Pending',
            created_by: userId,
            updated_by: userId,
        };

        // 6. Validate with Joi
        const { error, value } = workOrderSchema.validate(workOrderData, { abortEarly: false });
        if (error) {
            // Cleanup temp files on validation error
            if (req.files) {
                console.log("files", req.files);
                req.files.forEach((file) => {
                    const tempFilePath = path.join('./public/temp', file.filename);
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                });
            }
            throw new ApiError(400, 'Validation failed for work order creation', error.details);
        }

        // 7. Validate referenced documents
        const [client, project, products] = await Promise.all([
            mongoose.model('falconClient').findById(value.client_id),
            mongoose.model('falconProject').findById(value.project_id),
            Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product_id))),
        ]);

        if (!client) throw new ApiError(404, `Client not found with ID: ${value.client_id}`);
        if (!project) throw new ApiError(404, `Project not found with ID: ${value.project_id}`);
        const invalidProduct = products.findIndex((p) => !p);
        // if (invalidProduct !== -1) {
        //     throw new ApiError(404, `Product not found with ID: ${value.products[invalidProduct].product_id}`);
        // }

        // 8. Save to MongoDB
        const workOrder = await falconWorkOrder.create(value);

        // 9. Populate and format response
        const populatedWorkOrder = await falconWorkOrder
            .findById(workOrder._id)
            .populate({
                path: 'client_id',
                select: 'name address',
                match: { isDeleted: false },
            })
            .populate({
                path: 'project_id',
                select: 'name address',
                match: { isDeleted: false },
            })
            // .populate({
            //     path: 'products.product_id',
            //     select: 'name',
            //     match: { isDeleted: false },
            // })
            .populate('created_by', 'username email')
            .populate('updated_by', 'username email')
            .lean();

        if (!populatedWorkOrder) {
            throw new ApiError(404, 'Failed to retrieve created work order');
        }

        // Convert timestamps to IST
        const formattedWorkOrder = formatDateToIST(populatedWorkOrder);

        return sendResponse(res, new ApiResponse(201, formattedWorkOrder, 'Work order created successfully'));
    } catch (error) {
        // Cleanup: Delete temp files on error
        console.log("error", error);
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        // Handle different error types
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        if (error.name === 'ValidationError') {
            const formattedErrors = Object.values(error.errors).map((err) => ({
                field: err.path,
                message: err.message,
            }));
            return res.status(400).json({
                success: false,
                errors: formattedErrors,
            });
        }

        console.error('Error creating WorkOrder:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
});

const getFalconWorkOrders = asyncHandler(async (req, res) => {

    const workOrders = await falconWorkOrder
        .find()
        .select('_id work_order_number client_id project_id remarks createdAt updatedAt status date')
        .populate({
            path: 'created_by',
            select: 'username',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .lean()
        .sort({ createdA: -1 });

    if (!workOrders?.length) {
        return sendResponse(
            res,
            new ApiResponse(200, [], 'No work orders found.')
        );
    }

    // Format timestamps to IST
    const formattedWorkOrders = formatDateToIST(workOrders);

    return sendResponse(
        res,
        new ApiResponse(200, formattedWorkOrders, 'Work orders fetched successfully.')
    );
});

const updateFalconWorkOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("id", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }




    // 1. Validation schema (all fields optional except updated_by)
    const productSchema = Joi.object({
        product_name: Joi.string().messages({ 'string.empty': 'Product name is required' }),
        sac_code: Joi.string(),
        uom: Joi.string(),
        po_quantity: Joi.number().min(0).messages({
            'number.base': 'PO quantity must be a number',
            'number.min': 'PO quantity must be non-negative',
        }),
    });

    const fileSchema = Joi.object({
        file_name: Joi.string().messages({ 'string.empty': 'File name is required' }),
        file_url: Joi.string().uri().messages({ 'string.uri': 'File URL must be a valid URL' }),
        uploaded_at: Joi.date().optional(),
    });

    const updateWorkOrderSchema = Joi.object({
        client_id: Joi.string()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        project_id: Joi.string()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        work_order_number: Joi.string(),
        date: Joi.date(),
        remarks: Joi.string(),
        products: Joi.array().items(productSchema).min(1).messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array().items(fileSchema).optional(),
        existing_files: Joi.array().items(Joi.string()).optional(), // Added to allow existing file IDs
        status: Joi.string()
            .valid('Pending', 'In Progress', 'Completed', 'Cancelled')
            .messages({ 'any.only': 'Status must be Pending, In Progress, Completed, or Cancelled' }),
        updated_by: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
    });

    // 2. Parse form-data
    const bodyData = req.body;
    console.log("bodyData", bodyData);
    const userId = req.user?._id?.toString();
    console.log("userId", userId);

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // 3. Parse stringified fields if needed
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (e) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    if (typeof bodyData.existing_files === 'string') {
        try {
            bodyData.existing_files = JSON.parse(bodyData.existing_files);
        } catch (e) {
            throw new ApiError(400, 'Invalid existing_files JSON format');
        }
    }



    const existingWorkOrder = await falconWorkOrder.findById(id).lean();
    if (!existingWorkOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    // Delete old files from S3 if new files are being uploaded
    if (req.files && req.files.length > 0 && existingWorkOrder.files?.length) {
        for (const file of existingWorkOrder.files) {
            const urlParts = file.file_url.split('/');
            const key = urlParts.slice(3).join('/'); // remove https://s3-region.amazonaws.com/bucket-name/
            await deleteObject(key);
        }
    }


    // 4. Handle file uploads
    // const uploadedFiles = [];
    // if (req.files && req.files.length > 0) {
    //     try {
    //         for (const file of req.files) {
    //             const tempFilePath = path.join('./public/temp', file.filename);
    //             const fileBuffer = fs.readFileSync(tempFilePath);
    //             const sanitizedFilename = sanitizeFilename(file.originalname);

    //             // Upload to S3
    //             const { url } = await putObject(
    //                 { data: fileBuffer, mimetype: file.mimetype },
    //                 `falcon-work-orders/${Date.now()}-${sanitizedFilename}`
    //             );

    //             // Delete temp file
    //             fs.unlinkSync(tempFilePath);

    //             uploadedFiles.push({
    //                 file_name: file.originalname,
    //                 file_url: url,
    //                 uploaded_at: new Date(),
    //             });
    //         }
    //     } catch (error) {
    //         // Cleanup temp files on upload error
    //         if (req.files) {
    //             req.files.forEach((file) => {
    //                 const tempFilePath = path.join('./public/temp', file.filename);
    //                 if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    //             });
    //         }
    //         throw new ApiError(500, `File upload failed: ${error.message}`);
    //     }
    // }

    // 4. Handle file uploads
const uploadedFiles = [];
if (req.files && req.files.length > 0) {
  try {
    for (const file of req.files) {
      const sanitizedFilename = sanitizeFilename(file.originalname);

      // Upload directly from memory (buffer)
      const { url } = await putObject(
        { data: file.buffer, mimetype: file.mimetype },
        `falcon-work-orders/${Date.now()}-${sanitizedFilename}`
      );

      uploadedFiles.push({
        file_name: file.originalname,
        file_url: url,
        uploaded_at: new Date(),
      });
    }
  } catch (error) {
    throw new ApiError(500, `File upload failed: ${error.message}`);
  }
}


    // 5. Prepare work order data
    const workOrderData = {
        ...bodyData,
        products: bodyData.products,
        files: uploadedFiles.length ? uploadedFiles : undefined,
        date: bodyData.date ? new Date(bodyData.date) : undefined,
        updated_by: userId,
    };

    // 6. Validate with Joi
    const { error, value } = updateWorkOrderSchema.validate(workOrderData, { abortEarly: false });
    if (error) {
        // Cleanup temp files on validation error
        if (req.files) {
            console.log("files", req.files);
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        throw new ApiError(400, 'Validation failed for work order update', error.details);
    }

    // 7. Validate referenced documents if provided
    const validationPromises = [];
    if (value.client_id) {
        validationPromises.push(mongoose.model('falconClient').findById(value.client_id));
    }
    if (value.project_id) {
        validationPromises.push(mongoose.model('falconProject').findById(value.project_id));
    }
    // if (value.products && value.products.length) {
    //     validationPromises.push(
    //         Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product_id)))
    //     );
    // }

    if (validationPromises.length) {
        const results = await Promise.all(validationPromises);
        let resultIndex = 0;

        if (value.client_id) {
            if (!results[resultIndex]) {
                throw new ApiError(404, `Client not found with ID: ${value.client_id}`);
            }
            resultIndex++;
        }
        if (value.project_id) {
            if (!results[resultIndex]) {
                throw new ApiError(404, `Project not found with ID: ${value.project_id}`);
            }
            resultIndex++;
        }
        // if (value.products && value.products.length) {
        //     const products = results[resultIndex];
        //     // const invalidProduct = products.findIndex((p) => !p);
        //     // if (invalidProduct !== -1) {
        //     //     throw new ApiError(404, `Product not found with ID: ${value.products[invalidProduct].product_id}`);
        //     // }
        // }
    }

    // 8. Find and update work order
    const workOrder = await falconWorkOrder
        .findOneAndUpdate(
            { _id: id },
            { $set: value },
            { new: true, runValidators: true }
        )
        .populate({
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        // .populate({
        //     path: 'products.product_id',
        //     select: 'name',
        //     match: { isDeleted: false },
        // })
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .lean();

    if (!workOrder) {
        // Cleanup temp files if work order not found
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        throw new ApiError(404, `Work order with ID ${id} not found or is deleted`);
    }

    // 9. Format response
    const formattedWorkOrder = formatDateToIST(workOrder);

    return sendResponse(res, new ApiResponse(200, formattedWorkOrder, 'Work order updated successfully'));
});

// const getFalconWorkOrderById = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         throw new ApiError(400, `Invalid work order ID: ${id}`);
//     }

//     const workOrder = await falconWorkOrder
//         .findById(id)
//         .select('work_order_number client_id project_id products files date remarks createdAt updatedAt')
//         .populate({
//             path: 'client_id',
//             select: 'name address',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'project_id',
//             select: 'name address',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'products.product_id',
//             select: 'name',
//             match: { isDeleted: false },
//         })
//         .lean();

//     if (!workOrder) {
//         throw new ApiError(404, `Work order with ID ${id} not found`);
//     }

//     // Format timestamps to IST
//     const formattedWorkOrder = formatDateToIST(workOrder);

//     // return sendResponse(
//     //   res.json({
//     //     success: true,
//     //     message: `Work order data for ID ${id} found.`,
//     //     data: formattedWorkOrder
//     //   })
//     // );


//     return sendResponse(
//         res,
//         new ApiResponse(200, formattedWorkOrder, `Work order data for ID ${id} found.`)
//     );
// });



const getFalconWorkOrderById_12_09_2025 = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("id", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    const workOrder = await falconWorkOrder.findById(id)
        .select('work_order_number client_id project_id products files date remarks createdAt updatedAt')
        .populate({ path: 'client_id', select: 'name address', match: { isDeleted: false } })
        .populate({ path: 'project_id', select: 'name address', match: { isDeleted: false } })
        // .populate({ path: 'products.product_id', select: 'name', match: { isDeleted: false } })
        .lean();

    if (!workOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    const jobOrders = await falconJobOrder.find({ work_order_number: id }).lean();
    // console.log("jobOrders",jobOrders);
    const internalWorkOrders = await falconInternalWorkOrder.find({
        job_order_id: { $in: jobOrders.map(j => j._id) }
    }).lean();

    const systemIds = new Set();
    const productSystemIds = new Set();
    console.log("internalWorkOrders", internalWorkOrders);

    internalWorkOrders.forEach(iwo => {
        iwo.products.forEach(prod => {
            console.log("prod", prod);
            systemIds.add(prod.system?.toString());
            productSystemIds.add(prod.product_system?.toString());
        });
    });
    console.log("productSystemIds", productSystemIds);

    const systemDocs = await falconSystem.find({ _id: { $in: Array.from(systemIds) } }).select('name').lean();
    const productSystemDocs = await falconProductSystem.find({ _id: { $in: Array.from(productSystemIds) } }).select('name').lean();

    const systemNameMap = {};
    systemDocs.forEach(sys => systemNameMap[sys._id.toString()] = sys.name);
    const productSystemNameMap = {};
    productSystemDocs.forEach(psys => productSystemNameMap[psys._id.toString()] = psys.name);

    const allProductIds = internalWorkOrders.flatMap(iwo => iwo.products.map(p => p.product));
    const productNamesMap = {};
    const productDocs = await falconProduct.find({ _id: { $in: allProductIds } }).select('name').lean();
    productDocs.forEach(prod => productNamesMap[prod._id.toString()] = prod.name);

    const internalDetails = [];
    const jobOrderSemiDetails = [];

    for (const iwo of internalWorkOrders) {
        const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());

        for (const productObj of iwo.products) {
            const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product.toString() === productObj.product.toString());

            const relatedSemiIds = productObj.semifinished_details.map(s => s.semifinished_id);

            let latestAchievedQty = 0;
            for (const semiId of relatedSemiIds) {
                const latestProduction = await falconProduction.findOne({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semiId
                }).sort({ createdAt: -1 }).select('product.achieved_quantity').lean();

                if (latestProduction?.product?.achieved_quantity) {
                    latestAchievedQty += latestProduction.product.achieved_quantity;
                }
            }

            const qcs = await falconQCCheck.find({
                job_order: relatedJobOrder._id,
                semifinished_id: { $in: relatedSemiIds }
            }).lean();

            const totalRejected = qcs.reduce((sum, qc) => sum + (qc?.rejected_quantity || 0), 0);
            // console.log("productSystemNameMap",productSystemNameMap);

            internalDetails.push({
                product_name: productNamesMap[productObj.product.toString()],
                sales_order_no: iwo.sales_order_no,
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected
            });

            // ---------- Build Semi Finished Detail Section ----------
            // const semiFinishedArray = [];

            // for (const semi of productObj.semifinished_details) {
            //     console.log("semi",semi);
            //     const relatedProductions = await falconProduction.find({
            //         job_order: relatedJobOrder._id,
            //         semifinished_id: semi.semifinished_id
            //     }).sort({ createdAt: -1 }).lean();
            //     console.log("******relatedProductions",relatedProductions);

            //     const stepMap = {};
            //     for (const prod of relatedProductions) {
            //         for (const step of prod?.product?.steps || []) {
            //             console.log("****step",step);
            //             stepMap[step.step_name] = {
            //                 step_name: step.step_name,
            //                 po_quantity: step.po_quantity,
            //                 planned_quantity: step.planned_quantity,
            //                 achieved_quantity: step.achieved_quantity,
            //                 rejected_quantity: step.rejected_quantity
            //             };
            //         }
            //     }

            //     semiFinishedArray.push({
            //         semifinished_id: semi.semifinished_id,
            //         file_url: semi.file_url || '',
            //         remarks: semi.remarks || '',
            //         packing_details: semi.packing_details || '',
            //         dispatch_details: semi.dispatch_details || '',
            //         steps: Object.values(stepMap)
            //     });
            // }



            const semiFinishedArray = [];

            for (const semi of productObj.semifinished_details) {
                // console.log("semi", semi);

                const relatedProductions = await falconProduction.find({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semi.semifinished_id
                }).sort({ createdAt: -1 }).lean();

                // Build steps based on semi.processes and match with production
                const steps = (semi.processes || []).map(proc => {
                    // Find the latest matching production entry by process_name
                    const matchedProd = relatedProductions.find(p =>
                        p.process_name?.toLowerCase().trim() === proc.name?.toLowerCase().trim()
                    );

                    return {
                        step_name: proc.name || '',
                        file_url: proc.file_url || '',
                        remarks: proc.remarks || '',
                        po_quantity: matchedProd?.product?.po_quantity || 0,
                        planned_quantity: matchedProd?.product?.planned_quantity || 0,
                        achieved_quantity: matchedProd?.product?.achieved_quantity || 0,
                        rejected_quantity: matchedProd?.product?.rejected_quantity || 0
                    };
                });

                semiFinishedArray.push({
                    semifinished_id: semi.semifinished_id,
                    file_url: semi.file_url || '',
                    remarks: semi.remarks || '',
                    packing_details: semi.packing_details || '',
                    dispatch_details: semi.dispatch_details || '',
                    steps
                });
            }
            console.log("relatedJobOrder", relatedJobOrder);


            jobOrderSemiDetails.push({
                job_order_id: relatedJobOrder?.job_order_id,
                sales_order_no: iwo.sales_order_no,
                product_name: productNamesMap[productObj.product.toString()],
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected,
                semi_finished_details: semiFinishedArray
            });
        }
    }

    const formattedWorkOrder = formatDateToIST(workOrder);
    formattedWorkOrder.internal_work_order_details = internalDetails;
    formattedWorkOrder.job_order_semi_details = jobOrderSemiDetails;

    return res.status(200).json(
        new ApiResponse(200, formattedWorkOrder, `Work order data for ID ${id} found.`)
    );
});


const getFalconWorkOrderById_12_09_2025_01_PM = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    // Fetch work order (without products)
    const workOrder = await falconWorkOrder.findById(id)
        .select('work_order_number client_id project_id files date remarks createdAt updatedAt')
        .populate({ path: 'client_id', select: 'name address', match: { isDeleted: false } })
        .populate({ path: 'project_id', select: 'name address', match: { isDeleted: false } })
        .lean();

    if (!workOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    // Fetch all job orders linked to this work order
    const jobOrders = await falconJobOrder.find({ work_order_number: id }).lean();
    const allJobOrderProducts = jobOrders.flatMap(jo => jo.products);

    // Fetch internal work orders for these job orders
    const internalWorkOrders = await falconInternalWorkOrder.find({
        job_order_id: { $in: jobOrders.map(j => j._id) }
    }).lean();

    // Rest of your logic for internal details, semi-finished details, etc.
    const systemIds = new Set();
    const productSystemIds = new Set();
    internalWorkOrders.forEach(iwo => {
        iwo.products.forEach(prod => {
            systemIds.add(prod.system?.toString());
            productSystemIds.add(prod.product_system?.toString());
        });
    });

    const systemDocs = await falconSystem.find({ _id: { $in: Array.from(systemIds) } }).select('name').lean();
    const productSystemDocs = await falconProductSystem.find({ _id: { $in: Array.from(productSystemIds) } }).select('name').lean();
    const systemNameMap = {};
    systemDocs.forEach(sys => systemNameMap[sys._id.toString()] = sys.name);
    const productSystemNameMap = {};
    productSystemDocs.forEach(psys => productSystemNameMap[psys._id.toString()] = psys.name);

    const allProductIds = internalWorkOrders.flatMap(iwo => iwo.products.map(p => p.product));
    const productNamesMap = {};
    const productDocs = await falconProduct.find({ _id: { $in: allProductIds } }).select('name').lean();
    productDocs.forEach(prod => productNamesMap[prod._id.toString()] = prod.name);

    // Add product names to the products array
    const productsWithNames = allJobOrderProducts.map(product => ({
        ...product,
        product_name: productNamesMap[product.product.toString()] || 'Unknown Product'
    }));

    // Rest of your logic for internal details and semi-finished details
    const internalDetails = [];
    const jobOrderSemiDetails = [];

    for (const iwo of internalWorkOrders) {
        const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());
        for (const productObj of iwo.products) {
            const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product.toString() === productObj.product.toString());
            const relatedSemiIds = productObj.semifinished_details.map(s => s.semifinished_id);
            let latestAchievedQty = 0;

            for (const semiId of relatedSemiIds) {
                const latestProduction = await falconProduction.findOne({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semiId
                }).sort({ createdAt: -1 }).select('product.achieved_quantity').lean();
                if (latestProduction?.product?.achieved_quantity) {
                    latestAchievedQty += latestProduction.product.achieved_quantity;
                }
            }

            const qcs = await falconQCCheck.find({
                job_order: relatedJobOrder._id,
                semifinished_id: { $in: relatedSemiIds }
            }).lean();
            const totalRejected = qcs.reduce((sum, qc) => sum + (qc?.rejected_quantity || 0), 0);

            internalDetails.push({
                product_name: productNamesMap[productObj.product.toString()],
                sales_order_no: iwo.sales_order_no,
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected
            });

            // Build semi-finished details (unchanged)
            const semiFinishedArray = [];
            for (const semi of productObj.semifinished_details) {
                const relatedProductions = await falconProduction.find({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semi.semifinished_id
                }).sort({ createdAt: -1 }).lean();

                const steps = (semi.processes || []).map(proc => {
                    const matchedProd = relatedProductions.find(p =>
                        p.process_name?.toLowerCase().trim() === proc.name?.toLowerCase().trim()
                    );
                    return {
                        step_name: proc.name || '',
                        file_url: proc.file_url || '',
                        remarks: proc.remarks || '',
                        po_quantity: matchedProd?.product?.po_quantity || 0,
                        planned_quantity: matchedProd?.product?.planned_quantity || 0,
                        achieved_quantity: matchedProd?.product?.achieved_quantity || 0,
                        rejected_quantity: matchedProd?.product?.rejected_quantity || 0
                    };
                });

                semiFinishedArray.push({
                    semifinished_id: semi.semifinished_id,
                    file_url: semi.file_url || '',
                    remarks: semi.remarks || '',
                    packing_details: semi.packing_details || '',
                    dispatch_details: semi.dispatch_details || '',
                    steps
                });
            }

            jobOrderSemiDetails.push({
                job_order_id: relatedJobOrder?.job_order_id,
                sales_order_no: iwo.sales_order_no,
                product_name: productNamesMap[productObj.product.toString()],
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected,
                semi_finished_details: semiFinishedArray
            });
        }
    }

    // Format the work order and replace products with job order products (with names)
    const formattedWorkOrder = formatDateToIST(workOrder);
    formattedWorkOrder.products = productsWithNames;
    formattedWorkOrder.internal_work_order_details = internalDetails;
    formattedWorkOrder.job_order_semi_details = jobOrderSemiDetails;

    return res.status(200).json(
        new ApiResponse(200, formattedWorkOrder, `Work order data for ID ${id} found.`)
    );
});


const getFalconWorkOrderById_12_09_2025_2_30_PM = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    // Fetch work order (without products)
    const workOrder = await falconWorkOrder.findById(id)
        .select('work_order_number client_id project_id files date remarks createdAt updatedAt')
        .populate({ path: 'client_id', select: 'name address', match: { isDeleted: false } })
        .populate({ path: 'project_id', select: 'name address', match: { isDeleted: false } })
        .lean();

    if (!workOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    // Fetch all job orders linked to this work order
    const jobOrders = await falconJobOrder.find({ work_order_number: id }).lean();
    const allJobOrderProducts = jobOrders.flatMap(jo => jo.products);

    // Fetch internal work orders for these job orders
    const internalWorkOrders = await falconInternalWorkOrder.find({
        job_order_id: { $in: jobOrders.map(j => j._id) }
    }).lean();

    // Rest of your logic for internal details, semi-finished details, etc.
    const systemIds = new Set();
    const productSystemIds = new Set();
    internalWorkOrders.forEach(iwo => {
        iwo.products.forEach(prod => {
            systemIds.add(prod.system?.toString());
            productSystemIds.add(prod.product_system?.toString());
        });
    });

    const systemDocs = await falconSystem.find({ _id: { $in: Array.from(systemIds) } }).select('name').lean();
    const productSystemDocs = await falconProductSystem.find({ _id: { $in: Array.from(productSystemIds) } }).select('name').lean();
    const systemNameMap = {};
    systemDocs.forEach(sys => systemNameMap[sys._id.toString()] = sys.name);
    const productSystemNameMap = {};
    productSystemDocs.forEach(psys => productSystemNameMap[psys._id.toString()] = psys.name);

    const allProductIds = internalWorkOrders.flatMap(iwo => iwo.products.map(p => p.product));
    const productNamesMap = {};
    const productDocs = await falconProduct.find({ _id: { $in: allProductIds } }).select('name').lean();
    productDocs.forEach(prod => productNamesMap[prod._id.toString()] = prod.name);

    // Add product names to the products array
    const productsWithNames = allJobOrderProducts.map(product => ({
        ...product,
        product_name: productNamesMap[product.product.toString()] || 'Unknown Product'
    }));

    // Rest of your logic for internal details and semi-finished details
    const internalDetails = [];
    const jobOrderSemiDetails = [];

    for (const iwo of internalWorkOrders) {
        const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());
        for (const productObj of iwo.products) {
            const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product.toString() === productObj.product.toString());
            const relatedSemiIds = productObj.semifinished_details.map(s => s.semifinished_id);
            let latestAchievedQty = 0;

            for (const semiId of relatedSemiIds) {
                const latestProduction = await falconProduction.findOne({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semiId
                }).sort({ createdAt: -1 }).select('product.achieved_quantity').lean();
                if (latestProduction?.product?.achieved_quantity) {
                    latestAchievedQty += latestProduction.product.achieved_quantity;
                }
            }

            const qcs = await falconQCCheck.find({
                job_order: relatedJobOrder._id,
                semifinished_id: { $in: relatedSemiIds }
            }).lean();
            const totalRejected = qcs.reduce((sum, qc) => sum + (qc?.rejected_quantity || 0), 0);

            internalDetails.push({
                product_name: productNamesMap[productObj.product.toString()],
                sales_order_no: iwo.sales_order_no,
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected
            });

            // Build semi-finished details (unchanged)
            const semiFinishedArray = [];
            for (const semi of productObj.semifinished_details) {
                const relatedProductions = await falconProduction.find({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semi.semifinished_id
                }).sort({ createdAt: -1 }).lean();

                const steps = (semi.processes || []).map(proc => {
                    const matchedProd = relatedProductions.find(p =>
                        p.process_name?.toLowerCase().trim() === proc.name?.toLowerCase().trim()
                    );
                    return {
                        step_name: proc.name || '',
                        file_url: proc.file_url || '',
                        remarks: proc.remarks || '',
                        po_quantity: matchedProd?.product?.po_quantity || 0,
                        planned_quantity: matchedProd?.product?.planned_quantity || 0,
                        achieved_quantity: matchedProd?.product?.achieved_quantity || 0,
                        rejected_quantity: matchedProd?.product?.rejected_quantity || 0
                    };
                });

                semiFinishedArray.push({
                    semifinished_id: semi.semifinished_id,
                    file_url: semi.file_url || '',
                    remarks: semi.remarks || '',
                    packing_details: semi.packing_details || '',
                    dispatch_details: semi.dispatch_details || '',
                    steps
                });
            }

            jobOrderSemiDetails.push({
                job_order_id: relatedJobOrder?.job_order_id,
                sales_order_no: iwo.sales_order_no,
                product_name: productNamesMap[productObj.product.toString()],
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected,
                semi_finished_details: semiFinishedArray
            });
        }
    }

    // Fetch packing details for all job orders
    const packingDetails = [];
    for (const jobOrder of jobOrders) {
        const packingDocs = await falconPacking.find({
            job_order_id: jobOrder._id,
            delivery_stage: "Packed"
        })
        .populate('product', 'name uom')
        .populate('packed_by', 'username')
        .lean();

        const productMap = {};
        for (const doc of packingDocs) {
            const productId = doc.product?._id?.toString();
            const productName = doc.product?.name || 'N/A';
            const uom = doc.product?.uom || 'nos';
            const sfId = doc.semi_finished_id;
            if (!productMap[productId]) {
                productMap[productId] = { productId, productName, uom, semiFinishedProducts: {} };
            }
            if (!productMap[productId].semiFinishedProducts[sfId]) {
                productMap[productId].semiFinishedProducts[sfId] = { sfId, quantity: 0, qrCodes: [] };
            }
            productMap[productId].semiFinishedProducts[sfId].quantity += doc.semi_finished_quantity || 0;
            productMap[productId].semiFinishedProducts[sfId].qrCodes.push({
                code: doc.qr_id,
                url: doc.qr_code,
            });
        }

        if (Object.keys(productMap).length > 0) {
            packingDetails.push({
                workOrderId: workOrder.work_order_number,
                jobOrder: jobOrder.job_order_id,
                status: "Packed",
                createdBy: jobOrder.created_by?.username || 'N/A',
                timestamp: jobOrder.createdAt,
                products: Object.values(productMap).map((prod) => ({
                    ...prod,
                    semiFinishedProducts: Object.values(prod.semiFinishedProducts),
                })),
            });
        }
    }

    // Fetch dispatch details for all job orders
    const dispatchDetails = [];
    for (const jobOrder of jobOrders) {
        const dispatchDocs = await falocnDispatch.find({ job_order: jobOrder._id })
            .populate('products.product_id', 'name')
            .lean();

        const dispatchProducts = dispatchDocs.map((dispatch) => {
            const products = dispatch.products.map((product) => {
                const jobOrderProduct = jobOrder.products.find(
                    (p) => p.product.toString() === product.product_id.toString()
                );
                return {
                    productName: product.product_name || 'N/A',
                    productId: product.product_id.toString(),
                    dispatchQty: product.dispatch_quantity || 0,
                    uom: jobOrderProduct?.uom || 'nos',
                };
            });

            return {
                dispatchId: dispatch._id.toString(),
                jobOrder: jobOrder.job_order_id,
                workOrderId: workOrder.work_order_number,
                status: dispatch.status || 'Approved',
                timestamp: dispatch.date,
                vehicleNumber: dispatch.vehicle_number,
                createdBy: dispatch.created_by?.toString() || 'N/A',
                products,
            };
        });

        dispatchDetails.push(...dispatchProducts);
    }

    // Format the work order and include all details
    const formattedWorkOrder = formatDateToIST(workOrder);
    formattedWorkOrder.products = productsWithNames;
    formattedWorkOrder.internal_work_order_details = internalDetails;
    formattedWorkOrder.jobOrderDetailsWithSemiFinished = jobOrderSemiDetails; // Renamed field
    formattedWorkOrder.packing_details = packingDetails; // Add packing details
    formattedWorkOrder.dispatch_details = dispatchDetails; // Add dispatch details

    return res.status(200).json(
        new ApiResponse(200, formattedWorkOrder, `Work order data for ID ${id} found.`)
    );
});



const getFalconWorkOrderById_12_09_2025_3_PM = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    // Fetch work order (without products)
    const workOrder = await falconWorkOrder.findById(id)
        .select('work_order_number client_id project_id files date remarks createdAt updatedAt')
        .populate({ path: 'client_id', select: 'name address', match: { isDeleted: false } })
        .populate({ path: 'project_id', select: 'name address', match: { isDeleted: false } })
        .lean();

    if (!workOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    // Fetch all job orders linked to this work order
    const jobOrders = await falconJobOrder.find({ work_order_number: id })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .lean();

    // Fetch internal work orders for these job orders
    const internalWorkOrders = await falconInternalWorkOrder.find({
        job_order_id: { $in: jobOrders.map(j => j._id) }
    }).lean();

    // Fetch system and product system names
    const systemIds = new Set();
    const productSystemIds = new Set();
    internalWorkOrders.forEach(iwo => {
        iwo.products.forEach(prod => {
            systemIds.add(prod.system?.toString());
            productSystemIds.add(prod.product_system?.toString());
        });
    });

    const systemDocs = await falconSystem.find({ _id: { $in: Array.from(systemIds) } }).select('name').lean();
    const productSystemDocs = await falconProductSystem.find({ _id: { $in: Array.from(productSystemIds) } }).select('name').lean();
    const systemNameMap = Object.fromEntries(systemDocs.map(sys => [sys._id.toString(), sys.name]));
    const productSystemNameMap = Object.fromEntries(productSystemDocs.map(psys => [psys._id.toString(), psys.name]));

    // Fetch product names
    const allProductIds = internalWorkOrders.flatMap(iwo => iwo.products.map(p => p.product));
    const productDocs = await falconProduct.find({ _id: { $in: allProductIds } }).select('name').lean();
    const productNamesMap = Object.fromEntries(productDocs.map(prod => [prod._id.toString(), prod.name]));

    // Add product names to the products array (from job orders)
    const allJobOrderProducts = jobOrders.flatMap(jo => jo.products);
    const productsWithNames = allJobOrderProducts.map(product => ({
        ...product,
        product_name: productNamesMap[product.product.toString()] || 'Unknown Product'
    }));

    // Original logic for internal_work_order_details and job_order_semi_details
    const internalDetails = [];
    const jobOrderSemiDetails = [];

    for (const iwo of internalWorkOrders) {
        const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());
        for (const productObj of iwo.products) {
            const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product.toString() === productObj.product.toString());
            const relatedSemiIds = productObj.semifinished_details.map(s => s.semifinished_id);
            let latestAchievedQty = 0;

            for (const semiId of relatedSemiIds) {
                const latestProduction = await falconProduction.findOne({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semiId
                }).sort({ createdAt: -1 }).select('product.achieved_quantity').lean();
                if (latestProduction?.product?.achieved_quantity) {
                    latestAchievedQty += latestProduction.product.achieved_quantity;
                }
            }

            const qcs = await falconQCCheck.find({
                job_order: relatedJobOrder._id,
                semifinished_id: { $in: relatedSemiIds }
            }).lean();
            const totalRejected = qcs.reduce((sum, qc) => sum + (qc?.rejected_quantity || 0), 0);

            internalDetails.push({
                product_name: productNamesMap[productObj.product.toString()],
                sales_order_no: iwo.sales_order_no,
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected
            });

            const semiFinishedArray = [];
            for (const semi of productObj.semifinished_details) {
                const relatedProductions = await falconProduction.find({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semi.semifinished_id
                }).sort({ createdAt: -1 }).lean();

                const steps = (semi.processes || []).map(proc => {
                    const matchedProd = relatedProductions.find(p =>
                        p.process_name?.toLowerCase().trim() === proc.name?.toLowerCase().trim()
                    );
                    return {
                        step_name: proc.name || '',
                        file_url: proc.file_url || '',
                        remarks: proc.remarks || '',
                        po_quantity: matchedProd?.product?.po_quantity || 0,
                        planned_quantity: matchedProd?.product?.planned_quantity || 0,
                        achieved_quantity: matchedProd?.product?.achieved_quantity || 0,
                        rejected_quantity: matchedProd?.product?.rejected_quantity || 0
                    };
                });

                semiFinishedArray.push({
                    semifinished_id: semi.semifinished_id,
                    file_url: semi.file_url || '',
                    remarks: semi.remarks || '',
                    packing_details: semi.packing_details || '',
                    dispatch_details: semi.dispatch_details || '',
                    steps
                });
            }

            jobOrderSemiDetails.push({
                job_order_id: relatedJobOrder?.job_order_id,
                sales_order_no: iwo.sales_order_no,
                product_name: productNamesMap[productObj.product.toString()],
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected,
                semi_finished_details: semiFinishedArray
            });
        }
    }

    // New logic for jobOrderDetailsWithSemiFinished
    const jobOrderDetailsWithSemiFinished = await Promise.all(
        internalWorkOrders.flatMap(async iwo => {
            const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());
            return Promise.all(
                iwo.products.map(async prod => {
                    const productId = prod.product?.toString();
                    const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product?._id.toString() === productId);
                    let achievedQty = 0;
                    const semiFinishedDetails = [];
                    let semiResults = [];

                    if (prod.semifinished_details?.length > 0) {
                        for (const semi of prod.semifinished_details) {
                            const lastProcess = semi.processes?.[semi.processes.length - 1];
                            let semiAchieved = 0;
                            let isComplete = false;

                            if (lastProcess) {
                                const productionDoc = await falconProduction.findOne({
                                    job_order: iwo.job_order_id,
                                    'product.product_id': productId,
                                    semifinished_id: semi.semifinished_id,
                                    process_name: { $regex: `^${lastProcess.name}$`, $options: 'i' },
                                }).lean();
                                if (productionDoc) {
                                    semiAchieved = productionDoc.product.achieved_quantity || 0;
                                    isComplete = semiAchieved >= prod.po_quantity;
                                }
                            }
                            semiResults.push({ achievedQty: semiAchieved, isComplete });

                            // Fetch packing and dispatch for semi-finished
                            const packingDocs = await falconPacking.find({
                                job_order_id: iwo.job_order_id,
                                product: prod.product,
                                semi_finished_id: semi.semifinished_id,
                            }).lean();
                            const packed_qty = packingDocs.reduce((sum, doc) => sum + (doc.semi_finished_quantity || 0), 0);
                            const packingIds = packingDocs.map(doc => doc._id);

                            const dispatchDocs = await falocnDispatch.find({
                                job_order: iwo.job_order_id,
                                packing_ids: { $in: packingIds },
                            }).lean();
                            let dispatch_qty = 0;
                            dispatchDocs.forEach(dispatch => {
                                dispatch.products.forEach(product => {
                                    if (
                                        product.product_id?.toString() === prod.product?.toString() &&
                                        product.semi_finished_id === semi.semifinished_id
                                    ) {
                                        dispatch_qty += product.dispatch_quantity || 0;
                                    }
                                });
                            });

                            semiFinishedDetails.push({
                                semifinished_id: semi.semifinished_id,
                                file_url: semi.file_url || '',
                                remarks: semi.remarks || '',
                                packed_qty,
                                dispatch_qty,
                                processes: await Promise.all(
                                    semi.processes.map(async proc => {
                                        const production = await falconProduction.findOne({
                                            job_order: iwo.job_order_id,
                                            'product.product_id': prod.product,
                                            semifinished_id: semi.semifinished_id,
                                            process_name: { $regex: `^${proc.name}$`, $options: 'i' },
                                        }).lean();
                                        return {
                                            name: proc.name,
                                            file_url: proc.file_url || '',
                                            remarks: proc.remarks || '',
                                            achievedQty: production?.product?.achieved_quantity || 0,
                                        };
                                    })
                                ),
                            });
                        }
                        const allComplete = semiResults.every(s => s.isComplete);
                        if (allComplete) {
                            achievedQty += prod.po_quantity;
                        }
                    }

                    // Fetch QC rejected quantity
                    const qcDocs = await falconQCCheck.find({
                        job_order: iwo.job_order_id,
                        product_id: prod.product,
                    }).lean();
                    const rejectedQty = qcDocs.reduce((sum, doc) => sum + (doc.rejected_quantity || 0), 0);

                    return {
                        job_order_id: relatedJobOrder?.job_order_id || 'N/A',
                        product_id: prod.product?.toString(),
                        sales_order_no: iwo.sales_order_no || 'N/A',
                        job_order_db_id: iwo.job_order_id,
                        date: iwo.date,
                        system: prod.system,
                        system_name: systemNameMap[prod.system?.toString()] || 'N/A',
                        product_system: prod.product_system,
                        product_system_name: productSystemNameMap[prod.product_system?.toString()] || 'N/A',
                        po_quantity: prod.po_quantity,
                        achievedQty,
                        rejectedQty,
                        semiFinishedDetails,
                    };
                })
            );
        }).flat()
    );

    // New logic for packing_details
    const rawPackingDocs = await falconPacking
        .find({ work_order: id, delivery_stage: 'Packed' })
        .populate('product', 'name uom')
        .populate('packed_by', 'username')
        .lean();

    const productMap = {};
    for (const doc of rawPackingDocs) {
        const productId = doc.product?._id?.toString();
        const productName = doc.product?.name || 'N/A';
        const uom = doc.product?.uom || 'nos';
        const sfId = doc.semi_finished_id;

        if (!productMap[productId]) {
            productMap[productId] = { productId, productName, uom, semiFinishedProducts: {} };
        }
        if (!productMap[productId].semiFinishedProducts[sfId]) {
            productMap[productId].semiFinishedProducts[sfId] = { sfId, quantity: 0, qrCodes: [] };
        }
        productMap[productId].semiFinishedProducts[sfId].quantity += doc.semi_finished_quantity || 0;
        productMap[productId].semiFinishedProducts[sfId].qrCodes.push({
            code: doc.qr_id || 'N/A',
            url: doc.qr_code || '',
        });
    }

    const packing_details = Object.keys(productMap).length > 0 ? [{
        workOrderId: workOrder.work_order_number,
        jobOrder: jobOrders.map(jo => jo.job_order_id).join(', ') || 'N/A',
        status: 'Packed',
        createdBy: workOrder.created_by?.username || 'N/A',
        timestamp: workOrder.createdAt,
        products: Object.values(productMap).map(prod => ({
            ...prod,
            semiFinishedProducts: Object.values(prod.semiFinishedProducts),
        })),
    }] : [];

    // New logic for dispatch_details
    const rawDispatchDocs = await falocnDispatch
        .find({ job_order: { $in: jobOrders.map(jo => jo._id) } })
        .populate('products.product_id', 'name')
        .lean();

    const dispatch_details = rawDispatchDocs.map(dispatch => {
        const relatedJobOrder = jobOrders.find(jo => jo._id.toString() === dispatch.job_order.toString());
        const products = dispatch.products.map(product => {
            const jobOrderProduct = relatedJobOrder?.products.find(
                p => p.product._id.toString() === product.product_id.toString()
            );
            return {
                productName: product.product_id?.name || 'N/A',
                productId: product.product_id._id.toString(),
                dispatchQty: product.dispatch_quantity || 0,
                uom: jobOrderProduct?.uom || 'nos',
            };
        });

        return {
            dispatchId: dispatch._id.toString(),
            jobOrder: relatedJobOrder?.job_order_id || 'N/A',
            workOrderId: workOrder.work_order_number,
            status: dispatch.status || 'Approved',
            timestamp: dispatch.date,
            vehicleNumber: dispatch.vehicle_number || 'N/A',
            createdBy: dispatch.created_by?.toString() || 'N/A',
            products,
        };
    });

    // Format the work order and retain original structure
    const formattedWorkOrder = formatDateToIST(workOrder);
    formattedWorkOrder.products = productsWithNames;
    formattedWorkOrder.internal_work_order_details = internalDetails;
    formattedWorkOrder.job_order_semi_details = jobOrderSemiDetails;
    formattedWorkOrder.jobOrderDetailsWithSemiFinished = jobOrderDetailsWithSemiFinished;
    formattedWorkOrder.packing_details = packing_details;
    formattedWorkOrder.dispatch_details = dispatch_details;

    return res.status(200).json(
        new ApiResponse(200, formattedWorkOrder, `Work order data for ID ${id} found.`)
    );
});







const getFalconWorkOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    // Fetch work order (without products)
    const workOrder = await falconWorkOrder.findById(id)
        .select('work_order_number client_id project_id files date remarks createdAt updatedAt')
        .populate({ path: 'client_id', select: 'name address', match: { isDeleted: false } })
        .populate({ path: 'project_id', select: 'name address', match: { isDeleted: false } })
        .lean();

    if (!workOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    // Fetch all job orders linked to this work order
    const jobOrders = await falconJobOrder.find({ work_order_number: id })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .lean();

    // Fetch internal work orders for these job orders
    const internalWorkOrders = await falconInternalWorkOrder.find({
        job_order_id: { $in: jobOrders.map(j => j._id) }
    }).lean();

    // Fetch system and product system names
    const systemIds = new Set();
    const productSystemIds = new Set();
    internalWorkOrders.forEach(iwo => {
        iwo.products.forEach(prod => {
            systemIds.add(prod.system?.toString());
            productSystemIds.add(prod.product_system?.toString());
        });
    });

    const systemDocs = await falconSystem.find({ _id: { $in: Array.from(systemIds) } }).select('name').lean();
    const productSystemDocs = await falconProductSystem.find({ _id: { $in: Array.from(productSystemIds) } }).select('name').lean();
    const systemNameMap = Object.fromEntries(systemDocs.map(sys => [sys._id.toString(), sys.name]));
    const productSystemNameMap = Object.fromEntries(productSystemDocs.map(psys => [psys._id.toString(), psys.name]));

    // Fetch product names
    const allProductIds = internalWorkOrders.flatMap(iwo => iwo.products.map(p => p.product));
    const productDocs = await falconProduct.find({ _id: { $in: allProductIds } }).select('name').lean();
    console.log("productDocs",productDocs);
    const productNamesMap = Object.fromEntries(productDocs.map(prod => [prod._id.toString(), prod.name]));
    console.log("productNamesMap",productNamesMap);

    // Add product names to the products array (from job orders)
    const allJobOrderProducts = jobOrders.flatMap(jo => jo.products);
    const productsWithNames = allJobOrderProducts.map(product => ({
        ...product,
        product_name: productNamesMap[product.product.toString()] || 'Unknown Product'
    }));

    // Original logic for internal_work_order_details and job_order_semi_details
    const internalDetails = [];
    const jobOrderSemiDetails = [];

    for (const iwo of internalWorkOrders) {
        const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());
        for (const productObj of iwo.products) {
            const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product.toString() === productObj.product.toString());
            const relatedSemiIds = productObj.semifinished_details.map(s => s.semifinished_id);
            let latestAchievedQty = 0;

            for (const semiId of relatedSemiIds) {
                const latestProduction = await falconProduction.findOne({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semiId
                }).sort({ createdAt: -1 }).select('product.achieved_quantity').lean();
                if (latestProduction?.product?.achieved_quantity) {
                    latestAchievedQty += latestProduction.product.achieved_quantity;
                }
            }

            const qcs = await falconQCCheck.find({
                job_order: relatedJobOrder._id,
                semifinished_id: { $in: relatedSemiIds }
            }).lean();
            const totalRejected = qcs.reduce((sum, qc) => sum + (qc?.rejected_quantity || 0), 0);

            internalDetails.push({
                product_name: productNamesMap[productObj.product.toString()],
                sales_order_no: iwo.sales_order_no,
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.width || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected
            });

            const semiFinishedArray = [];
            for (const semi of productObj.semifinished_details) {
                const relatedProductions = await falconProduction.find({
                    job_order: relatedJobOrder._id,
                    semifinished_id: semi.semifinished_id
                }).sort({ createdAt: -1 }).lean();

                const steps = (semi.processes || []).map(proc => {
                    const matchedProd = relatedProductions.find(p =>
                        p.process_name?.toLowerCase().trim() === proc.name?.toLowerCase().trim()
                    );
                    return {
                        step_name: proc.name || '',
                        file_url: proc.file_url || '',
                        remarks: proc.remarks || '',
                        po_quantity: matchedProd?.product?.po_quantity || 0,
                        planned_quantity: matchedProd?.product?.planned_quantity || 0,
                        achieved_quantity: matchedProd?.product?.achieved_quantity || 0,
                        rejected_quantity: matchedProd?.product?.rejected_quantity || 0
                    };
                });

                semiFinishedArray.push({
                    semifinished_id: semi.semifinished_id,
                    file_url: semi.file_url || '',
                    remarks: semi.remarks || '',
                    packing_details: semi.packing_details || '',
                    dispatch_details: semi.dispatch_details || '',
                    steps
                });
            }

            jobOrderSemiDetails.push({
                job_order_id: relatedJobOrder?.job_order_id,
                sales_order_no: iwo.sales_order_no,
                product_name: productNamesMap[productObj.product.toString()],
                system: systemNameMap[productObj.system?.toString()] || '',
                product_system: productSystemNameMap[productObj.product_system?.toString()] || '',
                uom: relatedJobProduct?.uom || '',
                color_code: relatedJobProduct?.color_code || '',
                code: relatedJobProduct?.code || '',
                width: relatedJobProduct?.width || '',
                height: relatedJobProduct?.height || '',
                po_quantity: relatedJobProduct?.po_quantity || '',
                range_date: {
                    from_date: iwo.date?.from,
                    to_date: iwo.date?.to,
                },
                achieved_quantity: latestAchievedQty,
                rejected_quantity: totalRejected,
                semi_finished_details: semiFinishedArray
            });
        }
    }

    // Updated logic for jobOrderDetailsWithSemiFinished (flat array)
    const jobOrderDetailsWithSemiFinished = [];
    for (const iwo of internalWorkOrders) {
        const relatedJobOrder = jobOrders.find(j => j._id.toString() === iwo.job_order_id.toString());
        for (const prod of iwo.products) {
            const productId = prod.product?.toString();
            const relatedJobProduct = relatedJobOrder?.products?.find(p => p.product?._id.toString() === productId);
            let achievedQty = 0;
            const semiFinishedDetails = [];
            let semiResults = [];

            if (prod.semifinished_details?.length > 0) {
                for (const semi of prod.semifinished_details) {
                    const lastProcess = semi.processes?.[semi.processes.length - 1];
                    let semiAchieved = 0;
                    let isComplete = false;

                    if (lastProcess) {
                        const productionDoc = await falconProduction.findOne({
                            job_order: iwo.job_order_id,
                            'product.product_id': productId,
                            semifinished_id: semi.semifinished_id,
                            process_name: { $regex: `^${lastProcess.name}$`, $options: 'i' },
                        }).lean();
                        if (productionDoc) {
                            semiAchieved = productionDoc.product.achieved_quantity || 0;
                            isComplete = semiAchieved >= prod.po_quantity;
                        }
                    }
                    semiResults.push({ achievedQty: semiAchieved, isComplete });

                    // Fetch packing and dispatch for semi-finished
                    const packingDocs = await falconPacking.find({
                        job_order_id: iwo.job_order_id,
                        product: prod.product,
                        semi_finished_id: semi.semifinished_id,
                    }).lean();
                    const packed_qty = packingDocs.reduce((sum, doc) => sum + (doc.semi_finished_quantity || 0), 0);
                    const packingIds = packingDocs.map(doc => doc._id);

                    const dispatchDocs = await falocnDispatch.find({
                        job_order: iwo.job_order_id,
                        packing_ids: { $in: packingIds },
                    }).lean();
                    let dispatch_qty = 0;
                    dispatchDocs.forEach(dispatch => {
                        dispatch.products.forEach(product => {
                            if (
                                product.product_id?.toString() === prod.product?.toString() &&
                                product.semi_finished_id === semi.semifinished_id
                            ) {
                                dispatch_qty += product.dispatch_quantity || 0;
                            }
                        });
                    });

                    semiFinishedDetails.push({
                        semifinished_id: semi.semifinished_id,
                        file_url: semi.file_url || '',
                        remarks: semi.remarks || '',
                        packed_qty,
                        dispatch_qty,
                        processes: semi.processes.map(async proc => {
                            const processProduction = await falconProduction.findOne({
                                job_order: iwo.job_order_id,
                                'product.product_id': prod.product,
                                semifinished_id: semi.semifinished_id,
                                process_name: { $regex: `^${proc.name}$`, $options: 'i' },
                            }).lean();
                            return {
                                name: proc.name,
                                file_url: proc.file_url || '',
                                remarks: proc.remarks || '',
                                achievedQty: processProduction?.product?.achieved_quantity || 0,
                            };
                        }),
                    });

                    // Resolve promises for processes
                    semiFinishedDetails[semiFinishedDetails.length - 1].processes = await Promise.all(
                        semiFinishedDetails[semiFinishedDetails.length - 1].processes
                    );
                }
                const allComplete = semiResults.every(s => s.isComplete);
                if (allComplete) {
                    achievedQty += prod.po_quantity;
                }
            }

            // Fetch QC rejected quantity
            const qcDocs = await falconQCCheck.find({
                job_order: iwo.job_order_id,
                product_id: prod.product,
            }).lean();
            const rejectedQty = qcDocs.reduce((sum, doc) => sum + (doc.rejected_quantity || 0), 0);

            jobOrderDetailsWithSemiFinished.push({
                job_order_id: relatedJobOrder?.job_order_id || 'N/A',
                product_id: prod.product?.toString(),
                sales_order_no: iwo.sales_order_no || 'N/A',
                job_order_db_id: iwo.job_order_id.toString(),
                date: iwo.date || {},
                system: prod.system,
                system_name: systemNameMap[prod.system?.toString()] || 'N/A',
                product_system: prod.product_system,
                product_system_name: productSystemNameMap[prod.product_system?.toString()] || 'N/A',
                po_quantity: prod.po_quantity,
                achievedQty,
                rejectedQty,
                semiFinishedDetails,
            });
        }
    }

    // Logic for packing_details
    const rawPackingDocs = await falconPacking
        .find({ work_order: id, delivery_stage: 'Packed' })
        .populate('product', 'name uom')
        .populate('packed_by', 'username')
        .lean();

    const productMap = {};
    for (const doc of rawPackingDocs) {
        const productId = doc.product?._id?.toString();
        const productName = doc.product?.name || 'N/A';
        const uom = doc.product?.uom || 'nos';
        const sfId = doc.semi_finished_id;

        if (!productMap[productId]) {
            productMap[productId] = { productId, productName, uom, semiFinishedProducts: {} };
        }
        if (!productMap[productId].semiFinishedProducts[sfId]) {
            productMap[productId].semiFinishedProducts[sfId] = { sfId, quantity: 0, qrCodes: [] };
        }
        productMap[productId].semiFinishedProducts[sfId].quantity += doc.semi_finished_quantity || 0;
        productMap[productId].semiFinishedProducts[sfId].qrCodes.push({
            code: doc.qr_id || 'N/A',
            url: doc.qr_code || '',
        });
    }

    const packing_details = Object.keys(productMap).length > 0 ? [{
        workOrderId: workOrder.work_order_number,
        jobOrder: jobOrders.map(jo => jo.job_order_id).join(', ') || 'N/A',
        status: 'Packed',
        createdBy: workOrder.created_by?.username || 'N/A',
        timestamp: workOrder.createdAt,
        products: Object.values(productMap).map(prod => ({
            ...prod,
            semiFinishedProducts: Object.values(prod.semiFinishedProducts),
        })),
    }] : [];

    // Logic for dispatch_details
    const rawDispatchDocs = await falocnDispatch
        .find({ job_order: { $in: jobOrders.map(jo => jo._id) } })
        .populate('products.product_id', 'name')
        .lean();

    const dispatch_details = rawDispatchDocs.map(dispatch => {
        const relatedJobOrder = jobOrders.find(jo => jo._id.toString() === dispatch.job_order.toString());
        const products = dispatch.products.map(product => {
            const jobOrderProduct = relatedJobOrder?.products.find(
                p => p.product._id.toString() === product.product_id.toString()
            );
            return {
                productName: product.product_id?.name || 'N/A',
                productId: product.product_id._id.toString(),
                dispatchQty: product.dispatch_quantity || 0,
                uom: jobOrderProduct?.uom || 'nos',
            };
        });

        return {
            dispatchId: dispatch._id.toString(),
            jobOrder: relatedJobOrder?.job_order_id || 'N/A',
            workOrderId: workOrder.work_order_number,
            status: dispatch.status || 'Approved',
            timestamp: dispatch.date,
            vehicleNumber: dispatch.vehicle_number || 'N/A',
            createdBy: dispatch.created_by?.toString() || 'N/A',
            products,
        };
    });

    // Format the work order and retain original structure
    const formattedWorkOrder = formatDateToIST(workOrder);
    formattedWorkOrder.products = productsWithNames;
    formattedWorkOrder.internal_work_order_details = internalDetails;
    formattedWorkOrder.job_order_semi_details = jobOrderSemiDetails;
    formattedWorkOrder.jobOrderDetailsWithSemiFinished = jobOrderDetailsWithSemiFinished;
    formattedWorkOrder.packing_details = packing_details;
    formattedWorkOrder.dispatch_details = dispatch_details;

    return res.status(200).json(
        new ApiResponse(200, formattedWorkOrder, `Work order data for ID ${id} found.`)
    );
});








const deleteFalconWorkOrder = asyncHandler(async (req, res) => {
    let ids = req.body.ids;
    console.log('ids', ids);

    // Validate input
    if (!ids) {
        return res.status(400).json(new ApiResponse(400, null, 'No IDs provided'));
    }

    // Convert single ID to array if needed
    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    // Check for empty array
    if (ids.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'IDs array cannot be empty'));
    }

    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
    }

    // Permanent deletion
    // const result = await WorkOrder.deleteMany({ _id: { $in: ids } });
    const result = await falconWorkOrder.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
        return res.status(404).json(new ApiResponse(404, null, 'No work orders found to delete'));
    }

    return res.status(200).json(new ApiResponse(200, {
        deletedCount: result.deletedCount,
        deletedIds: ids
    }, `${result.deletedCount} work order(s) deleted successfully`));
});

const getFalconProjectBasedOnClient = async (req, res, next) => {
    try {
        console.log("came in get projects");
        const clientId = req.query.clientId;
        console.log("body", clientId);

        let getProjectByClient = await falconProject.find({ client: clientId }).select({ name: 1 });
        console.log("getProjectByClient", getProjectByClient);

        const validProjects = getProjectByClient.filter((project) => project.client !== null);

        if (!validProjects || validProjects.length === 0) {
            return next(new ApiError(404, 'No active projects found for this client'));
        }

        // return res.status(200).json(
        //   new ApiResponse(200, validProjects, 'Projects fetched successfully')
        // );
        return res.status(200).json({ success: true, message: "Projects", data: validProjects });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const formattedErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message,
            }));
            return res.status(400).json({ success: false, errors: formattedErrors });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ${error.path}: ${error.value}`,
            });
        }

        // Handle other errors
        console.error("Error fetching work orders:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export { createFalconWorkOrder, getFalconWorkOrders, getFalconWorkOrderById, getFalconProjectBasedOnClient, updateFalconWorkOrder, deleteFalconWorkOrder };