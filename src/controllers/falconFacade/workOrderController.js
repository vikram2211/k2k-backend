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
// import { falconProject } from '../../../models/falconFacade/helpers/falconProject.model.js';

// 



const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_'); // Replace spaces and special chars with underscores
};

// Create a work order
const createFalconWorkOrder = asyncHandler(async (req, res) => {
    try {
        // 1. Validation schema
        const productSchema = Joi.object({
            product_id: Joi.string()
                .required()
                .custom((value, helpers) => {
                    if (!mongoose.Types.ObjectId.isValid(value)) {
                        return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
                    }
                    return value;
                }, 'ObjectId validation'),
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

        // 4. Handle file uploads
        const uploadedFiles = [];
        if (req.files && req.files.length > 0) {
            try {
                for (const file of req.files) {
                    const tempFilePath = path.join('./public/temp', file.filename);
                    const fileBuffer = fs.readFileSync(tempFilePath);
                    const sanitizedFilename = sanitizeFilename(file.originalname);
                    console.log("fimename", file.originalname);
                    console.log("sanitizedFilename", sanitizedFilename);


                    // Upload to S3
                    const { url } = await putObject(
                        { data: fileBuffer, mimetype: file.mimetype },
                        `falcon-work-orders/${Date.now()}-${sanitizedFilename}`
                    );

                    // Delete temp file
                    fs.unlinkSync(tempFilePath);

                    uploadedFiles.push({
                        file_name: file.originalname,
                        file_url: url,
                        uploaded_at: new Date(),
                    });
                }
            } catch (error) {
                // Cleanup temp files on upload error
                if (req.files) {
                    req.files.forEach((file) => {
                        const tempFilePath = path.join('./public/temp', file.filename);
                        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    });
                }
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
        if (invalidProduct !== -1) {
            throw new ApiError(404, `Product not found with ID: ${value.products[invalidProduct].product_id}`);
        }

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
            .populate({
                path: 'products.product_id',
                select: 'name',
                match: { isDeleted: false },
            })
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
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .lean();

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


const updateWorkOrder = asyncHandler(async (req, res) => {
    try {

    } catch (error) {
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
})

const updateFalconWorkOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("id", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    // 1. Validation schema (all fields optional except updated_by)
    const productSchema = Joi.object({
        product_id: Joi.string()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
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
        files: Joi.array().items(fileSchema),
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

    // 4. Handle file uploads
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
        try {
            for (const file of req.files) {
                const tempFilePath = path.join('./public/temp', file.filename);
                const fileBuffer = fs.readFileSync(tempFilePath);
                const sanitizedFilename = sanitizeFilename(file.originalname);

                // Upload to S3
                const { url } = await putObject(
                    { data: fileBuffer, mimetype: file.mimetype },
                    `falcon-work-orders/${Date.now()}-${sanitizedFilename}`
                );

                // Delete temp file
                fs.unlinkSync(tempFilePath);

                uploadedFiles.push({
                    file_name: file.originalname,
                    file_url: url,
                    uploaded_at: new Date(),
                });
            }
        } catch (error) {
            // Cleanup temp files on upload error
            if (req.files) {
                req.files.forEach((file) => {
                    const tempFilePath = path.join('./public/temp', file.filename);
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                });
            }
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
    if (value.products && value.products.length) {
        validationPromises.push(
            Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product_id)))
        );
    }

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
        if (value.products && value.products.length) {
            const products = results[resultIndex];
            const invalidProduct = products.findIndex((p) => !p);
            if (invalidProduct !== -1) {
                throw new ApiError(404, `Product not found with ID: ${value.products[invalidProduct].product_id}`);
            }
        }
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
        .populate({
            path: 'products.product_id',
            select: 'name',
            match: { isDeleted: false },
        })
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

const getFalconWorkOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    const workOrder = await falconWorkOrder
        .findById(id)
        .select('work_order_number client_id project_id products createdAt updatedAt')
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
        .populate({
            path: 'products.product_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .lean();

    if (!workOrder) {
        throw new ApiError(404, `Work order with ID ${id} not found`);
    }

    // Format timestamps to IST
    const formattedWorkOrder = formatDateToIST(workOrder);

    // return sendResponse(
    //   res.json({
    //     success: true,
    //     message: `Work order data for ID ${id} found.`,
    //     data: formattedWorkOrder
    //   })
    // );


    return sendResponse(
        res,
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