import { falconPacking } from '../../models/falconFacade/falconPacking.model.js';
import { falconWorkOrder } from '../../models/falconFacade/falconWorkOrder.model.js';
import { falconJobOrder } from '../../models/falconFacade/falconJobOrder.model.js';
import { falconClient } from '../../models/falconFacade/helpers/falconClient.model.js';
import { falconProject } from '../../models/falconFacade/helpers/falconProject.model.js';
import mongoose from 'mongoose';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { formatDateToIST } from '../../utils/formatDate.js';
import { putObject } from '../../../util/putObject.js';
import { deleteObject } from '../../../util/deleteObject.js';
import { z } from 'zod';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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

// Validation schemas
const fileSchema = Joi.object({
    file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
    file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
    uploaded_at: Joi.date().optional(),
});

const packingSchema = Joi.object({
    work_order: Joi.string()
        .optional()
        .allow(null)
        .custom((value, helpers) => {
            if (value && !mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Work order ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
    job_order_id: Joi.string()
        .optional()
        .allow(null)
        .custom((value, helpers) => {
            if (value && !mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Job order ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
    product: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
    semi_finished_id: Joi.string().required().messages({ 'string.empty': 'Semi-finished ID is required' }),
    semi_finished_quantity: Joi.number().min(0).required().messages({
        'number.base': 'Semi-finished quantity must be a number',
        'number.min': 'Semi-finished quantity must be non-negative',
    }),
    rejected_quantity: Joi.number().min(0).optional().default(0),
    files: Joi.array().items(fileSchema).optional(),
    packed_by: Joi.string()
        .required()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Packed by ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
}).unknown(true); // Allow extra fields in the request body


// Create Packing Bundle (Initial Save) ---- API TO SAVE PACKING DETAILS
// const createPackingBundle = asyncHandler(async (req, res) => {
//     const bodyData = req.body;
//     console.log("bodyData", bodyData);
//     const userId = req.user?._id?.toString();

//     // Validate userId
//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//         throw new ApiError(400, 'Invalid or missing user ID in request');
//     }

//     // Expect an array of packing items (one per semi_finished_id)
//     const packingItems = Array.isArray(bodyData) ? bodyData : [bodyData];
//     const createdPackings = [];

//     for (const item of packingItems) {
//         // Handle file uploads for this item
//         const uploadedFiles = [];
//         if (req.files && req.files.length > 0) {
//             try {
//                 for (const file of req.files) {
//                     const tempFilePath = path.join('./public/temp', file.filename);
//                     const fileBuffer = fs.readFileSync(tempFilePath);
//                     const sanitizedFilename = sanitizeFilename(file.originalname);

//                     // Upload to S3
//                     const { url } = await putObject(
//                         { data: fileBuffer, mimetype: file.mimetype },
//                         `falcon-packing/${Date.now()}-${sanitizedFilename}`
//                     );

//                     // Delete temp file
//                     fs.unlinkSync(tempFilePath);

//                     uploadedFiles.push({
//                         file_name: file.originalname,
//                         file_url: url,
//                         uploaded_at: new Date(),
//                     });
//                 }
//             } catch (error) {
//                 // Cleanup temp files on upload error
//                 if (req.files) {
//                     req.files.forEach((file) => {
//                         const tempFilePath = path.join('./public/temp', file.filename);
//                         if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//                     });
//                 }
//                 throw new ApiError(500, `File upload failed: ${error.message}`);
//             }
//         }

//         // Prepare packing data for this item
//         const packingData = {
//             work_order: item.work_order || null,
//             job_order_id: item.job_order_id || null,
//             product: item.product,
//             semi_finished_id: item.semi_finished_id,
//             semi_finished_quantity: item.semi_finished_quantity,
//             rejected_quantity: item.rejected_quantity || 0,
//             files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
//             packed_by: userId,
//         };

//         // Validate with Joi
//         const { error, value } = packingSchema.validate(packingData, { abortEarly: false });
//         console.log("value",value);
//         if (error) {
//             // Cleanup temp files on validation error
//             if (req.files) {
//                 req.files.forEach((file) => {
//                     const tempFilePath = path.join('./public/temp', file.filename);
//                     if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//                 });
//             }
//             throw new ApiError(400, 'Validation failed for packing creation', error.details);
//         }

//         // Validate referenced documents
//         const [product, jobOrder] = await Promise.all([
//             mongoose.model('falconProduct').findById(value.product),
//             value.job_order_id ? mongoose.model('falconJobOrder').findById(value.job_order_id) : Promise.resolve(null),
//         ]);

//         if (!product) throw new ApiError(400, `Product not found with ID: ${value.product}`);
//         if (value.job_order_id && !jobOrder) throw new ApiError(400, `Job order not found with ID: ${value.job_order_id}`);

//         // Save to MongoDB
//         const packing = await falconPacking.create(value);
//         createdPackings.push(packing._id);
//     }

//     // Populate and format response
//     const populatedPackings = await falconPacking
//         .find({ _id: { $in: createdPackings } })
//         .populate({
//             path: 'product',
//             select: 'name',
//             match: { is_deleted: false },
//         })
//         .populate({
//             path: 'job_order_id',
//             select: 'job_order_id',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'packed_by',
//             select: 'username email',
//             match: { isDeleted: false },
//         })
//         .lean();

//     const formattedPackings = populatedPackings.map((packing) => formatDateToIST(packing));

//     return sendResponse(res, new ApiResponse(201, formattedPackings, 'Packings created successfully'));
// });



const createPackingBundle_11_08_2025 = asyncHandler(async (req, res) => {
    let bodyData = req.body;
    const userId = req.user?._id?.toString();

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // Parse the data field if it exists and is a string
    if (bodyData.data && typeof bodyData.data === 'string') {
        try {
            bodyData = JSON.parse(bodyData.data);
        } catch (error) {
            throw new ApiError(400, 'Invalid JSON format in data field');
        }
    }

    const packingItems = Array.isArray(bodyData) ? bodyData : [bodyData];
    const createdPackings = [];

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../../public/temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Created temp directory:', tempDir);
    }

    // Handle file uploads once
    const uploadedFiles = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
            try {
                const sanitizedFilename = sanitizeFilename(file.originalname);
                const tempFilePath = path.join(tempDir, sanitizedFilename);
                console.log('Temp File Path:', tempFilePath);

                if (!fs.existsSync(file.path)) {
                    throw new Error(`File not found at: ${file.path}`);
                }

                if (file.path !== tempFilePath) {
                    fs.renameSync(file.path, tempFilePath);
                    console.log(`Moved file from ${file.path} to ${tempFilePath}`);
                }

                const fileBuffer = fs.readFileSync(tempFilePath);

                const { url } = await putObject(
                    { data: fileBuffer, mimetype: file.mimetype },
                    `falcon-packing/${Date.now()}-${sanitizedFilename}`
                );

                try {
                    fs.unlinkSync(tempFilePath);
                    console.log('Deleted temp file:', tempFilePath);
                } catch (unlinkError) {
                    console.error('Failed to delete temp file:', unlinkError.message);
                }

                uploadedFiles.push({
                    file_name: file.originalname,
                    file_url: url,
                    uploaded_at: new Date(),
                });
            } catch (error) {
                for (const f of req.files) {
                    const tmp = path.join(tempDir, sanitizeFilename(f.originalname));
                    if (fs.existsSync(tmp)) {
                        try {
                            fs.unlinkSync(tmp);
                            console.log('Cleaned up temp file:', tmp);
                        } catch (err) {
                            console.error('Cleanup error:', err.message);
                        }
                    }
                }
                throw new ApiError(500, `File upload failed: ${error.message}`);
            }
        }
    }

    // Now process each packing item
    for (const item of packingItems) {
        const packingData = {
            work_order: item.work_order || null,
            job_order_id: item.job_order_id || null,
            product: item.product,
            semi_finished_id: item.semi_finished_id,
            semi_finished_quantity: item.semi_finished_quantity,
            rejected_quantity: item.rejected_quantity || 0,
            files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
            packed_by: userId,
        };

        const { error, value } = packingSchema.validate(packingData, { abortEarly: false });
        if (error) {
            throw new ApiError(400, 'Validation failed for packing creation', error.details);
        }

        // Check references
        const [product, jobOrder] = await Promise.all([
            mongoose.model('falconProduct').findById(value.product),
            value.job_order_id
                ? mongoose.model('falconJobOrder').findById(value.job_order_id)
                : Promise.resolve(null),
        ]);

        if (!product) throw new ApiError(400, `Product not found with ID: ${value.product}`);
        if (value.job_order_id && !jobOrder)
            throw new ApiError(400, `Job order not found with ID: ${value.job_order_id}`);

        const packing = await falconPacking.create(value);
        createdPackings.push(packing._id);
    }

    const populatedPackings = await falconPacking
        .find({ _id: { $in: createdPackings } })
        .populate({
            path: 'product',
            select: 'name',
            match: { is_deleted: false },
        })
        .populate({
            path: 'job_order_id',
            select: 'job_order_id',
            match: { isDeleted: false },
        })
        .populate({
            path: 'packed_by',
            select: 'username email',
            match: { isDeleted: false },
        })
        .lean();

    const formattedPackings = populatedPackings.map((packing) => formatDateToIST(packing));

    return sendResponse(res, new ApiResponse(201, formattedPackings, 'Packings created successfully'));
});


const createPackingBundle = asyncHandler(async (req, res) => {
    let bodyData = req.body;
    const userId = req.user?._id?.toString();

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // Parse the data field if it exists and is a string
    if (bodyData.data && typeof bodyData.data === 'string') {
        try {
            bodyData = JSON.parse(bodyData.data);
        } catch (error) {
            throw new ApiError(400, 'Invalid JSON format in data field');
        }
    }

    const packingItems = Array.isArray(bodyData) ? bodyData : [bodyData];
    const createdPackings = [];

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../../public/temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Created temp directory:', tempDir);
    }

    // Handle file uploads once
    const uploadedFiles = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
            try {
                const sanitizedFilename = sanitizeFilename(file.originalname);
                const tempFilePath = path.join(tempDir, sanitizedFilename);
                console.log('Temp File Path:', tempFilePath);

                if (!fs.existsSync(file.path)) {
                    throw new Error(`File not found at: ${file.path}`);
                }

                if (file.path !== tempFilePath) {
                    fs.renameSync(file.path, tempFilePath);
                    console.log(`Moved file from ${file.path} to ${tempFilePath}`);
                }

                const fileBuffer = fs.readFileSync(tempFilePath);

                const { url } = await putObject(
                    { data: fileBuffer, mimetype: file.mimetype },
                    `falcon-packing/${Date.now()}-${sanitizedFilename}`
                );

                try {
                    fs.unlinkSync(tempFilePath);
                    console.log('Deleted temp file:', tempFilePath);
                } catch (unlinkError) {
                    console.error('Failed to delete temp file:', unlinkError.message);
                }

                uploadedFiles.push({
                    file_name: file.originalname,
                    file_url: url,
                    uploaded_at: new Date(),
                });
            } catch (error) {
                for (const f of req.files) {
                    const tmp = path.join(tempDir, sanitizeFilename(f.originalname));
                    if (fs.existsSync(tmp)) {
                        try {
                            fs.unlinkSync(tmp);
                            console.log('Cleaned up temp file:', tmp);
                        } catch (err) {
                            console.error('Cleanup error:', err.message);
                        }
                    }
                }
                throw new ApiError(500, `File upload failed: ${error.message}`);
            }
        }
    }

    // Now process each packing item
    for (const item of packingItems) {
        const packingData = {
            work_order: item.work_order || null,
            job_order_id: item.job_order_id || null,
            product: item.product,
            semi_finished_id: item.semi_finished_id,
            semi_finished_quantity: item.semi_finished_quantity,
            rejected_quantity: item.rejected_quantity || 0,
            files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
            packed_by: userId,
        };

        const { error, value } = packingSchema.validate(packingData, { abortEarly: false });
        if (error) {
            throw new ApiError(400, 'Validation failed for packing creation', error.details);
        }

        // Check achieved_quantity from the last production process
        const lastProduction = await mongoose.model('falconProduction').findOne({
            semifinished_id: value.semi_finished_id,
        }).sort({ createdAt: -1 }); // Latest record

        if (!lastProduction || lastProduction.product.achieved_quantity <= 0) {
            throw new ApiError(400, `Cannot create packing bundle for semi_finished_id ${value.semi_finished_id}. Achieved quantity is zero or production record not found.`);
        }

        // Calculate total packed quantity for this semi_finished_id
        const totalPacked = await falconPacking.aggregate([
            { $match: { semi_finished_id: value.semi_finished_id } },
            { $group: { _id: null, totalPacked: { $sum: "$semi_finished_quantity" } } }
        ]).then(result => result[0]?.totalPacked || 0);

        const remainingQuantity = lastProduction.product.achieved_quantity - totalPacked;
        if (value.semi_finished_quantity > remainingQuantity) {
            throw new ApiError(400, `Cannot pack ${value.semi_finished_quantity} units for semi_finished_id ${value.semi_finished_id}. Only ${remainingQuantity} units remain available.`);
        }

        // Check references
        const [product, jobOrder] = await Promise.all([
            mongoose.model('falconProduct').findById(value.product),
            value.job_order_id
                ? mongoose.model('falconJobOrder').findById(value.job_order_id)
                : Promise.resolve(null),
        ]);

        if (!product) throw new ApiError(400, `Product not found with ID: ${value.product}`);
        if (value.job_order_id && !jobOrder)
            throw new ApiError(400, `Job order not found with ID: ${value.job_order_id}`);

        const packing = await falconPacking.create(value);
        createdPackings.push(packing._id);
    }

    const populatedPackings = await falconPacking
        .find({ _id: { $in: createdPackings } })
        .populate({
            path: 'product',
            select: 'name',
            match: { is_deleted: false },
        })
        .populate({
            path: 'job_order_id',
            select: 'job_order_id',
            match: { isDeleted: false },
        })
        .populate({
            path: 'packed_by',
            select: 'username email',
            match: { isDeleted: false },
        })
        .lean();

    const formattedPackings = populatedPackings.map((packing) => formatDateToIST(packing));

    return sendResponse(res, new ApiResponse(201, formattedPackings, 'Packings created successfully'));
});

// Update Falcon Packing with QR ----- API TO SAVE PACKING QR DETAILS


const createPackingSchema = z.object({
    packings: z.array(
        z.object({
            packing_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
                message: 'Invalid packing ID',
            }),
            qrCodeId: z.string().min(1, 'QR code ID is required'),
        })
    ).min(1, 'At least one packing record is required'),
}).strict();

const createFalconPacking_11_08_2025 = asyncHandler(async (req, res) => {
    try {
        // Debug: Log the request body
        // console.log('Request body:', req.body);

        // 1. Check for authenticated user
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User not authenticated',
            });
        }
        const userId = req.user._id.toString();

        // 2. Validate input and debug schema
        console.log('qrPackingSchema:', createPackingSchema, createPackingSchema.parse);
        const validatedData = createPackingSchema.parse(req.body);
        const { packings } = validatedData;
        console.log('Validated packings:', packings);

        // 3. Process each packing record
        const updatedPackings = [];
        const errors = [];

        for (const { packing_id, qrCodeId } of packings) {
            try {
                const packing = await falconPacking.findById(packing_id);
                if (!packing) {
                    throw new Error('Packing record not found');
                }

                // Generate QR code
                let qrCodeBuffer;
                try {
                    qrCodeBuffer = await QRCode.toBuffer(qrCodeId, {
                        type: 'png',
                        errorCorrectionLevel: 'H',
                        margin: 1,
                        width: 200,
                    });
                } catch (error) {
                    throw new Error(`Failed to generate QR code for ${qrCodeId}: ${error.message}`);
                }

                // Upload QR code to S3
                const fileName = `qr-codes/${packing_id}-${Date.now()}.png`;
                const file = {
                    data: qrCodeBuffer,
                    mimetype: 'image/png',
                };
                let qrCodeUrl;
                try {
                    const { url } = await putObject(file, fileName);
                    qrCodeUrl = url;
                } catch (error) {
                    throw new Error(`Failed to upload QR code to S3 for ${qrCodeId}: ${error.message}`);
                }

                // Update packing record
                const updatedPacking = await falconPacking.findByIdAndUpdate(
                    packing_id,
                    {
                        qr_id: qrCodeId,
                        qr_code: qrCodeUrl,
                        delivery_stage: 'Packed',
                        updated_by: userId,
                    },
                    { new: true, runValidators: true }
                );

                if (!updatedPacking) {
                    throw new Error('Packing record not found');
                }

                updatedPackings.push(updatedPacking);
            } catch (error) {
                errors.push({
                    packing_id,
                    qrCodeId,
                    error: error.message,
                });
            }
        }

        // 4. Handle response based on results
        if (errors.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Packing records updated with QR successfully',
                data: updatedPackings,
            });
        } else if (updatedPackings.length > 0) {
            return res.status(207).json({
                success: false,
                message: 'Some packing updates failed',
                errors,
                updated: updatedPackings,
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'All packing updates failed',
                errors,
            });
        }
    } catch (error) {
        // Handle Joi validation errors
        if (error instanceof Joi.ValidationError) {
            console.error('Validation errors:', error.details);
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        // Handle Mongoose validation errors
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

        // Handle duplicate key errors (e.g., unique qr_id)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate QR code ID',
                field: Object.keys(error.keyPattern)[0],
            });
        }

        // Handle other errors
        console.error('Error updating Packing with QR:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
});




const createFalconPacking = asyncHandler(async (req, res) => {
    try {
        // Debug: Log the request body
        console.log('Request body:', req.body);

        // 1. Check for authenticated user
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User not authenticated',
            });
        }
        const userId = req.user._id.toString();

        // 2. Validate input and debug schema
        console.log('qrPackingSchema:', createPackingSchema, createPackingSchema.parse);
        const validatedData = createPackingSchema.parse(req.body);
        const { packings } = validatedData;
        console.log('Validated packings:', packings);

        // 3. Process each packing record
        const updatedPackings = [];
        const errors = [];

        for (const { packing_id, qrCodeId } of packings) {
            try {
                const packing = await falconPacking.findById(packing_id);
                if (!packing) {
                    throw new Error('Packing record not found');
                }

                // Check achieved_quantity from the last production process
                const lastProduction = await mongoose.model('falconProduction').findOne({
                    semifinished_id: packing.semi_finished_id,
                }).sort({ createdAt: -1 }); // Latest record

                if (!lastProduction || lastProduction.product.achieved_quantity <= 0) {
                    throw new Error(`Cannot update packing for semi_finished_id ${packing.semi_finished_id}. Achieved quantity is zero or production record not found.`);
                }

                // Generate QR code
                let qrCodeBuffer;
                try {
                    qrCodeBuffer = await QRCode.toBuffer(qrCodeId, {
                        type: 'png',
                        errorCorrectionLevel: 'H',
                        margin: 1,
                        width: 200,
                    });
                } catch (error) {
                    throw new Error(`Failed to generate QR code for ${qrCodeId}: ${error.message}`);
                }

                // Upload QR code to S3
                const fileName = `qr-codes/${packing_id}-${Date.now()}.png`;
                const file = {
                    data: qrCodeBuffer,
                    mimetype: 'image/png',
                };
                let qrCodeUrl;
                try {
                    const { url } = await putObject(file, fileName);
                    qrCodeUrl = url;
                } catch (error) {
                    throw new Error(`Failed to upload QR code to S3 for ${qrCodeId}: ${error.message}`);
                }

                // Update packing record
                const updatedPacking = await falconPacking.findByIdAndUpdate(
                    packing_id,
                    {
                        qr_id: qrCodeId,
                        qr_code: qrCodeUrl,
                        delivery_stage: 'Packed',
                        updated_by: userId,
                    },
                    { new: true, runValidators: true }
                );

                if (!updatedPacking) {
                    throw new Error('Packing record not found');
                }

                updatedPackings.push(updatedPacking);
            } catch (error) {
                errors.push({
                    packing_id,
                    qrCodeId,
                    error: error.message,
                });
            }
        }

        // 4. Handle response based on results
        if (errors.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Packing records updated with QR successfully',
                data: updatedPackings,
            });
        } else if (updatedPackings.length > 0) {
            return res.status(207).json({
                success: false,
                message: 'Some packing updates failed',
                errors,
                updated: updatedPackings,
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'All packing updates failed',
                errors,
            });
        }
    } catch (error) {
        // Handle Joi validation errors
        if (error instanceof Joi.ValidationError) {
            console.error('Validation errors:', error.details);
            return res.status(400).json({
                success: false,
                errors: error.details.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        // Handle Mongoose validation errors
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

        // Handle duplicate key errors (e.g., unique qr_id)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate QR code ID',
                field: Object.keys(error.keyPattern)[0],
            });
        }

        // Handle other errors
        console.error('Error updating Packing with QR:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
});





// Get All Packings
// const getAllFalconPackings = asyncHandler(async (req, res) => {
//     const packings = await falconPacking
//         .find()
//         .populate({
//             path: 'product',
//             select: 'name',

//         })
//         .populate({
//             path: 'work_order',
//             select: 'work_order_number',

//         })
//         .populate({
//             path: 'job_order_id',
//             select: 'job_order_id',
//             match: { isDeleted: false },
//         })
//         .populate({
//             path: 'packed_by',
//             select: 'username email',
//             match: { isDeleted: false },
//         })
//         .lean();

//     // Convert timestamps to IST
//     const formattedPackings = packings.map(formatDateToIST);

//     return sendResponse(res, new ApiResponse(200, formattedPackings, 'Packings retrieved successfully'));
// });

const getAllFalconPackings = asyncHandler(async (req, res) => {
    const packingData = await falconPacking
        .aggregate([
            // Group by work_order and product to aggregate data
            {
                $group: {
                    _id: {
                        work_order: '$work_order',
                        product: '$product',
                    },
                    totalSemiFinishedQuantity: { $sum: '$semi_finished_quantity' },
                    rejectedQuantity: { $sum: '$rejected_quantity' },
                    semiFinishedIds: { $push: '$semi_finished_id' },
                    deliveryStages: { $addToSet: '$delivery_stage' },
                    qrIds: { $addToSet: '$qr_id' },
                    qrCodes: { $addToSet: '$qr_code' },
                    packedBy: { $addToSet: '$packed_by' },
                    files: { $push: '$files' },
                    latestCreatedAt: { $max: '$createdAt' },
                    latestUpdatedAt: { $max: '$updatedAt' },
                },
            },
            // Populate work_order details
            {
                $lookup: {
                    from: 'falconworkorders',
                    localField: '_id.work_order',
                    foreignField: '_id',
                    as: 'workOrder',
                },
            },
            // Unwind workOrder
            {
                $unwind: {
                    path: '$workOrder',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Populate product details
            {
                $lookup: {
                    from: 'falconproducts',
                    localField: '_id.product',
                    foreignField: '_id',
                    as: 'product',
                },
            },
            // Unwind product
            {
                $unwind: {
                    path: '$product',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Populate packed_by details
            {
                $lookup: {
                    from: 'users',
                    localField: 'packedBy',
                    foreignField: '_id',
                    as: 'packedBy',
                    pipeline: [
                        // { $match: { isDeleted: false } },
                        { $project: { username: 1 } },
                    ],
                },
            },
            // Unwind packedBy
            {
                $unwind: {
                    path: '$packedBy',
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Group back to get the username
            {
                $group: {
                    _id: {
                        work_order: '$_id.work_order',
                        product: '$_id.product',
                    },
                    totalSemiFinishedQuantity: { $first: '$totalSemiFinishedQuantity' },
                    rejectedQuantity: { $first: '$rejectedQuantity' },
                    semiFinishedIds: { $first: '$semiFinishedIds' },
                    deliveryStages: { $first: '$deliveryStages' },
                    qrIds: { $first: '$qrIds' },
                    qrCodes: { $first: '$qrCodes' },
                    packedBy: { $first: '$packedBy.username' },
                    files: { $first: '$files' },
                    workOrder: { $first: '$workOrder' },
                    product: { $first: '$product' },
                    latestCreatedAt: { $first: '$latestCreatedAt' },
                    latestUpdatedAt: { $first: '$latestUpdatedAt' },
                },
            },
            // Project the final structure
            {
                $project: {
                    _id: 0,
                    workOrderId: '$workOrder._id',
                    workOrderNumber: '$workOrder.work_order_number',
                    productId: '$product._id',
                    productName: '$product.name',
                    totalSemiFinishedQuantity: 1,
                    rejectedQuantity: 1,
                    semiFinishedIds: 1,
                    deliveryStage: { $arrayElemAt: ['$deliveryStages', 0] },
                    qrIds: { $filter: { input: '$qrIds', as: 'id', cond: { $ne: ['$$id', null] } } },
                    qrCodes: { $filter: { input: '$qrCodes', as: 'code', cond: { $ne: ['$$code', null] } } },
                    packedBy: 1,
                    files: {
                        $reduce: {
                            input: '$files',
                            initialValue: [],
                            in: { $concatArrays: ['$$value', '$$this'] },
                        },
                    },
                    createdAt: '$latestCreatedAt',
                    updatedAt: '$latestUpdatedAt',
                },
            },
            // Sort by workOrderNumber and productName
            {
                $sort: {
                    workOrderNumber: 1,
                    productName: 1,
                },
            },
        ])
        .exec();

    if (!packingData.length) {
        return sendResponse(res, new ApiResponse(404, [], 'No packing data found'));
    }

    // Format timestamps to IST
    const formattedPackingData = packingData.map(item => ({
        ...item,
        createdAt: item.createdAt ? item.createdAt : null,
        updatedAt: item.updatedAt ? item.updatedAt : null,
        files: item.files.map(file => ({
            ...file,
            uploaded_at: file.uploaded_at ? file.uploaded_at : null,
        })),
    }));

    return sendResponse(res, new ApiResponse(200, formattedPackingData, 'Work order and product-wise packing data retrieved successfully'));
});


// Get Packing by ID
const getFalconPackingById = asyncHandler(async (req, res) => {
    try {
        const { workOrderId } = req.params;

        const workOrderDetails = await falconWorkOrder.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(workOrderId) } },
            {
                $lookup: {
                    from: 'falconclients',
                    localField: 'client_id',
                    foreignField: '_id',
                    as: 'clientDetails'
                }
            },
            {
                $lookup: {
                    from: 'falconprojects',
                    localField: 'project_id',
                    foreignField: '_id',
                    as: 'projectDetails'
                }
            },
            {
                $lookup: {
                    from: 'falconjoborders',
                    localField: '_id',
                    foreignField: 'work_order_number',
                    as: 'jobOrderDetails'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'createdByDetails'
                }
            },
            {
                $lookup: {
                    from: 'falconpackings',
                    let: { workOrderId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$work_order', '$$workOrderId']
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'packed_by',
                                foreignField: '_id',
                                as: 'packedByDetails'
                            }
                        },
                        {
                            $lookup: {
                                from: 'falconproducts',
                                localField: 'product',
                                foreignField: '_id',
                                as: 'productDetails'
                            }
                        },
                        {
                            $unwind: '$packedByDetails'
                        },
                        {
                            $unwind: '$productDetails'
                        },
                        {
                            $project: {
                                semiFinishedId: '$semi_finished_id',
                                sfQuantity: '$semi_finished_quantity',
                                packedBy: '$packedByDetails.username',
                                qrCodes: '$qr_code',
                                qrIds: '$qr_id',
                                productName: '$productDetails.name'
                            }
                        }
                    ],
                    as: 'packingDetails'
                }
            },
            {
                $project: {
                    clientDetails: { $arrayElemAt: ['$clientDetails', 0] },
                    projectDetails: { $arrayElemAt: ['$projectDetails', 0] },
                    jobOrderDetails: { $arrayElemAt: ['$jobOrderDetails', 0] },
                    createdByDetails: { $arrayElemAt: ['$createdByDetails', 0] },
                    packingDetails: 1,
                    workOrderNumber: 1,
                    work_order_number: 1, // Include work_order_number in the projection
                    date: 1,
                    status: 1
                }
            }
        ]);

        if (!workOrderDetails.length) {
            return res.status(404).json({
                statusCode: 404,
                success: false,
                message: 'Work order not found'
            });
        }

        const response = {
            statusCode: 200,
            success: true,
            message: 'Job order fetched successfully',
            data: {
                clientProjectDetails: {
                    clientName: workOrderDetails[0].clientDetails.name,
                    clientId: workOrderDetails[0].clientDetails._id,
                    address: workOrderDetails[0].clientDetails.address,
                    projectName: workOrderDetails[0].projectDetails.name,
                    projectId: workOrderDetails[0].projectDetails._id
                },
                workOrderDetails: {
                    workOrderId: workOrderDetails[0]._id,
                    workOrderNumber: workOrderDetails[0].work_order_number, // Include work_order_number in the response
                    job_order_id: workOrderDetails[0].jobOrderDetails._id,
                    jobOrderNumber: workOrderDetails[0].jobOrderDetails.job_order_id,
                    status: workOrderDetails[0].status,
                    totalSemiFinishedQuantity: workOrderDetails[0].packingDetails.reduce((sum, item) => sum + item.sfQuantity, 0),
                    uom: workOrderDetails[0].jobOrderDetails.products[0].uom,
                    workOrderDate: workOrderDetails[0].date,
                    createdAt: workOrderDetails[0].createdAt,
                    createdBy: workOrderDetails[0].createdByDetails.username
                },
                productsDetails: workOrderDetails[0].packingDetails.map(detail => ({
                    workOrderNumber: workOrderDetails[0].work_order_number, // Include work_order_number in productsDetails
                    jobOrderNumber: workOrderDetails[0].jobOrderDetails.job_order_id,
                    clientName: workOrderDetails[0].clientDetails.name,
                    projectName: workOrderDetails[0].projectDetails.name,
                    productName: detail.productName,
                    sf_id: detail.semiFinishedId,
                    sf_quantity: detail.sfQuantity,
                    createdBy: detail.packedBy,
                    qr_code: detail.qrCodes,
                    qr_id: detail.qrIds
                }))
            }
        };

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
});


const getJobOrderByWorkOrder = asyncHandler(async (req, res) => {
    try {
        const { workOrderId } = req.params;

        // Check if workOrderId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
            return res.status(400).json({
                statusCode: 400,
                success: false,
                message: 'Invalid work order ID format'
            });
        }

        // Fetch job order details based on work_order_number
        const jobOrderDetails = await falconJobOrder.aggregate([
            {
                $match: {
                    work_order_number: new mongoose.Types.ObjectId(workOrderId)
                }
            },
            {
                $project: {
                    _id: 1,
                    job_order_id: 1
                }
            }
        ]);

        if (!jobOrderDetails.length) {
            return res.status(404).json({
                statusCode: 404,
                success: false,
                message: 'Job order not found for the given work order ID'
            });
        }

        const response = {
            statusCode: 200,
            success: true,
            message: 'Job order fetched successfully',
            data: jobOrderDetails
        };

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
});


// const getWorkOrderDetails = asyncHandler(async (req, res) => {
//     try {
//         const { workOrderId, jobOrderId } = req.params;

//         // Validate the workOrderId and jobOrderId
//         if (!mongoose.Types.ObjectId.isValid(workOrderId) || !mongoose.Types.ObjectId.isValid(jobOrderId)) {
//             return res.status(400).json({
//                 statusCode: 400,
//                 success: false,
//                 message: 'Invalid work order ID or job order ID format'
//             });
//         }

//         // Fetch job order details and calculate achieved quantities
//         const jobOrderDetails = await falconJobOrder.aggregate([
//             {
//                 $match: {
//                     _id: new mongoose.Types.ObjectId(jobOrderId),
//                     work_order_number: new mongoose.Types.ObjectId(workOrderId)
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'falconproductions',
//                     localField: '_id',
//                     foreignField: 'job_order',
//                     as: 'productionDetails'
//                 }
//             },
//             {
//                 $unwind: { path: '$productionDetails', preserveNullAndEmptyArrays: true }
//             },
//             {
//                 $lookup: {
//                     from: 'falconinternalworkorders',
//                     let: { job_order_id: '$_id', products: '$products' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: { $eq: ['$job_order_id', '$$job_order_id'] }
//                             }
//                         },
//                         {
//                             $unwind: '$products'
//                         },
//                         {
//                             $match: {
//                                 $expr: {
//                                     $in: ['$products.product', {
//                                         $map: {
//                                             input: '$$products',
//                                             as: 'prod',
//                                             in: '$$prod.product'
//                                         }
//                                     }]
//                                 }
//                             }
//                         },
//                         {
//                             $group: {
//                                 _id: '$products.product',
//                                 semifinished_ids: { $push: '$products.semifinished_details.semifinished_id' }
//                             }
//                         },
//                         {
//                             $project: {
//                                 product_id: '$_id',
//                                 semifinished_ids: {
//                                     $reduce: {
//                                         input: '$semifinished_ids',
//                                         initialValue: [],
//                                         in: { $concatArrays: ['$$value', '$$this'] }
//                                     }
//                                 }
//                             }
//                         }
//                     ],
//                     as: 'internalWorkOrderDetails'
//                 }
//             },
//             {
//                 $group: {
//                     _id: '$_id',
//                     job_order_id: { $first: '$job_order_id' },
//                     work_order_number: { $first: '$work_order_number' },
//                     date: { $first: '$date' },
//                     prod_requset_date: { $first: '$prod_requset_date' },
//                     prod_requirement_date: { $first: '$prod_requirement_date' },
//                     products: { $first: '$products' },
//                     achievedQuantities: {
//                         $push: {
//                             product_id: '$productionDetails.product.product_id',
//                             achieved_quantity: '$productionDetails.product.achieved_quantity'
//                         }
//                     },
//                     internalWorkOrderDetails: { $first: '$internalWorkOrderDetails' }
//                 }
//             },
//             {
//                 $project: {
//                     _id: 1,
//                     job_order_id: 1,
//                     work_order_number: 1,
//                     date: 1,
//                     prod_requset_date: 1,
//                     prod_requirement_date: 1,
//                     products: {
//                         $map: {
//                             input: '$products',
//                             as: 'product',
//                             in: {
//                                 $mergeObjects: [
//                                     '$$product',
//                                     {
//                                         achieved_quantity: {
//                                             $reduce: {
//                                                 input: {
//                                                     $filter: {
//                                                         input: '$achievedQuantities',
//                                                         as: 'aq',
//                                                         cond: { $eq: ['$$aq.product_id', '$$product.product'] }
//                                                     }
//                                                 },
//                                                 initialValue: 0,
//                                                 in: { $add: ['$$value', '$$this.achieved_quantity'] }
//                                             }
//                                         },
//                                         semifinished_ids: {
//                                             $let: {
//                                                 vars: {
//                                                     matchingWorkOrder: {
//                                                         $filter: {
//                                                             input: '$internalWorkOrderDetails',
//                                                             as: 'iwo',
//                                                             cond: { $eq: ['$$iwo.product_id', '$$product.product'] }
//                                                         }
//                                                     }
//                                                 },
//                                                 in: {
//                                                     $cond: {
//                                                         if: { $gt: [{ $size: '$$matchingWorkOrder' }, 0] },
//                                                         then: { $arrayElemAt: ['$$matchingWorkOrder.semifinished_ids', 0] },
//                                                         else: []
//                                                     }
//                                                 }
//                                             }
//                                         }
//                                     }
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             }
//         ]);

//         console.log("jobOrderDetails", jobOrderDetails);

//         if (!jobOrderDetails.length) {
//             return res.status(404).json({
//                 statusCode: 404,
//                 success: false,
//                 message: 'Job order not found for the given work order ID and job order ID'
//             });
//         }

//         const response = {
//             statusCode: 200,
//             success: true,
//             message: 'Job order details fetched successfully',
//             data: jobOrderDetails[0]
//         };

//         res.json(response);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({
//             statusCode: 500,
//             success: false,
//             message: 'Internal server error'
//         });
//     }
// });

const getWorkOrderDetails_11_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { workOrderId, jobOrderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(workOrderId) || !mongoose.Types.ObjectId.isValid(jobOrderId)) {
            return res.status(400).json({
                statusCode: 400,
                success: false,
                message: 'Invalid work order ID or job order ID format'
            });
        }

        const jobOrderDetails = await falconJobOrder.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(jobOrderId),
                    work_order_number: new mongoose.Types.ObjectId(workOrderId)
                }
            },
            {
                $lookup: {
                    from: 'falconinternalworkorders',
                    let: { job_order_id: '$_id', products: '$products' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$job_order_id', '$$job_order_id'] }
                            }
                        },
                        { $unwind: '$products' },
                        {
                            $project: {
                                product_id: '$products.product',
                                semifinished_ids: '$products.semifinished_details.semifinished_id'
                            }
                        },
                        { $unwind: '$semifinished_ids' },
                        {
                            $group: {
                                _id: { product_id: '$product_id', semifinished_id: '$semifinished_ids' },
                            }
                        },
                        {
                            $group: {
                                _id: '$_id.product_id',
                                semifinished_ids: { $addToSet: '$_id.semifinished_id' }
                            }
                        },
                        {
                            $project: {
                                product_id: '$_id',
                                semifinished_ids: 1,
                                _id: 0
                            }
                        }
                    ],
                    as: 'internalWorkOrderDetails'
                }
            },
            {
                $lookup: {
                    from: 'falconproductions',
                    let: { job_order_id: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$job_order', '$$job_order_id'] }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    product_id: '$product.product_id',
                                    semifinished_id: '$semifinished_id'
                                },
                                min_achieved: { $min: '$product.achieved_quantity' }
                            }
                        },
                        {
                            $group: {
                                _id: '$_id.product_id',
                                min_achieved_set: { $addToSet: '$min_achieved' }
                            }
                        },
                        {
                            $project: {
                                product_id: '$_id',
                                achieved_quantity: { $min: '$min_achieved_set' },
                                _id: 0
                            }
                        }
                    ],
                    as: 'productionAggregates'
                }
            },
            {
                $project: {
                    _id: 1,
                    job_order_id: 1,
                    work_order_number: 1,
                    date: 1,
                    prod_requset_date: 1,
                    prod_requirement_date: 1,
                    products: {
                        $map: {
                            input: '$products',
                            as: 'product',
                            in: {
                                $mergeObjects: [
                                    '$$product',
                                    {
                                        achieved_quantity: {
                                            $let: {
                                                vars: {
                                                    matchProd: {
                                                        $filter: {
                                                            input: '$productionAggregates',
                                                            as: 'agg',
                                                            cond: { $eq: ['$$agg.product_id', '$$product.product'] }
                                                        }
                                                    }
                                                },
                                                in: {
                                                    $cond: [
                                                        { $gt: [{ $size: '$$matchProd' }, 0] },
                                                        { $arrayElemAt: ['$$matchProd.achieved_quantity', 0] },
                                                        0
                                                    ]
                                                }
                                            }
                                        },
                                        semifinished_ids: {
                                            $let: {
                                                vars: {
                                                    matchingWorkOrder: {
                                                        $filter: {
                                                            input: '$internalWorkOrderDetails',
                                                            as: 'iwo',
                                                            cond: { $eq: ['$$iwo.product_id', '$$product.product'] }
                                                        }
                                                    }
                                                },
                                                in: {
                                                    $cond: {
                                                        if: { $gt: [{ $size: '$$matchingWorkOrder' }, 0] },
                                                        then: { $arrayElemAt: ['$$matchingWorkOrder.semifinished_ids', 0] },
                                                        else: []
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]);
        // console.log("jobOrderDetails", jobOrderDetails.internalWorkOrderDetails);

        if (!jobOrderDetails.length) {
            return res.status(404).json({
                statusCode: 404,
                success: false,
                message: 'Job order not found for the given work order ID and job order ID'
            });
        }

        res.status(200).json({
            statusCode: 200,
            success: true,
            message: 'Job order details fetched successfully',
            data: jobOrderDetails[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
});





const getWorkOrderDetails = asyncHandler(async (req, res) => {
    try {
        const { workOrderId, jobOrderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(workOrderId) || !mongoose.Types.ObjectId.isValid(jobOrderId)) {
            return res.status(400).json({
                statusCode: 400,
                success: false,
                message: 'Invalid work order ID or job order ID format'
            });
        }

        const jobOrderDetails = await falconJobOrder.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(jobOrderId),
                    work_order_number: new mongoose.Types.ObjectId(workOrderId)
                }
            },
            {
                $lookup: {
                    from: 'falconinternalworkorders',
                    let: { job_order_id: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$job_order_id', '$$job_order_id'] }
                            }
                        },
                        { $unwind: '$products' },
                        {
                            $project: {
                                _id: 0,
                                product_id: '$products.product',
                                semifinished_id: { $arrayElemAt: ['$products.semifinished_details.semifinished_id', 0] },
                                code: '$products.code'
                            }
                        }
                    ],
                    as: 'internalWorkOrderDetails'
                }
            },
            {
                $lookup: {
                    from: 'falconproductions',
                    let: { job_order_id: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$job_order', '$$job_order_id'] }
                            }
                        },
                        { $unwind: '$product' },
                        {
                            $project: {
                                _id: 0,
                                product_id: '$product.product_id',
                                semifinished_id: '$semifinished_id',
                                achieved_quantity: '$product.achieved_quantity'
                            }
                        }
                    ],
                    as: 'productionAggregates'
                }
            },
            {
                $addFields: {
                    products: {
                        $map: {
                            input: '$products',
                            as: 'p',
                            in: {
                                $mergeObjects: [
                                    '$$p',
                                    {
                                        semifinished_ids: {
                                            $map: {
                                                input: {
                                                    $filter: {
                                                        input: '$internalWorkOrderDetails',
                                                        as: 'iwo',
                                                        cond: {
                                                            $and: [
                                                                { $eq: ['$$iwo.product_id', '$$p.product'] },
                                                                { $eq: ['$$iwo.code', '$$p.code'] }
                                                            ]
                                                        }
                                                    }
                                                },
                                                as: 'm',
                                                in: '$$m.semifinished_id'
                                            }
                                        },
                                        achieved_quantity: {
                                            $let: {
                                                vars: {
                                                    matchProd: {
                                                        $filter: {
                                                            input: '$productionAggregates',
                                                            as: 'pa',
                                                            cond: {
                                                                $and: [
                                                                    { $eq: ['$$pa.product_id', '$$p.product'] },
                                                                    {
                                                                        $in: ['$$pa.semifinished_id',
                                                                            {
                                                                                $map: {
                                                                                    input: {
                                                                                        $filter: {
                                                                                            input: '$internalWorkOrderDetails',
                                                                                            as: 'iwo',
                                                                                            cond: {
                                                                                                $and: [
                                                                                                    { $eq: ['$$iwo.product_id', '$$p.product'] },
                                                                                                    { $eq: ['$$iwo.code', '$$p.code'] }
                                                                                                ]
                                                                                            }
                                                                                        }
                                                                                    },
                                                                                    as: 'm',
                                                                                    in: '$$m.semifinished_id'
                                                                                }
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                in: {
                                                    $cond: [
                                                        { $gt: [{ $size: '$$matchProd' }, 0] },
                                                        { $arrayElemAt: ['$$matchProd.achieved_quantity', 0] },
                                                        0
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    job_order_id: 1,
                    work_order_number: 1,
                    date: 1,
                    prod_requset_date: 1,
                    prod_requirement_date: 1,
                    products: 1
                }
            }
        ]);

        if (!jobOrderDetails.length) {
            return res.status(404).json({
                statusCode: 404,
                success: false,
                message: 'Job order not found'
            });
        }

        res.status(200).json({
            statusCode: 200,
            success: true,
            message: 'Job order details fetched successfully',
            data: jobOrderDetails[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
});





export { createPackingBundle, createFalconPacking, getAllFalconPackings, getFalconPackingById, getJobOrderByWorkOrder, getWorkOrderDetails };

