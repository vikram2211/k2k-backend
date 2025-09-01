
import { falconCounter } from '../../models/falconFacade/falconCouner.model.js';
import mongoose from 'mongoose';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { falconJobOrder } from '../../models/falconFacade/falconJobOrder.model.js';
import { falconInternalWorkOrder } from '../../models/falconFacade/falconInternalWorder.model.js';
import { falconProduction } from '../../models/falconFacade/falconProduction.model.js';
import { formatDateToIST } from '../../utils/formatDate.js';
import { putObject } from '../../../util/putObject.js';
import { deleteObject } from '../../../util/deleteObject.js';
import { falconWorkOrder } from '../../models/falconFacade/falconWorkOrder.model.js';
import { falconPacking } from '../../models/falconFacade/falconPacking.model.js';
import { falocnDispatch } from '../../models/falconFacade/falconDispatch.model.js';
import { falconQCCheck } from '../../models/falconFacade/falconQcCheck.model.js';
import { falconSystem } from '../../models/falconFacade/helpers/falconSystem.model.js';
import { falconProductSystem } from '../../models/falconFacade/helpers/falconProductSystem.model.js';
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
        // client_id: Joi.string()
        //     .required()
        //     .custom((value, helpers) => {
        //         if (!mongoose.Types.ObjectId.isValid(value)) {
        //             return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
        //         }
        //         return value;
        //     }, 'ObjectId validation'),
        // project_id: Joi.string()
        //     .required()
        //     .custom((value, helpers) => {
        //         if (!mongoose.Types.ObjectId.isValid(value)) {
        //             return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
        //         }
        //         return value;
        //     }, 'ObjectId validation'),
        work_order_number: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Work Order ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
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
            console.log("products", bodyData.products);
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
    // const uploadedFiles = [];
    // if (req.files && req.files.length > 0) {
    //     try {
    //         for (const file of req.files) {
    //             const tempFilePath = path.join('./public/temp', file.filename);
    //             const fileBuffer = fs.readFileSync(tempFilePath);
    //             const sanitizedFilename = sanitizeFilename(file.originalname);
    //             console.log('filename', file.originalname);
    //             console.log('sanitizedFilename', sanitizedFilename);

    //             // Upload to S3
    //             const { url } = await putObject(
    //                 { data: fileBuffer, mimetype: file.mimetype },
    //                 `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
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




        // 5. Handle file uploads
const uploadedFiles = [];
if (req.files && req.files.length > 0) {
    try {
        for (const file of req.files) {
            const sanitizedFilename = sanitizeFilename(file.originalname);

            // Upload directly from memory (buffer)
            const { url } = await putObject(
                { data: file.buffer, mimetype: file.mimetype },
                `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
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





    // 6. Prepare job order data
    const jobOrderData = {
        job_order_id: jobOrderId,
        // client_id: bodyData.client_id,
        // project_id: bodyData.project_id,
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

    // 8. Validate referenced documents //client, project, 
    const [approvedByEmployee, receivedByEmployee, products] = await Promise.all([
        // mongoose.model('falconClient').findById(value.client_id),
        // mongoose.model('falconProject').findById(value.project_id),
        mongoose.model('Employee').findById(value.prod_issued_approved_by),
        mongoose.model('Employee').findById(value.prod_recieved_by),
        Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product))),
    ]);

    // if (!client) throw new ApiError(400, `Client not found with ID: ${value.client_id}`);
    // if (!project) throw new ApiError(400, `Project not found with ID: ${value.project_id}`);
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
        // .populate({
        //     path: 'client_id',
        //     select: 'name address',
        //     match: { isDeleted: false },
        // })
        // .populate({
        //     path: 'project_id',
        //     select: 'name',
        //     match: { isDeleted: false },
        // })
        .populate({
            path: 'products.product',
            select: 'name',
            // match: { is_deleted: false },
        })
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name email',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name email',
            // match: { isDeleted: false },
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
        .select('_id job_order_id prod_issued_approved_by prod_recieved_by prod_requset_date prod_requirement_date remarks createdAt updatedAt status date files created_by')
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name',
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name',
        })
        .populate({
            path: 'created_by',
            select: 'username',
        })
        .populate({
            path: 'work_order_number',
            select: 'client_id project_id work_order_number',
            populate: [
                {
                    path: 'client_id',
                    select: 'name address',
                },
                {
                    path: 'project_id',
                    select: 'name address',
                },
            ],
        })
        .sort({ createdAt: -1 })
        .lean();

    // console.log('jobOrders', jobOrders);
    jobOrders.map((jobOrder, index) => { console.log("jobOrder", jobOrder.work_order_number) })

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
            _id: jobOrder._id,
            jobOrderNumber: jobOrder.job_order_id,
            clientDetails: jobOrder.work_order_number?.client_id?.name || 'N/A',

            projectDetails: jobOrder.work_order_number?.project_id?.name || 'N/A',

            approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
            receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
            productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
            productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
            remarks: jobOrder.remarks,
            createdAt: jobOrder.createdAt,
            updatedAt: jobOrder.updatedAt,
            status: jobOrder.status,
            workOrderDate: formatDateOnly(jobOrder.date),
            createdBy: jobOrder.created_by.username,
        };

        return formatted;
    });

    return sendResponse(res, new ApiResponse(200, formattedJobOrders, 'Job orders fetched successfully'));
});

// const getFalconJobOrderById = asyncHandler(async (req, res) => {
//     // 1. Get job order ID from params
//     const { id } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         throw new ApiError(400, `Invalid job order ID: ${id}`);
//     }

//     // 2. Fetch job order with populated fields
//     const jobOrder = await falconJobOrder
//         .findById(id)
//         // .populate({
//         //     path: 'client_id',
//         //     select: 'name address',
//         //     // match: { isDeleted: false },
//         // })
//         // .populate({
//         //     path: 'project_id',
//         //     select: 'name',
//         //     // match: { isDeleted: false },
//         // })
//         .populate({
//             path: 'work_order_number',
//             select: 'client_id project_id work_order_number',
//             populate: [
//                 {
//                     path: 'client_id',
//                     select: 'name address',
//                 },
//                 {
//                     path: 'project_id',
//                     select: 'name address',
//                 },
//             ],
//         })
//         .populate({
//             path: 'products.product',
//             select: 'name',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'prod_issued_approved_by',
//             select: 'name',
//             // match: { isDeleted: false },
//         })
//         .populate({
//             path: 'prod_recieved_by',
//             select: 'name',
//             // match: { isDeleted: false },
//         })
//         .populate('created_by', 'username email')
//         .populate('updated_by', 'username email')
//         .lean();

//     if (!jobOrder) {
//         throw new ApiError(404, `Job order not found with ID: ${id}`);
//     }
//     console.log("jobOrder", jobOrder);

//     // 3. Format the response
//     const formattedJobOrder = {
//         clientProjectDetails: {
//             clientName: jobOrder.work_order_number?.client_id?.name || 'N/A',
//             clientId: jobOrder.work_order_number?.client_id?._id || null,
//             address: jobOrder.work_order_number?.client_id?.address || 'N/A',
//             projectName: jobOrder.work_order_number?.project_id?.name || 'N/A',
//             projectId: jobOrder.work_order_number?.project_id?._id || null,
//         },
//         workOrderDetails: {
//             workOrderId: jobOrder.work_order_number._id,
//             workOrderNumber: jobOrder.work_order_number.work_order_number,
//             productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
//             productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
//             approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
//             approvedById: jobOrder.prod_issued_approved_by?._id?.toString() || null,
//             receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
//             receivedById: jobOrder.prod_recieved_by?._id?.toString() || null,
//             remarks: jobOrder.remarks,
//             workOrderDate: formatDateOnly(jobOrder.date),
//             file: jobOrder.files.map(file => ({
//                 file_name: file.file_name,
//                 file_url: file.file_url,
//                 uploaded_at: file.uploaded_at,
//                 _id: file._id?.toString(),
//             })),
//             createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0], // Only date part
//             createdBy: jobOrder.created_by?.username || 'N/A',
//         },
//         jobOrderDetails: {
//             jobOrderNumber: jobOrder.job_order_id,
//             createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0], // Only date part
//             createdBy: jobOrder.created_by?.username || 'N/A',
//             status: jobOrder.status,
//         },
//         productsDetails: jobOrder.products.map(product => ({
//             productName: product.product?.name || 'N/A',
//             productId: product.product?._id?.toString() || null,
//             uom: product.uom,
//             code: product.code,
//             colorCode: product.color_code,
//             height: product.height,
//             width: product.width,
//             poQuantity: product.po_quantity,
//             deliveryDate: formatDateOnly(jobOrder.prod_requirement_date),
//         })),
//     };

//     return sendResponse(res, new ApiResponse(200, formattedJobOrder, 'Job order fetched successfully'));
// });


// const updateFalconJobOrder = asyncHandler(async (req, res) => {
//     // 1. Get job order ID from params
//     const { id } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         throw new ApiError(400, `Invalid job order ID: ${id}`);
//     }

//     // 2. Validation schema
//     const productSchema = Joi.object({
//         product: Joi.string()
//             .required()
//             .custom((value, helpers) => {
//                 if (!mongoose.Types.ObjectId.isValid(value)) {
//                     return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
//                 }
//                 return value;
//             }, 'ObjectId validation'),
//         code: Joi.string().required().messages({ 'string.empty': 'Product code is required' }),
//         uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
//         po_quantity: Joi.number().min(0).required().messages({
//             'number.base': 'PO quantity must be a number',
//             'number.min': 'PO quantity must be non-negative',
//         }),
//         color_code: Joi.string().required().messages({ 'string.empty': 'Color code is required' }),
//         width: Joi.number().min(0).required().messages({
//             'number.base': 'Width must be a number',
//             'number.min': 'Width must be non-negative',
//         }),
//         height: Joi.number().min(0).required().messages({
//             'number.base': 'Height must be a number',
//             'number.min': 'Height must be non-negative',
//         }),
//     });

//     const fileSchema = Joi.object({
//         file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
//         file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
//         uploaded_at: Joi.date().optional(),
//     });

//     const updateJobOrderSchema = Joi.object({
//         client_id: Joi.string().optional()
//             .custom((value, helpers) => {
//                 if (!mongoose.Types.ObjectId.isValid(value)) {
//                     return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
//                 }
//                 return value;
//             }, 'ObjectId validation'),
//         project_id: Joi.string().optional()
//             .custom((value, helpers) => {
//                 if (!mongoose.Types.ObjectId.isValid(value)) {
//                     return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
//                 }
//                 return value;
//             }, 'ObjectId validation'),
//         work_order_number: Joi.string().optional().messages({ 'string.empty': 'Work order number cannot be empty' }),
//         prod_issued_approved_by: Joi.string()
//             .optional()
//             .custom((value, helpers) => {
//                 if (!mongoose.Types.ObjectId.isValid(value)) {
//                     return helpers.error('any.invalid', { message: `Product issued approved by ID (${value}) is not a valid ObjectId` });
//                 }
//                 return value;
//             }, 'ObjectId validation'),
//         prod_recieved_by: Joi.string()
//             .optional()
//             .custom((value, helpers) => {
//                 if (!mongoose.Types.ObjectId.isValid(value)) {
//                     return helpers.error('any.invalid', { message: `Product received by ID (${value}) is not a valid ObjectId` });
//                 }
//                 return value;
//             }, 'ObjectId validation'),
//         date: Joi.date().optional(),
//         prod_requset_date: Joi.date().optional().messages({ 'date.base': 'Product request date must be a valid date' }),
//         prod_requirement_date: Joi.date().optional().messages({ 'date.base': 'Product requirement date must be a valid date' }),
//         remarks: Joi.string().optional().messages({ 'string.empty': 'Remarks cannot be empty' }),
//         products: Joi.array().items(productSchema).min(1).optional().messages({
//             'array.min': 'At least one product is required if products are provided',
//         }),
//         files: Joi.array().items(fileSchema).optional(),
//         status: Joi.string()
//             .valid('Pending', 'Approved', 'Rejected', 'In Progress')
//             .optional()
//             .messages({ 'any.only': 'Status must be Pending, Approved, Rejected, or In Progress' }),
//         updated_by: Joi.string().optional().custom((value, helpers) => {
//             if (!mongoose.Types.ObjectId.isValid(value)) {
//                 return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
//             }
//             return value;
//         }, 'ObjectId validation'),
//     });

//     // 3. Parse form-data
//     const bodyData = req.body;
//     // console.log('bodyData', bodyData);
//     const userId = req.user?._id?.toString();
//     // console.log('userId', userId);

//     // Validate userId
//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//         throw new ApiError(400, 'Invalid or missing user ID in request');
//     }

//     // 4. Parse stringified fields if needed
//     if (typeof bodyData.products === 'string' && bodyData.products) {
//         try {
//             bodyData.products = JSON.parse(bodyData.products);
//         } catch (error) {
//             throw new ApiError(400, 'Invalid products JSON format');
//         }
//     }

//     // 5. Handle file uploads
//     const uploadedFiles = [];
//     if (req.files && req.files.length > 0) {
//         try {
//             for (const file of req.files) {
//                 const tempFilePath = path.join('./public/temp', file.filename);
//                 const fileBuffer = fs.readFileSync(tempFilePath);
//                 const sanitizedFilename = sanitizeFilename(file.originalname);
//                 console.log('filename', file.originalname);
//                 console.log('sanitizedFilename', sanitizedFilename);

//                 // Upload to S3
//                 const { url } = await putObject(
//                     { data: fileBuffer, mimetype: file.mimetype },
//                     `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
//                 );

//                 // Delete temp file
//                 fs.unlinkSync(tempFilePath);

//                 uploadedFiles.push({
//                     file_name: file.originalname,
//                     file_url: url,
//                     uploaded_at: new Date(),
//                 });
//             }
//         } catch (error) {
//             // Cleanup temp files on upload error
//             if (req.files) {
//                 req.files.forEach((file) => {
//                     const tempFilePath = path.join('./public/temp', file.filename);
//                     if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//                 });
//             }
//             throw new ApiError(500, `File upload failed: ${error.message}`);
//         }
//     }
//     const existingJobOrder = await falconJobOrder.findById(id);
//     if (!existingJobOrder) {
//         throw new ApiError(404, `Job order not found with ID: ${id}`);
//     }

//     // 6. Prepare job order data for validation
//     const jobOrderData = {
//         ...(bodyData.client_id && { client_id: bodyData.client_id }),
//         ...(bodyData.project_id && { project_id: bodyData.project_id }),
//         ...(bodyData.work_order_number && { work_order_number: bodyData.work_order_number }),
//         ...(bodyData.prod_issued_approved_by && { prod_issued_approved_by: bodyData.prod_issued_approved_by }),
//         ...(bodyData.prod_recieved_by && { prod_recieved_by: bodyData.prod_recieved_by }),
//         ...(bodyData.date && { date: new Date(bodyData.date) }),
//         ...(bodyData.prod_requset_date && { prod_requset_date: new Date(bodyData.prod_requset_date) }),
//         ...(bodyData.prod_requirement_date && { prod_requirement_date: new Date(bodyData.prod_requirement_date) }),
//         ...(bodyData.remarks && { remarks: bodyData.remarks }),
//         ...(bodyData.products && { products: bodyData.products }),
//         ...(bodyData.status && { status: bodyData.status }),
//         updated_by: userId,
//     };

//     // 7. Validate with Joi
//     const { error, value } = updateJobOrderSchema.validate(
//         { ...jobOrderData, files: uploadedFiles },
//         { abortEarly: false }
//     );
//     if (error) {
//         // Cleanup temp files
//         if (req.files) {
//             req.files.forEach((file) => {
//                 const tempFilePath = path.join('./public/temp', file.filename);
//                 if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//             });
//         }
//         throw new ApiError(400, 'Validation failed for job order update', error.details);
//     }

//     // 8. Validate referenced documents if provided
//     const validationPromises = [];
//     if (value.client_id) {
//         validationPromises.push(mongoose.model('falconClient').findById(value.client_id));
//     }
//     if (value.project_id) {
//         validationPromises.push(mongoose.model('falconProject').findById(value.project_id));
//     }
//     if (value.prod_issued_approved_by) {
//         validationPromises.push(mongoose.model('Employee').findById(value.prod_issued_approved_by));
//     }
//     if (value.prod_recieved_by) {
//         validationPromises.push(mongoose.model('Employee').findById(value.prod_recieved_by));
//     }
//     if (value.products) {
//         validationPromises.push(
//             Promise.all(value.products.map((p) => mongoose.model('falconProduct').findById(p.product)))
//         );
//     }

//     const [client, project, approvedByEmployee, receivedByEmployee, products] = await Promise.all(validationPromises);

//     if (value.client_id && !client) throw new ApiError(400, `Client not found with ID: ${value.client_id}`);
//     if (value.project_id && !project) throw new ApiError(400, `Project not found with ID: ${value.project_id}`);
//     if (value.prod_issued_approved_by && !approvedByEmployee) {
//         throw new ApiError(404, `Employee not found for prod_issued_approved_by ID: ${value.prod_issued_approved_by}`);
//     }
//     if (value.prod_recieved_by && !receivedByEmployee) {
//         throw new ApiError(404, `Employee not found for prod_rec_by_id ID: ${value.prod_recieved_by}`);
//     }
//     if (value.products) {
//         const invalidProduct = products.findIndex((p) => !p);
//         if (invalidProduct !== -1) {
//             throw new ApiError(400, `Product not found with ID: ${value.products[invalidProduct].product}`);
//         }
//     }

//     // 9. Prepare MongoDB update
//     const updateData = { $set: value };
//     if (uploadedFiles.length > 0) {
//         updateData.$push = { files: { $each: uploadedFiles } };
//     }
//     delete updateData.$set.files; // Avoid overwriting files array

//     const jobOrder = await falconJobOrder.findByIdAndUpdate(
//         id,
//         updateData,
//         { new: true, runValidators: true }
//     );

//     if (!jobOrder) {
//         // Cleanup temp files
//         if (req.files) {
//             req.files.forEach((file) => {
//                 const tempFilePath = path.join('./public/temp', file.filename);
//                 if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//             });
//         }
//         throw new ApiError(404, `Job order not found with ID: ${id}`);
//     }

//     if (uploadedFiles.length > 0 && existingJobOrder.files && existingJobOrder.files.length > 0) {
//         await Promise.all(existingJobOrder.files.map(async (file) => {
//             const fileKey = file.file_url.split('/').slice(3).join('/');
//             await deleteObject(fileKey);
//         }));
//     }

//     // 10. Populate and format response
//     const populatedJobOrder = await falconJobOrder
//         .findById(jobOrder._id)
//         .populate({
//             path: 'client_id',
//             select: 'name address',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'project_id',
//             select: 'name',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'products.product',
//             select: 'name',
//             match: { is_deleted: false },
//         })
//         .populate({
//             path: 'prod_issued_approved_by',
//             select: 'name email',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'prod_recieved_by',
//             select: 'name email',
//             match: { isDeleted: false },
//         })
//         .populate('created_by', 'username email')
//         .populate('updated_by', 'username email')
//         .lean();

//     if (!populatedJobOrder) {
//         throw new ApiError(404, 'Failed to retrieve updated job order');
//     }

//     // Convert timestamps to IST
//     const formattedJobOrder = formatDateToIST(populatedJobOrder);

//     return sendResponse(res, new ApiResponse(200, formattedJobOrder, 'Job order updated successfully'));
// });

const getFalconJobOrderById_12_08_2025 = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid job order ID: ${id}`);
    }

    const jobOrder = await falconJobOrder
        .findById(id)
        .populate({
            path: 'work_order_number',
            select: 'client_id project_id work_order_number',
            populate: [
                { path: 'client_id', select: 'name address' },
                { path: 'project_id', select: 'name address' },
            ],
        })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('prod_issued_approved_by', 'name')
        .populate('prod_recieved_by', 'name')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .lean();

    if (!jobOrder) {
        throw new ApiError(404, `Job order not found with ID: ${id}`);
    }
    // console.log("jobOrder",jobOrder);

    // Fetch internal work order by job_order_id
    const internalWorkOrder = await falconInternalWorkOrder.findOne({
        job_order_id: id,
    }).lean();

    const formattedProductsDetails = await Promise.all(
        jobOrder.products.map(async (product) => {
            const productId = product.product?._id?.toString();

            let achievedQty = 0;
            let packedQty = 0;
            let dispatchQty = 0;
            if (internalWorkOrder) {
                const relatedProduct = internalWorkOrder.products.find(
                    (p) => p.product.toString() === productId
                );

                if (relatedProduct && relatedProduct.semifinished_details.length > 0) {
                    for (const semi of relatedProduct.semifinished_details) {
                        const processes = semi.processes;
                        if (processes.length > 0) {
                            const lastProcess = processes[processes.length - 1];
                            const processName = lastProcess.name;
                            // console.log("job order", id);
                            // console.log("semi id", semi.semifinished_id);
                            // console.log("product id", productId);
                            // console.log("processName", processName);



                            // Fetch the production data for this semifinished_id, job order and product
                            const productionDoc = await falconProduction.findOne({
                                job_order: id,
                                'product.product_id': productId,
                                semifinished_id: semi.semifinished_id,
                                process_name: { $regex: `^${processName}$`, $options: 'i' }, // 👈 case-insensitive exact match
                            }).lean();
                            // console.log("productionDoc", productionDoc);

                            if (productionDoc) {
                                achievedQty += productionDoc.product.achieved_quantity || 0;
                            }
                        }
                    }
                }
                // 🟢 Fetch packed quantity from packing collection
                const packingDocs = await falconPacking.find({
                    work_order: jobOrder.work_order_number._id,
                    job_order_id: jobOrder._id,
                    product: product.product._id,
                }).lean();

                packedQty = packingDocs.reduce(
                    (sum, doc) => sum + (doc.semi_finished_quantity || 0),
                    0
                );

                // ✅ Get dispatch quantity
                const packingIds = packingDocs.map((doc) => doc._id);

                const dispatchDocs = await falocnDispatch.find({
                    job_order: jobOrder._id,
                    packing_ids: { $in: packingIds },
                }).lean();

                for (const dispatch of dispatchDocs) {
                    for (const dispatchedProduct of dispatch.products) {
                        if (dispatchedProduct.product_id.toString() === productId) {
                            dispatchQty += dispatchedProduct.dispatch_quantity || 0;
                        }
                    }
                }
            }

            return {
                productName: product.product?.name || 'N/A',
                productId,
                uom: product.uom,
                code: product.code,
                colorCode: product.color_code,
                height: product.height,
                width: product.width,
                poQuantity: product.po_quantity,
                deliveryDate: formatDateOnly(jobOrder.prod_requirement_date),
                achievedQty, // ✅ added field
                packedQty,
                dispatchQty
            };
        })
    );

    // ✅ Add detailed semi-finished info for current job order only
    const jobOrderDetailsWithSemiFinished = [];

    if (internalWorkOrder) {
        for (const prod of internalWorkOrder.products) {
            const productId = prod.product.toString();
            let achievedQty = 0;
            const semiFinishedDetails = [];

            for (const semi of prod.semifinished_details || []) {
                console.log("semi****",semi);

                const lastProcess = semi.processes?.[semi.processes.length - 1];

                if (lastProcess) {
                    const productionDoc = await falconProduction.findOne({
                        job_order: id,
                        'product.product_id': productId,
                        semifinished_id: semi.semifinished_id,
                        process_name: { $regex: `^${lastProcess.name}$`, $options: 'i' }
                    }).lean();

                    if (productionDoc) {
                        achievedQty += productionDoc.product.achieved_quantity || 0;
                    }
                }
                //Packing details - 
                const packingDocs = await falconPacking.find({
                    job_order_id: jobOrder._id,
                    product: prod.product,
                    semi_finished_id: semi.semifinished_id,
                }).lean();

                const packed_qty = packingDocs.reduce(
                    (sum, doc) => sum + (doc.semi_finished_quantity || 0),
                    0
                );
                const packingIds = packingDocs.map(doc => doc._id);

                // 🔴 Get dispatch quantity
                const dispatchDocs = await falocnDispatch.find({
                    job_order: jobOrder._id,
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
                    file_url: semi.file_url,
                    remarks: semi.remarks,
                    packed_qty,
                    dispatch_qty,
                    // processes: semi.processes.map(proc => ({
                    //     name: proc.name,
                    //     file_url: proc.file_url,
                    //     remarks: proc.remarks
                    // }))
                    processes: await Promise.all(
                        semi.processes.map(async (proc) => {
                            const production = await falconProduction.findOne({
                                job_order: jobOrder._id,
                                'product.product_id': prod.product,
                                semifinished_id: semi.semifinished_id,
                                process_name: { $regex: `^${proc.name}$`, $options: 'i' }, // case-insensitive match
                            }).lean();

                            return {
                                name: proc.name,
                                file_url: proc.file_url,
                                remarks: proc.remarks,
                                achievedQty: production?.product?.achieved_quantity || 0 // ✅ attach achieved qty
                            };
                        })
                    )
                });
            }
            // console.log("jobOrder",jobOrder);

            // 🔴 Get rejected quantity from QC Check collection
            const qcDocs = await falconQCCheck.find({
                job_order: jobOrder._id,
                product_id: prod.product,
            }).lean();

            let rejectedQty = 0;

            if (qcDocs?.length > 0) {
                rejectedQty = qcDocs.reduce((sum, doc) => sum + (doc.rejected_quantity || 0), 0);
            }

            // 🟢 Fetch system name
            let systemName = 'N/A';
            if (prod.system) {
                const systemDoc = await falconSystem.findById(prod.system).select('name').lean();
                if (systemDoc) systemName = systemDoc.name;
            }

            // 🟢 Fetch product system name
            let productSystemName = 'N/A';
            if (prod.product_system) {
                const productSystemDoc = await falconProductSystem.findById(prod.product_system).select('name').lean();
                if (productSystemDoc) productSystemName = productSystemDoc.name;
            }

            jobOrderDetailsWithSemiFinished.push({
                job_order_id: jobOrder.job_order_id,
                product_id: prod.product?.toString(),
                sales_order_no: internalWorkOrder.sales_order_no,
                job_order_db_id: jobOrder._id,
                date: internalWorkOrder.date,
                system: prod.system,
                system_name: systemName,
                product_system: prod.product_system,
                product_system_name: productSystemName,
                po_quantity: prod.po_quantity,
                achievedQty,
                rejectedQty,
                semiFinishedDetails
            });
        }
    }

    const rawPackingDocs = await falconPacking
        .find({ job_order_id: jobOrder._id })
        .populate('product', 'name uom')
        .populate('packed_by', 'username')
        .lean();

    // Map to group products and semi-finished items
    const productMap = {};

    for (const doc of rawPackingDocs) {
        const productId = doc.product?._id?.toString();
        const productName = doc.product?.name || 'N/A';
        const uom = doc.product?.uom || 'nos';
        const sfId = doc.semi_finished_id;

        if (!productMap[productId]) {
            productMap[productId] = {
                productId,
                productName,
                uom,
                semiFinishedProducts: {}
            };
        }

        if (!productMap[productId].semiFinishedProducts[sfId]) {
            productMap[productId].semiFinishedProducts[sfId] = {
                sfId,
                quantity: 0,
                qrCodes: []
            };
        }

        productMap[productId].semiFinishedProducts[sfId].quantity += doc.semi_finished_quantity || 0;

        const qrEntries = [doc.qr_id, doc.qr_code].filter(Boolean);
        productMap[productId].semiFinishedProducts[sfId].qrCodes.push({
            code: doc.qr_id,
            url: doc.qr_code
        });
    }

    const workOrderDoc = await falconWorkOrder.findById(jobOrder.work_order_number).lean();
    const workOrderNumber = workOrderDoc?.work_order_number || 'N/A';

    // Final formatted packing details
    const packing_details = [
        {
            // workOrderId: jobOrder.work_order_number?._id,
            workOrderId: workOrderNumber,
            jobOrder: jobOrder.job_order_id,
            status: "Packed",
            createdBy: jobOrder.created_by?.username || 'N/A',
            timestamp: jobOrder.createdAt,
            products: Object.values(productMap).map(prod => ({
                ...prod,
                semiFinishedProducts: Object.values(prod.semiFinishedProducts)
            }))
        }
    ];





    const formattedJobOrder = {
        clientProjectDetails: {
            clientName: jobOrder.work_order_number?.client_id?.name || 'N/A',
            clientId: jobOrder.work_order_number?.client_id?._id || null,
            address: jobOrder.work_order_number?.client_id?.address || 'N/A',
            projectName: jobOrder.work_order_number?.project_id?.name || 'N/A',
            projectId: jobOrder.work_order_number?.project_id?._id || null,
        },
        workOrderDetails: {
            workOrderId: jobOrder.work_order_number._id,
            workOrderNumber: jobOrder.work_order_number.work_order_number,
            productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
            productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
            approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
            approvedById: jobOrder.prod_issued_approved_by?._id?.toString() || null,
            receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
            receivedById: jobOrder.prod_recieved_by?._id?.toString() || null,
            remarks: jobOrder.remarks,
            workOrderDate: formatDateOnly(jobOrder.date),
            file: jobOrder.files.map(file => ({
                file_name: file.file_name,
                file_url: file.file_url,
                uploaded_at: file.uploaded_at,
                _id: file._id?.toString(),
            })),
            createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0],
            createdBy: jobOrder.created_by?.username || 'N/A',
        },
        jobOrderDetails: {
            jobOrderNumber: jobOrder.job_order_id,
            createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0],
            createdBy: jobOrder.created_by?.username || 'N/A',
            status: jobOrder.status,
        },
        productsDetails: formattedProductsDetails,
        jobOrderDetailsWithSemiFinished,
        packing_details
    };

    return sendResponse(res, new ApiResponse(200, formattedJobOrder, 'Job order fetched successfully'));
});

const getFalconJobOrderById_01_09_2025 = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("Flacon Job Order Id",id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid job order ID: ${id}`);
    }

    const jobOrder = await falconJobOrder
        .findById(id)
        .populate({
            path: 'work_order_number',
            select: 'client_id project_id work_order_number',
            populate: [
                { path: 'client_id', select: 'name address' },
                { path: 'project_id', select: 'name address' },
            ],
        })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('prod_issued_approved_by', 'name')
        .populate('prod_recieved_by', 'name')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .lean();

    if (!jobOrder) {
        throw new ApiError(404, `Job order not found with ID: ${id}`);
    }

    // Fetch internal work order by job_order_id
    const internalWorkOrder = await falconInternalWorkOrder.findOne({
        job_order_id: id,
    }).lean();
    // const internalWorkOrder = await falconInternalWorkOrder.find({
    //     job_order_id: id,
    // }).lean();
    console.log("internalWorkOrder",internalWorkOrder)


    const formattedProductsDetails = await Promise.all(
        jobOrder.products.map(async (product) => {
            const productId = product.product?._id?.toString();

            let achievedQty = 0;
            let packedQty = 0;
            let dispatchQty = 0;
            if (internalWorkOrder) {
                const relatedProduct = internalWorkOrder.products.find(
                    (p) => p.product.toString() === productId
                );

                if (relatedProduct && relatedProduct.semifinished_details.length > 0) {
                    for (const semi of relatedProduct.semifinished_details) {
                        const processes = semi.processes;
                        if (processes.length > 0) {
                            const lastProcess = processes[processes.length - 1];
                            const processName = lastProcess.name;

                            // Fetch the production data for this semifinished_id, job order and product
                            const productionDoc = await falconProduction.findOne({
                                job_order: id,
                                'product.product_id': productId,
                                semifinished_id: semi.semifinished_id,
                                process_name: { $regex: `^${processName}$`, $options: 'i' },
                            }).lean();
                            console.log("productionDoc",productionDoc);
                            if (productionDoc) {
                                achievedQty += productionDoc.product.achieved_quantity || 0;
                            }
                        }
                    }
                }
                // Fetch packed quantity from packing collection
                const packingDocs = await falconPacking.find({
                    work_order: jobOrder.work_order_number._id,
                    job_order_id: jobOrder._id,
                    product: product.product._id,
                }).lean();

                packedQty = packingDocs.reduce(
                    (sum, doc) => sum + (doc.semi_finished_quantity || 0),
                    0
                );

                // Get dispatch quantity
                const packingIds = packingDocs.map((doc) => doc._id);

                const dispatchDocs = await falocnDispatch.find({
                    job_order: jobOrder._id,
                    packing_ids: { $in: packingIds },
                }).lean();

                for (const dispatch of dispatchDocs) {
                    for (const dispatchedProduct of dispatch.products) {
                        if (dispatchedProduct.product_id.toString() === productId) {
                            dispatchQty += dispatchedProduct.dispatch_quantity || 0;
                        }
                    }
                }
            }

            return {
                productName: product.product?.name || 'N/A',
                productId,
                uom: product.uom,
                code: product.code,
                colorCode: product.color_code,
                height: product.height,
                width: product.width,
                poQuantity: product.po_quantity,
                deliveryDate: formatDateOnly(jobOrder.prod_requirement_date),
                achievedQty,
                packedQty,
                dispatchQty
            };
        })
    );

    // Add detailed semi-finished info for current job order only
    const jobOrderDetailsWithSemiFinished = [];

    if (internalWorkOrder) {
        for (const prod of internalWorkOrder.products) {
            console.log("prod",prod);

            const productId = prod.product.toString();
            let achievedQty = 0;
            const semiFinishedDetails = [];

            for (const semi of prod.semifinished_details || []) {
                console.log("semi",semi);
                const lastProcess = semi.processes?.[semi.processes.length - 1];

                if (lastProcess) {
                    const productionDoc = await falconProduction.findOne({
                        job_order: id,
                        'product.product_id': productId,
                        semifinished_id: semi.semifinished_id,
                        process_name: { $regex: `^${lastProcess.name}$`, $options: 'i' }
                    }).lean();

                    if (productionDoc) {
                        achievedQty += productionDoc.product.achieved_quantity || 0;
                    }
                }
                // Packing details
                const packingDocs = await falconPacking.find({
                    job_order_id: jobOrder._id,
                    product: prod.product,
                    semi_finished_id: semi.semifinished_id,
                }).lean();

                const packed_qty = packingDocs.reduce(
                    (sum, doc) => sum + (doc.semi_finished_quantity || 0),
                    0
                );
                const packingIds = packingDocs.map(doc => doc._id);

                // Get dispatch quantity
                const dispatchDocs = await falocnDispatch.find({
                    job_order: jobOrder._id,
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
                    file_url: semi.file_url,
                    remarks: semi.remarks,
                    packed_qty,
                    dispatch_qty,
                    processes: await Promise.all(
                        semi.processes.map(async (proc) => {
                            const production = await falconProduction.findOne({
                                job_order: jobOrder._id,
                                'product.product_id': prod.product,
                                semifinished_id: semi.semifinished_id,
                                process_name: { $regex: `^${proc.name}$`, $options: 'i' },
                            }).lean();

                            return {
                                name: proc.name,
                                file_url: proc.file_url,
                                remarks: proc.remarks,
                                achievedQty: production?.product?.achieved_quantity || 0
                            };
                        })
                    )
                });
            }

            // Get rejected quantity from QC Check collection
            const qcDocs = await falconQCCheck.find({
                job_order: jobOrder._id,
                product_id: prod.product,
            }).lean();

            let rejectedQty = 0;

            if (qcDocs?.length > 0) {
                rejectedQty = qcDocs.reduce((sum, doc) => sum + (doc.rejected_quantity || 0), 0);
            }

            // Fetch system name
            let systemName = 'N/A';
            if (prod.system) {
                const systemDoc = await falconSystem.findById(prod.system).select('name').lean();
                if (systemDoc) systemName = systemDoc.name;
            }

            // Fetch product system name
            let productSystemName = 'N/A';
            if (prod.product_system) {
                const productSystemDoc = await falconProductSystem.findById(prod.product_system).select('name').lean();
                if (productSystemDoc) productSystemName = productSystemDoc.name;
            }

            jobOrderDetailsWithSemiFinished.push({
                job_order_id: jobOrder.job_order_id,
                product_id: prod.product?.toString(),
                sales_order_no: internalWorkOrder.sales_order_no,
                job_order_db_id: jobOrder._id,
                date: internalWorkOrder.date,
                system: prod.system,
                system_name: systemName,
                product_system: prod.product_system,
                product_system_name: productSystemName,
                po_quantity: prod.po_quantity,
                achievedQty,
                rejectedQty,
                semiFinishedDetails
            });
        }
    }

    const rawPackingDocs = await falconPacking
        .find({ job_order_id: jobOrder._id })
        .populate('product', 'name uom')
        .populate('packed_by', 'username')
        .lean();

    // Map to group products and semi-finished items
    const productMap = {};

    for (const doc of rawPackingDocs) {
        const productId = doc.product?._id?.toString();
        const productName = doc.product?.name || 'N/A';
        const uom = doc.product?.uom || 'nos';
        const sfId = doc.semi_finished_id;

        if (!productMap[productId]) {
            productMap[productId] = {
                productId,
                productName,
                uom,
                semiFinishedProducts: {}
            };
        }

        if (!productMap[productId].semiFinishedProducts[sfId]) {
            productMap[productId].semiFinishedProducts[sfId] = {
                sfId,
                quantity: 0,
                qrCodes: []
            };
        }

        productMap[productId].semiFinishedProducts[sfId].quantity += doc.semi_finished_quantity || 0;

        const qrEntries = [doc.qr_id, doc.qr_code].filter(Boolean);
        productMap[productId].semiFinishedProducts[sfId].qrCodes.push({
            code: doc.qr_id,
            url: doc.qr_code
        });
    }

    const workOrderDoc = await falconWorkOrder.findById(jobOrder.work_order_number).lean();
    const workOrderNumber = workOrderDoc?.work_order_number || 'N/A';

    // Final formatted packing details
    const packing_details = [
        {
            workOrderId: workOrderNumber,
            jobOrder: jobOrder.job_order_id,
            status: "Packed",
            createdBy: jobOrder.created_by?.username || 'N/A',
            timestamp: jobOrder.createdAt,
            products: Object.values(productMap).map(prod => ({
                ...prod,
                semiFinishedProducts: Object.values(prod.semiFinishedProducts)
            }))
        }
    ];

    // Fetch dispatch details
    const rawDispatchDocs = await falocnDispatch
        .find({ job_order: jobOrder._id })
        .populate('products.product_id', 'name')
        .lean();

    const dispatch_details = rawDispatchDocs.map(dispatch => {
        const products = dispatch.products.map(product => {
            // Find the uom from jobOrder.products
            // console.log("product",product);
            const jobOrderProduct = jobOrder.products.find(
                p => p.product._id.toString() === product.product_id.toString()
            );
            return {
                productName: product.product_name || 'N/A',
                productId: product.product_id._id.toString(),
                dispatchQty: product.dispatch_quantity || 0,
                uom: jobOrderProduct?.uom || 'nos'
            };
        });

        return {
            dispatchId: dispatch._id.toString(),
            jobOrder: jobOrder.job_order_id,
            workOrderId: workOrderNumber,
            status: dispatch.status || 'Approved',
            timestamp: dispatch.date,
            vehicleNumber: dispatch.vehicle_number,
            createdBy: dispatch.created_by?.toString() || 'N/A',
            products
        };
    });

    const formattedJobOrder = {
        clientProjectDetails: {
            clientName: jobOrder.work_order_number?.client_id?.name || 'N/A',
            clientId: jobOrder.work_order_number?.client_id?._id || null,
            address: jobOrder.work_order_number?.client_id?.address || 'N/A',
            projectName: jobOrder.work_order_number?.project_id?.name || 'N/A',
            projectId: jobOrder.work_order_number?.project_id?._id || null,
        },
        workOrderDetails: {
            workOrderId: jobOrder.work_order_number._id,
            workOrderNumber: jobOrder.work_order_number.work_order_number,
            productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
            productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
            approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
            approvedById: jobOrder.prod_issued_approved_by?._id?.toString() || null,
            receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
            receivedById: jobOrder.prod_recieved_by?._id?.toString() || null,
            remarks: jobOrder.remarks,
            workOrderDate: formatDateOnly(jobOrder.date),
            file: jobOrder.files.map(file => ({
                file_name: file.file_name,
                file_url: file.file_url,
                uploaded_at: file.uploaded_at,
                _id: file._id?.toString(),
            })),
            createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0],
            createdBy: jobOrder.created_by?.username || 'N/A',
        },
        jobOrderDetails: {
            jobOrderNumber: jobOrder.job_order_id,
            createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0],
            createdBy: jobOrder.created_by?.username || 'N/A',
            status: jobOrder.status,
        },
        productsDetails: formattedProductsDetails,
        jobOrderDetailsWithSemiFinished,
        packing_details,
        dispatch_details
    };

    return sendResponse(res, new ApiResponse(200, formattedJobOrder, 'Job order fetched successfully'));
});


const getFalconJobOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("Flacon Job Order Id", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid job order ID: ${id}`);
    }

    const jobOrder = await falconJobOrder
        .findById(id)
        .populate({
            path: 'work_order_number',
            select: 'client_id project_id work_order_number',
            populate: [
                { path: 'client_id', select: 'name address' },
                { path: 'project_id', select: 'name address' },
            ],
        })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('prod_issued_approved_by', 'name')
        .populate('prod_recieved_by', 'name')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .lean();

    if (!jobOrder) {
        throw new ApiError(404, `Job order not found with ID: ${id}`);
    }

    // Fetch ALL internal work orders by job_order_id
    const internalWorkOrders = await falconInternalWorkOrder.find({
        job_order_id: id,
    }).lean();
    console.log("internalWorkOrders", internalWorkOrders);

    const formattedProductsDetails = await Promise.all(
        jobOrder.products.map(async (product) => {
            const productId = product.product?._id?.toString();

            let achievedQty = 0;
            let packedQty = 0;
            let dispatchQty = 0;

            if (internalWorkOrders.length > 0) {
                for (const internalWorkOrder of internalWorkOrders) {
                    const relatedProduct = internalWorkOrder.products.find(
                        (p) => p.product.toString() === productId
                    );

                    if (relatedProduct && relatedProduct.semifinished_details.length > 0) {
                        for (const semi of relatedProduct.semifinished_details) {
                            const processes = semi.processes;
                            if (processes.length > 0) {
                                const lastProcess = processes[processes.length - 1];
                                const processName = lastProcess.name;

                                const productionDoc = await falconProduction.findOne({
                                    job_order: id,
                                    'product.product_id': productId,
                                    semifinished_id: semi.semifinished_id,
                                    process_name: { $regex: `^${processName}$`, $options: 'i' },
                                }).lean();

                                if (productionDoc) {
                                    achievedQty += productionDoc.product.achieved_quantity || 0;
                                }
                            }
                        }
                    }
                }

                // Fetch packed quantity from packing collection
                const packingDocs = await falconPacking.find({
                    work_order: jobOrder.work_order_number._id,
                    job_order_id: jobOrder._id,
                    product: product.product._id,
                }).lean();

                packedQty = packingDocs.reduce(
                    (sum, doc) => sum + (doc.semi_finished_quantity || 0),
                    0
                );

                const packingIds = packingDocs.map((doc) => doc._id);

                const dispatchDocs = await falocnDispatch.find({
                    job_order: jobOrder._id,
                    packing_ids: { $in: packingIds },
                }).lean();

                for (const dispatch of dispatchDocs) {
                    for (const dispatchedProduct of dispatch.products) {
                        if (dispatchedProduct.product_id.toString() === productId) {
                            dispatchQty += dispatchedProduct.dispatch_quantity || 0;
                        }
                    }
                }
            }

            return {
                productName: product.product?.name || 'N/A',
                productId,
                uom: product.uom,
                code: product.code,
                colorCode: product.color_code,
                height: product.height,
                width: product.width,
                poQuantity: product.po_quantity,
                deliveryDate: formatDateOnly(jobOrder.prod_requirement_date),
                achievedQty,
                packedQty,
                dispatchQty,
            };
        })
    );

    // Add detailed semi-finished info for current job order only
    const jobOrderDetailsWithSemiFinished = [];

    if (internalWorkOrders.length > 0) {
        for (const internalWorkOrder of internalWorkOrders) {
            for (const prod of internalWorkOrder.products) {
                console.log("prod", prod);

                const productId = prod.product.toString();
                let achievedQty = 0;
                const semiFinishedDetails = [];

                for (const semi of prod.semifinished_details || []) {
                    console.log("semi", semi);
                    const lastProcess = semi.processes?.[semi.processes.length - 1];

                    if (lastProcess) {
                        const productionDoc = await falconProduction.findOne({
                            job_order: id,
                            'product.product_id': productId,
                            semifinished_id: semi.semifinished_id,
                            process_name: { $regex: `^${lastProcess.name}$`, $options: 'i' },
                        }).lean();

                        if (productionDoc) {
                            achievedQty += productionDoc.product.achieved_quantity || 0;
                        }
                    }

                    const packingDocs = await falconPacking.find({
                        job_order_id: jobOrder._id,
                        product: prod.product,
                        semi_finished_id: semi.semifinished_id,
                    }).lean();

                    const packed_qty = packingDocs.reduce(
                        (sum, doc) => sum + (doc.semi_finished_quantity || 0),
                        0
                    );
                    const packingIds = packingDocs.map((doc) => doc._id);

                    const dispatchDocs = await falocnDispatch.find({
                        job_order: jobOrder._id,
                        packing_ids: { $in: packingIds },
                    }).lean();

                    let dispatch_qty = 0;

                    dispatchDocs.forEach((dispatch) => {
                        dispatch.products.forEach((product) => {
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
                        file_url: semi.file_url,
                        remarks: semi.remarks,
                        packed_qty,
                        dispatch_qty,
                        processes: await Promise.all(
                            semi.processes.map(async (proc) => {
                                const production = await falconProduction.findOne({
                                    job_order: jobOrder._id,
                                    'product.product_id': prod.product,
                                    semifinished_id: semi.semifinished_id,
                                    process_name: { $regex: `^${proc.name}$`, $options: 'i' },
                                }).lean();

                                return {
                                    name: proc.name,
                                    file_url: proc.file_url,
                                    remarks: proc.remarks,
                                    achievedQty: production?.product?.achieved_quantity || 0,
                                };
                            })
                        ),
                    });
                }

                const qcDocs = await falconQCCheck.find({
                    job_order: jobOrder._id,
                    product_id: prod.product,
                }).lean();

                let rejectedQty = 0;
                if (qcDocs?.length > 0) {
                    rejectedQty = qcDocs.reduce(
                        (sum, doc) => sum + (doc.rejected_quantity || 0),
                        0
                    );
                }

                let systemName = 'N/A';
                if (prod.system) {
                    const systemDoc = await falconSystem
                        .findById(prod.system)
                        .select('name')
                        .lean();
                    if (systemDoc) systemName = systemDoc.name;
                }

                let productSystemName = 'N/A';
                if (prod.product_system) {
                    const productSystemDoc = await falconProductSystem
                        .findById(prod.product_system)
                        .select('name')
                        .lean();
                    if (productSystemDoc) productSystemName = productSystemDoc.name;
                }

                jobOrderDetailsWithSemiFinished.push({
                    job_order_id: jobOrder.job_order_id,
                    product_id: prod.product?.toString(),
                    sales_order_no: internalWorkOrder.sales_order_no,
                    job_order_db_id: jobOrder._id,
                    date: internalWorkOrder.date,
                    system: prod.system,
                    system_name: systemName,
                    product_system: prod.product_system,
                    product_system_name: productSystemName,
                    po_quantity: prod.po_quantity,
                    achievedQty,
                    rejectedQty,
                    semiFinishedDetails,
                });
            }
        }
    }

    // --- rest of your code for packing_details, dispatch_details, formattedJobOrder ---
    // (unchanged)

    const rawPackingDocs = await falconPacking
        .find({ job_order_id: jobOrder._id })
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
            productMap[productId] = {
                productId,
                productName,
                uom,
                semiFinishedProducts: {},
            };
        }

        if (!productMap[productId].semiFinishedProducts[sfId]) {
            productMap[productId].semiFinishedProducts[sfId] = {
                sfId,
                quantity: 0,
                qrCodes: [],
            };
        }

        productMap[productId].semiFinishedProducts[sfId].quantity +=
            doc.semi_finished_quantity || 0;

        const qrEntries = [doc.qr_id, doc.qr_code].filter(Boolean);
        productMap[productId].semiFinishedProducts[sfId].qrCodes.push({
            code: doc.qr_id,
            url: doc.qr_code,
        });
    }

    const workOrderDoc = await falconWorkOrder.findById(jobOrder.work_order_number).lean();
    const workOrderNumber = workOrderDoc?.work_order_number || 'N/A';

    const packing_details = [
        {
            workOrderId: workOrderNumber,
            jobOrder: jobOrder.job_order_id,
            status: "Packed",
            createdBy: jobOrder.created_by?.username || 'N/A',
            timestamp: jobOrder.createdAt,
            products: Object.values(productMap).map((prod) => ({
                ...prod,
                semiFinishedProducts: Object.values(prod.semiFinishedProducts),
            })),
        },
    ];

    const rawDispatchDocs = await falocnDispatch
        .find({ job_order: jobOrder._id })
        .populate('products.product_id', 'name')
        .lean();

    const dispatch_details = rawDispatchDocs.map((dispatch) => {
        const products = dispatch.products.map((product) => {
            const jobOrderProduct = jobOrder.products.find(
                (p) => p.product._id.toString() === product.product_id.toString()
            );
            return {
                productName: product.product_name || 'N/A',
                productId: product.product_id._id.toString(),
                dispatchQty: product.dispatch_quantity || 0,
                uom: jobOrderProduct?.uom || 'nos',
            };
        });

        return {
            dispatchId: dispatch._id.toString(),
            jobOrder: jobOrder.job_order_id,
            workOrderId: workOrderNumber,
            status: dispatch.status || 'Approved',
            timestamp: dispatch.date,
            vehicleNumber: dispatch.vehicle_number,
            createdBy: dispatch.created_by?.toString() || 'N/A',
            products,
        };
    });

    const formattedJobOrder = {
        clientProjectDetails: {
            clientName: jobOrder.work_order_number?.client_id?.name || 'N/A',
            clientId: jobOrder.work_order_number?.client_id?._id || null,
            address: jobOrder.work_order_number?.client_id?.address || 'N/A',
            projectName: jobOrder.work_order_number?.project_id?.name || 'N/A',
            projectId: jobOrder.work_order_number?.project_id?._id || null,
        },
        workOrderDetails: {
            workOrderId: jobOrder.work_order_number._id,
            workOrderNumber: jobOrder.work_order_number.work_order_number,
            productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
            productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
            approvedBy: jobOrder.prod_issued_approved_by?.name || 'N/A',
            approvedById: jobOrder.prod_issued_approved_by?._id?.toString() || null,
            receivedBy: jobOrder.prod_recieved_by?.name || 'N/A',
            receivedById: jobOrder.prod_recieved_by?._id?.toString() || null,
            remarks: jobOrder.remarks,
            workOrderDate: formatDateOnly(jobOrder.date),
            file: jobOrder.files.map((file) => ({
                file_name: file.file_name,
                file_url: file.file_url,
                uploaded_at: file.uploaded_at,
                _id: file._id?.toString(),
            })),
            createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0],
            createdBy: jobOrder.created_by?.username || 'N/A',
        },
        jobOrderDetails: {
            jobOrderNumber: jobOrder.job_order_id,
            createdAt: formatDateToIST({ createdAt: jobOrder.createdAt }).createdAt.split(' ')[0],
            createdBy: jobOrder.created_by?.username || 'N/A',
            status: jobOrder.status,
        },
        productsDetails: formattedProductsDetails,
        jobOrderDetailsWithSemiFinished,
        packing_details,
        dispatch_details,
    };

    return sendResponse(res, new ApiResponse(200, formattedJobOrder, 'Job order fetched successfully'));
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
        work_order_number: Joi.string()
            .optional()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Work Order ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
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
        date: Joi.date().optional().messages({ 'date.base': 'Date must be a valid date' }),
        prod_requset_date: Joi.date().optional().messages({ 'date.base': 'Product request date must be a valid date' }),
        prod_requirement_date: Joi.date().optional().messages({ 'date.base': 'Product requirement date must be a valid date' }),
        remarks: Joi.string().optional().messages({ 'string.empty': 'Remarks cannot be empty' }),
        products: Joi.array().items(productSchema).min(1).optional().messages({
            'array.min': 'At least one product is required if products are provided',
        }),
        files: Joi.array().items(fileSchema).optional(),
        updated_by: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
    });

    // 3. Parse form-data
    const bodyData = req.body;
    const userId = req.user?._id?.toString();

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
    //                 `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
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


    // 5. Handle file uploads
const uploadedFiles = [];
if (req.files && req.files.length > 0) {
    try {
        for (const file of req.files) {
            const sanitizedFilename = sanitizeFilename(file.originalname);

            // Upload directly from memory (buffer)
            const { url } = await putObject(
                { data: file.buffer, mimetype: file.mimetype },
                `falcon-job-orders/${Date.now()}-${sanitizedFilename}`
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


    // 6. Fetch existing job order
    const existingJobOrder = await falconJobOrder.findById(id);
    if (!existingJobOrder) {
        throw new ApiError(404, `Job order not found with ID: ${id}`);
    }

    // 7. Prepare job order data for validation
    const jobOrderData = {
        ...(bodyData.work_order_number && { work_order_number: bodyData.work_order_number }),
        ...(bodyData.prod_issued_approved_by && { prod_issued_approved_by: bodyData.prod_issued_approved_by }),
        ...(bodyData.prod_recieved_by && { prod_recieved_by: bodyData.prod_recieved_by }),
        ...(bodyData.date && { date: new Date(bodyData.date) }),
        ...(bodyData.prod_requset_date && { prod_requset_date: new Date(bodyData.prod_requset_date) }),
        ...(bodyData.prod_requirement_date && { prod_requirement_date: new Date(bodyData.prod_requirement_date) }),
        ...(bodyData.remarks && { remarks: bodyData.remarks }),
        ...(bodyData.products && { products: bodyData.products }),
        updated_by: userId,
    };

    // 8. Validate with Joi
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

    // 9. Validate referenced documents if provided
    const validationPromises = [];
    if (value.work_order_number) {
        validationPromises.push(mongoose.model('falconWorkOrder').findById(value.work_order_number));
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

    const results = await Promise.all(validationPromises);
    const workOrder = value.work_order_number ? results.shift() : null;
    const approvedByEmployee = value.prod_issued_approved_by ? results.shift() : null;
    const receivedByEmployee = value.prod_recieved_by ? results.shift() : null;
    const products = value.products ? results.shift() : null;

    if (value.work_order_number && !workOrder) {
        throw new ApiError(404, `Work order not found with ID: ${value.work_order_number}`);
    }
    if (value.prod_issued_approved_by && !approvedByEmployee) {
        throw new ApiError(404, `Employee not found for prod_issued_approved_by ID: ${value.prod_issued_approved_by}`);
    }
    if (value.prod_recieved_by && !receivedByEmployee) {
        throw new ApiError(404, `Employee not found for prod_recieved_by ID: ${value.prod_recieved_by}`);
    }
    if (value.products) {
        const invalidProduct = products.findIndex((p) => !p);
        if (invalidProduct !== -1) {
            throw new ApiError(400, `Product not found with ID: ${value.products[invalidProduct].product}`);
        }
    }

    // 10. Prepare MongoDB update
    const updateData = {
        $set: {
            ...(value.work_order_number && { work_order_number: value.work_order_number }),
            ...(value.prod_issued_approved_by && { prod_issued_approved_by: value.prod_issued_approved_by }),
            ...(value.prod_recieved_by && { prod_recieved_by: value.prod_recieved_by }),
            ...(value.date && { date: value.date }),
            ...(value.prod_requset_date && { prod_requset_date: value.prod_requset_date }),
            ...(value.prod_requirement_date && { prod_requirement_date: value.prod_requirement_date }),
            ...(value.remarks && { remarks: value.remarks }),
            ...(value.products && { products: value.products }),
            updated_by: value.updated_by,
        },
    };
    if (uploadedFiles.length > 0) {
        updateData.$set.files = uploadedFiles; // Replace files array
    }

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

    // 11. Delete old files from S3 if new files are uploaded
    if (uploadedFiles.length > 0 && existingJobOrder.files && existingJobOrder.files.length > 0) {
        await Promise.all(existingJobOrder.files.map(async (file) => {
            const fileKey = file.file_url.split('/').slice(3).join('/');
            await deleteObject(fileKey);
        }));
    }

    // 12. Populate and format response
    const populatedJobOrder = await falconJobOrder
        .findById(jobOrder._id)
        .populate({
            path: 'work_order_number',
            select: 'client_id project_id work_order_number',
            populate: [
                {
                    path: 'client_id',
                    select: 'name address',
                },
                {
                    path: 'project_id',
                    select: 'name address',
                },
            ],
        })
        .populate({
            path: 'products.product',
            select: 'name',
        })
        .populate({
            path: 'prod_issued_approved_by',
            select: 'name email',
        })
        .populate({
            path: 'prod_recieved_by',
            select: 'name email',
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
    try {

        const jobOrders = await falconJobOrder.find({ _id: { $in: ids } });

        // Collect all file URLs to delete from S3
        const fileKeys = jobOrders.flatMap(jobOrder =>
            jobOrder.files.map(file => {
                const urlParts = file.file_url.split('/');
                return urlParts.slice(3).join('/'); // Extract the key part after the bucket name
            })
        );

        // Delete files from S3
        await Promise.all(fileKeys.map(key => deleteObject(key)));

        // Permanent deletion
        const result = await falconJobOrder.deleteMany({ _id: { $in: ids } });

        if (result.deletedCount === 0) {
            return sendResponse(res, new ApiResponse(404, null, 'No job orders found to delete'));
        }

        return sendResponse(res, new ApiResponse(200, {
            deletedCount: result.deletedCount,
            deletedIds: ids
        }, `${result.deletedCount} job order(s) deleted successfully`));
    } catch {
        console.log('Error:', error);
        return sendResponse(res, new ApiResponse(500, null, 'Error deleting job orders: ' + error.message));
    }
});


const getWorkOrderClientProjectDetails = asyncHandler(async (req, res) => {
    // 1. Get work order ID from params
    const { id } = req.params;

    // 2. Validate the ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid work order ID: ${id}`);
    }

    // 3. Fetch work order with populated client and project
    const workOrder = await falconWorkOrder
        .findById(id)
        .populate({
            path: 'client_id',
            select: 'name address status isDeleted',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name address client status isDeleted',
            match: { isDeleted: false },
        })
        .select('work_order_number client_id project_id date')
        .lean();

    // 4. Check if work order exists
    if (!workOrder) {
        throw new ApiError(404, `Work order not found with ID: ${id}`);
    }

    // 5. Check if client and project exist and are not deleted
    if (!workOrder.client_id) {
        throw new ApiError(404, 'Client not found or has been deleted');
    }
    if (!workOrder.project_id) {
        throw new ApiError(404, 'Project not found or has been deleted');
    }

    // 6. Format response
    const responseData = {
        workOrderId: workOrder._id,
        workOrderNumber: workOrder.work_order_number,
        workOrderDate: workOrder.date,
        client: {
            id: workOrder.client_id._id,
            name: workOrder.client_id.name,
            address: workOrder.client_id.address,
            status: workOrder.client_id.status,
        },
        project: {
            id: workOrder.project_id._id,
            name: workOrder.project_id.name,
            address: workOrder.project_id.address,
            clientId: workOrder.project_id.client,
            status: workOrder.project_id.status,
        },
    };

    // 7. Send response
    return sendResponse(
        res,
        new ApiResponse(200, responseData, 'Client and project details fetched successfully')
    );
});

export { createFalconJobOrder, getFalconJobOrders, updateFalconJobOrder, deleteFalconJobOrder, getFalconJobOrderById, getWorkOrderClientProjectDetails };