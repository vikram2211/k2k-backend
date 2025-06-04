
import { falconCounter } from '../../models/falconFacade/falconCouner.model.js';
import mongoose from 'mongoose';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { falconJobOrder } from '../../models/falconFacade/falconJobOrder.model.js';
import { formatDateToIST } from '../../utils/formatDate.js';
import { putObject } from '../../../util/putObject.js';
import { z } from 'zod';




const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

// Helper function to sanitize filenames
const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

// Create a new job order
const createFalconJobOrder = asyncHandler(async (req, res) => {
    // 1. Validation schema
    const productSchema = Joi.object({
        product: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        code: Joi.string().required().messages({ 'string.empty': 'Product code is required' }),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        po_quantity: Joi.number().min(0).required().messages({
            'number.base': 'PO quantity must be a number',
            'number.min': 'PO quantity must be non-negative',
        }),
        color_code: Joi.string().required().messages({ 'string.empty': 'Color code is required' }),
        width: Joi.number().min(0).required().messages({
            'number.base': 'Width must be a number',
            'number.min': 'Width must be non-negative',
        }),
        height: Joi.number().min(0).required().messages({
            'number.base': 'Height must be a number',
            'number.min': 'Height must be non-negative',
        }),
    });

    const fileSchema = Joi.object({
        file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
        file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
        uploaded_at: Joi.date().optional(),
    });

    const jobOrderSchema = Joi.object({
        job_order_id: Joi.string().required().messages({ 'string.empty': 'Job order ID is required' }),
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
        prod_issued_approved_by: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product issued approved by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        prod_recieved_by: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product received by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        date: Joi.date().optional(),
        prod_requset_date: Joi.date().required().messages({ 'date.base': 'Product request date is required and must be a valid date' }),
        prod_requirement_date: Joi.date().required().messages({ 'date.base': 'Product requirement date is required and must be a valid date' }),
        remarks: Joi.string().required().messages({ 'string.empty': 'Remarks are required' }),
        products: Joi.array().items(productSchema).min(1).required().messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array().items(fileSchema).optional(),
        status: Joi.string()
            .valid('Pending', 'Approved', 'Rejected', 'In Progress')
            .default('Pending')
            .messages({ 'any.only': 'Status must be Pending, Approved, Rejected, or In Progress' })
            .optional(),
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
    console.log('bodyData', bodyData);
    const userId = req.user?._id?.toString();
    console.log('userId', userId);

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // 3. Parse stringified fields if needed
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 4. Generate job_order_id
    const counter = await falconCounter.findOneAndUpdate(
        { _id: 'job_order' },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    const jobOrderId = `JO-${String(counter.sequence_value).padStart(3, '0')}`;

    // 5. Handle file uploads
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
        try {
            for (const file of req.files) {
                const tempFilePath = path.join('./public/temp', file.filename);
                const fileBuffer = fs.readFileSync(tempFilePath);
                const sanitizedFilename = sanitizeFilename(file.originalname);
                console.log('filename', file.originalname);
                console.log('sanitizedFilename', sanitizedFilename);

                // Upload to S3
                const { url } = await putObject(
                    { data: fileBuffer, mimetype: file.mimetype },
                    `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
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

    // 6. Prepare job order data
    const jobOrderData = {
        job_order_id: jobOrderId,
        client_id: bodyData.client_id,
        project_id: bodyData.project_id,
        work_order_number: bodyData.work_order_number,
        prod_issued_approved_by: bodyData.prod_issued_approved_by,
        prod_recieved_by: bodyData.prod_recieved_by,
        date: bodyData.date ? new Date(bodyData.date) : undefined,
        prod_requset_date: bodyData.prod_requset_date ? new Date(bodyData.prod_requset_date) : undefined,
        prod_requirement_date: bodyData.prod_requirement_date ? new Date(bodyData.prod_requirement_date) : undefined,
        remarks: bodyData.remarks,
        products: bodyData.products,
        files: uploadedFiles,
        status: bodyData.status || 'Pending',
        created_by: userId,
        updated_by: userId,
    };

    // 7. Validate with Joi
    const { error, value } = jobOrderSchema.validate(jobOrderData, { abortEarly: false });
    if (error) {
        // Cleanup temp files on validation error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        throw new ApiError(400, 'Validation failed for job order creation', error.details);
    }

    // 8. Validate referenced documents
    const [client, project, approvedByEmployee, receivedByEmployee, products] = await Promise.all([
        mongoose.model('falconClient').findById(value.client_id),
        mongoose.model('falconProject').findById(value.project_id),
        mongoose.model('Employee').findById(value.prod_issued_approved_by),
        mongoose.model('Employee').findById(value.prod_recieved_by),
        Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product))),
    ]);

    if (!client) throw new ApiError(400, `Client not found with ID: ${value.client_id}`);
    if (!project) throw new ApiError(400, `Project not found with ID: ${value.project_id}`);
    if (!approvedByEmployee) throw new ApiError(404, `Employee not found for prod_issued_approved_by ID: ${value.prod_issued_approved_by}`);
    if (!receivedByEmployee) throw new ApiError(404, `Employee not found for prod_recieved_by ID: ${value.prod_recieved_by}`);
    const invalidProduct = products.findIndex((p) => !p);
    if (invalidProduct !== -1) {
        throw new ApiError(400, `Product not found with ID: ${value.products[invalidProduct].product}`);
    }

    // 9. Save to MongoDB
    const jobOrder = await falconJobOrder.create(value);

    // 10. Populate and format response
    const populatedJobOrder = await falconJobOrder
        .findById(jobOrder._id)
        .populate({
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { is_deleted: false },
        })
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name email',
            match: { isDeleted: false },
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name email',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .lean();

    if (!populatedJobOrder) {
        throw new ApiError(404, 'Failed to retrieve created job order');
    }

    // Convert timestamps to IST
    const formattedJobOrder = formatDateToIST(populatedJobOrder);

    return sendResponse(res, new ApiResponse(201, formattedJobOrder, 'Job order created successfully'));
});


const formatDateOnly = (date) => {
    if (!date || !(date instanceof Date)) return null;
    const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
    return istDate
        .toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        })
        .split('/')
        .join('-');
};

const getFalconJobOrders = asyncHandler(async (req, res) => {
    const jobOrders = await falconJobOrder
        .find()
        .select('_id job_order_id client_id project_id prod_issued_approved_by prod_recieved_by prod_requset_date prod_requirement_date remarks createdAt updatedAt status date')
        .populate({
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name',
            // match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .lean();

    // console.log('jobOrders', jobOrders);

    if (!jobOrders?.length) {
        return sendResponse(res, new ApiResponse(200, [], 'No job orders found'));
    }

    // let createdAtNew = jobOrders.map((jobOrder, index) => { return jobOrder.createdAt });
    // let newCreated = createdAtNew;
    // console.log("newCreated", newCreated);
    // console.log(formatDateToIST(newCreated))

    // Add srNo and format response
    const formattedJobOrders = jobOrders.map((jobOrder, index) => {
        const formatted = {
            srNo: index + 1,
            id: jobOrder._id,
            jobOrderNumber: jobOrder.job_order_id,
            clientDetails: jobOrder.client_id,
            projectDetails: jobOrder.project_id,
            approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
            receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
            productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
            productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
            remarks: jobOrder.remarks,
            createdAt: jobOrder.createdAt,
            updatedAt: jobOrder.updatedAt,
            status: jobOrder.status,
            workOrderDate: formatDateOnly(jobOrder.date),
        };

        return formatted;
    });

    return sendResponse(res, new ApiResponse(200, formattedJobOrders, 'Job orders fetched successfully'));
});
const getFalconJobOrderss = asyncHandler(async (req, res) => {
    const jobOrders = await falconJobOrder
        .find()
        .select('job_order_id client_id project_id prod_issued_approved_by prod_recieved_by prod_requset_date prod_requirement_date remarks createdAt updatedAt status date')
        .populate({
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name',
            // match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .lean();

    if (!jobOrders?.length) {
        return sendResponse(res, new ApiResponse(200, [], 'No job orders found'));
    }
    console.log("jobOrders", jobOrders);

    // Add srNo and format response
    const formattedJobOrders = jobOrders.map((jobOrder, index) => {
        const formatted = formatDateToIST({
            srNo: index + 1,
            jobOrderNumber: jobOrder.job_order_id,
            clientDetails: jobOrder.client_id,
            projectDetails: jobOrder.project_id,
            approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
            receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
            productionRequestDate: jobOrder.prod_requset_date,
            productionRequirementDate: jobOrder.prod_requirement_date,
            remarks: jobOrder.remarks,
            createdAt: jobOrder.createdAt,
            updatedAt: jobOrder.updatedAt,
            status: jobOrder.status,
            workOrderDate: jobOrder.date,
        });

        // Format individual date fields to IST string
        formatted.productionRequestDate = formatted.productionRequestDate
            ? formatDateToIST(formatted.productionRequestDate, true)
            : null;
        formatted.productionRequirementDate = formatted.productionRequirementDate
            ? formatDateToIST(formatted.productionRequirementDate, true)
            : null;
        formatted.workOrderDate = formatted.workOrderDate
            ? formatDateToIST(formatted.workOrderDate, true)
            : null;

        return formatted;
    });

    return sendResponse(res, new ApiResponse(200, formattedJobOrders, 'Job orders fetched successfully'));
});

const updateFalconJobOrder = asyncHandler(async (req, res) => {
    // 1. Get job order ID from params
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid job order ID: ${id}`);
    }

    // 2. Validation schema
    const productSchema = Joi.object({
        product: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        code: Joi.string().required().messages({ 'string.empty': 'Product code is required' }),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        po_quantity: Joi.number().min(0).required().messages({
            'number.base': 'PO quantity must be a number',
            'number.min': 'PO quantity must be non-negative',
        }),
        color_code: Joi.string().required().messages({ 'string.empty': 'Color code is required' }),
        width: Joi.number().min(0).required().messages({
            'number.base': 'Width must be a number',
            'number.min': 'Width must be non-negative',
        }),
        height: Joi.number().min(0).required().messages({
            'number.base': 'Height must be a number',
            'number.min': 'Height must be non-negative',
        }),
    });

    const fileSchema = Joi.object({
        file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
        file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
        uploaded_at: Joi.date().optional(),
    });

    const updateJobOrderSchema = Joi.object({
        client_id: Joi.string().optional()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        project_id: Joi.string().optional()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        work_order_number: Joi.string().optional().messages({ 'string.empty': 'Work order number cannot be empty' }),
        prod_issued_approved_by: Joi.string()
            .optional()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product issued approved by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        prod_recieved_by: Joi.string()
            .optional()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Product received by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        date: Joi.date().optional(),
        prod_requset_date: Joi.date().optional().messages({ 'date.base': 'Product request date must be a valid date' }),
        prod_requirement_date: Joi.date().optional().messages({ 'date.base': 'Product requirement date must be a valid date' }),
        remarks: Joi.string().optional().messages({ 'string.empty': 'Remarks cannot be empty' }),
        products: Joi.array().items(productSchema).min(1).optional().messages({
            'array.min': 'At least one product is required if products are provided',
        }),
        files: Joi.array().items(fileSchema).optional(),
        status: Joi.string()
            .valid('Pending', 'Approved', 'Rejected', 'In Progress')
            .optional()
            .messages({ 'any.only': 'Status must be Pending, Approved, Rejected, or In Progress' }),
            updated_by: Joi.string().optional().custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
    });

    // 3. Parse form-data
    const bodyData = req.body;
    // console.log('bodyData', bodyData);
    const userId = req.user?._id?.toString();
    // console.log('userId', userId);

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // 4. Parse stringified fields if needed
    if (typeof bodyData.products === 'string' && bodyData.products) {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (error) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 5. Handle file uploads
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
        try {
            for (const file of req.files) {
                const tempFilePath = path.join('./public/temp', file.filename);
                const fileBuffer = fs.readFileSync(tempFilePath);
                const sanitizedFilename = sanitizeFilename(file.originalname);
                console.log('filename', file.originalname);
                console.log('sanitizedFilename', sanitizedFilename);

                // Upload to S3
                const { url } = await putObject(
                    { data: fileBuffer, mimetype: file.mimetype },
                    `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
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

    // 6. Prepare job order data for validation
    const jobOrderData = {
        ...(bodyData.client_id && { client_id: bodyData.client_id }),
        ...(bodyData.project_id && { project_id: bodyData.project_id }),
        ...(bodyData.work_order_number && { work_order_number: bodyData.work_order_number }),
        ...(bodyData.prod_issued_approved_by && { prod_issued_approved_by: bodyData.prod_issued_approved_by }),
        ...(bodyData.prod_recieved_by && { prod_recieved_by: bodyData.prod_recieved_by }),
        ...(bodyData.date && { date: new Date(bodyData.date) }),
        ...(bodyData.prod_requset_date && { prod_requset_date: new Date(bodyData.prod_requset_date) }),
        ...(bodyData.prod_requirement_date && { prod_requirement_date: new Date(bodyData.prod_requirement_date) }),
        ...(bodyData.remarks && { remarks: bodyData.remarks }),
        ...(bodyData.products && { products: bodyData.products }),
        ...(bodyData.status && { status: bodyData.status }),
        updated_by: userId,
    };

    // 7. Validate with Joi
    const { error, value } = updateJobOrderSchema.validate(
        { ...jobOrderData, files: uploadedFiles },
        { abortEarly: false }
    );
    if (error) {
        // Cleanup temp files
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        throw new ApiError(400, 'Validation failed for job order update', error.details);
    }

    // 8. Validate referenced documents if provided
    const validationPromises = [];
    if (value.client_id) {
        validationPromises.push(mongoose.model('falconClient').findById(value.client_id));
    }
    if (value.project_id) {
        validationPromises.push(mongoose.model('falconProject').findById(value.project_id));
    }
    if (value.prod_issued_approved_by) {
        validationPromises.push(mongoose.model('Employee').findById(value.prod_issued_approved_by));
    }
    if (value.prod_recieved_by) {
        validationPromises.push(mongoose.model('Employee').findById(value.prod_recieved_by));
    }
    if (value.products) {
        validationPromises.push(
            Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product)))
        );
    }

    const [client, project, approvedByEmployee, receivedByEmployee, products] = await Promise.all(validationPromises);

    if (value.client_id && !client) throw new ApiError(400, `Client not found with ID: ${value.client_id}`);
    if (value.project_id && !project) throw new ApiError(400, `Project not found with ID: ${value.project_id}`);
    if (value.prod_issued_approved_by && !approvedByEmployee) {
        throw new ApiError(404, `Employee not found for prod_issued_approved_by ID: ${value.prod_issued_approved_by}`);
    }
    if (value.prod_recieved_by && !receivedByEmployee) {
        throw new ApiError(404, `Employee not found for prod_rec_by_id ID: ${value.prod_recieved_by}`);
    }
    if (value.products) {
        const invalidProduct = products.findIndex((p) => !p);
        if (invalidProduct !== -1) {
            throw new ApiError(400, `Product not found with ID: ${value.products[invalidProduct].product}`);
        }
    }

    // 9. Prepare MongoDB update
    const updateData = { $set: value };
    if (uploadedFiles.length > 0) {
        updateData.$push = { files: { $each: uploadedFiles } };
    }
    delete updateData.$set.files; // Avoid overwriting files array

    const jobOrder = await falconJobOrder.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    );

    if (!jobOrder) {
        // Cleanup temp files
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        throw new ApiError(404, `Job order not found with ID: ${id}`);
    }

    // 10. Populate and format response
    const populatedJobOrder = await falconJobOrder
        .findById(jobOrder._id)
        .populate({
            path: 'client_id',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { is_deleted: false },
        })
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name email',
            match: { isDeleted: false },
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name email',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .lean();

    if (!populatedJobOrder) {
        throw new ApiError(404, 'Failed to retrieve updated job order');
    }

    // Convert timestamps to IST
    const formattedJobOrder = formatDateToIST(populatedJobOrder);

    return sendResponse(res, new ApiResponse(200, formattedJobOrder, 'Job order updated successfully'));
});

const deleteFalconJobOrder = asyncHandler(async (req, res) => {
    let ids = req.body.ids;
    console.log('ids', ids);
  
    // Validate input
    if (!ids) {
      return sendResponse(res, new ApiResponse(400, null, 'No IDs provided'));
    }
  
    // Convert single ID to array if needed
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
  
    // Check for empty array
    if (ids.length === 0) {
      return sendResponse(res, new ApiResponse(400, null, 'IDs array cannot be empty'));
    }
  
    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return sendResponse(res, new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
    }
  
    // Permanent deletion
    const result = await falconJobOrder.deleteMany({ _id: { $in: ids } });
  
    if (result.deletedCount === 0) {
      return sendResponse(res, new ApiResponse(404, null, 'No job orders found to delete'));
    }
  
    return sendResponse(res, new ApiResponse(200, {
      deletedCount: result.deletedCount,
      deletedIds: ids
    }, `${result.deletedCount} job order(s) deleted successfully`));
  });

export { createFalconJobOrder, getFalconJobOrders, updateFalconJobOrder, deleteFalconJobOrder};