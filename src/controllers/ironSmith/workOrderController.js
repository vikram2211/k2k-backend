import { ironWorkOrder } from "../../models/ironSmith/workOrder.model.js";
import { RawMaterial } from "../../models/ironSmith/helpers/client-project-qty.model.js";
import { Diameter } from "../../models/ironSmith/helpers/projectDia.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { putObject } from "../../../util/putObject.js";
import { deleteObject } from '../../../util/deleteObject.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Joi from 'joi';
import moment from 'moment';


const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};


//////////////////POST API - To Create iron work order 

const createIronWorkOrder_04_08_2025 = asyncHandler(async (req, res) => {
    // 1. Validation schema
    const dimensionSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Dimension name is required' }),
        value: Joi.string().required().messages({ 'string.empty': 'Dimension value is required' }),
    });

    const fileSchema = Joi.object({
        file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
        file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
        uploaded_at: Joi.date().optional(),
    });

    const productSchema = Joi.object({
        shapeId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        quantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        // plantCode: Joi.string().required().messages({ 'string.empty': 'Plant code is required' }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        barMark: Joi.string().optional().allow(''),
        memberDetails: Joi.string().optional().allow(''),
        memberQuantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        diameter: Joi.number().min(0).required().messages({
            'number.base': 'Diameter must be a number'
        }),
        weight: Joi.string().optional().allow(''),
        dimensions: Joi.array().items(dimensionSchema).optional(),
    });

    const workOrderSchema = Joi.object({
        clientId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        projectId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        workOrderNumber: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
        workOrderDate: Joi.date().required().messages({ 'date.base': 'Work order date must be a valid date' }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        products: Joi.array().items(productSchema).min(1).required().messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array().items(fileSchema).optional(),
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

    // 4. Handle file uploads (optional)
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
        try {
            for (const file of req.files) {
                const tempFilePath = path.join('./public/temp', file.filename);
                const fileBuffer = fs.readFileSync(tempFilePath);
                const sanitizedFilename = sanitizeFilename(file.originalname);

                // Validate file type
                // const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
                // if (!allowedTypes.includes(file.mimetype)) {
                //     fs.unlinkSync(tempFilePath);
                //     throw new ApiError(400, `Invalid file type for ${file.originalname}. Allowed types: ${allowedTypes.join(', ')}`);
                // }

                // Validate file size (max 5MB)
                const maxFileSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxFileSize) {
                    fs.unlinkSync(tempFilePath);
                    throw new ApiError(400, `File ${file.originalname} exceeds maximum size of 5MB`);
                }

                // Upload to S3
                const { url } = await putObject(
                    { data: fileBuffer, mimetype: file.mimetype },
                    `iron-work-orders/${Date.now()}-${sanitizedFilename}`
                );

                // Delete temp file
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (error) {
                    console.error(`Failed to delete temp file ${tempFilePath}:`, error);
                }

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
        workOrderDate: bodyData.workOrderDate ? new Date(bodyData.workOrderDate) : undefined,
        deliveryDate: bodyData.deliveryDate ? new Date(bodyData.deliveryDate) : undefined,
        created_by: userId,
        updated_by: userId,
    };

    // 6. Validate with Joi
    const { error, value } = workOrderSchema.validate(workOrderData, { abortEarly: false });
    if (error) {
        // Cleanup temp files on validation error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        console.log("errorrrrr", error.details);
        throw new ApiError(400, 'Validation failed for work order creation', error.details);
    }

    // 7. Validate referenced documents
    const [client, project, shapes] = await Promise.all([
        mongoose.model('ironClient').findById(value.clientId),
        mongoose.model('ironProject').findById(value.projectId),
        Promise.all(value.products.map((p) => mongoose.model('ironShape').findById(p.shapeId))),
    ]);

    if (!client) throw new ApiError(404, `Client not found with ID: ${value.clientId}`);
    if (!project) throw new ApiError(404, `Project not found with ID: ${value.projectId}`);
    const invalidShape = shapes.findIndex((s) => !s);
    if (invalidShape !== -1) {
        throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shapeId}`);
    }

    // 8. Save to MongoDB
    const workOrder = await ironWorkOrder.create(value);

    // 9. Populate and format response
    const populatedWorkOrder = await ironWorkOrder
        .findById(workOrder._id)
        .populate({
            path: 'clientId',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'projectId',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'products.shapeId',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate({
            path: 'created_by',
            select: 'username email',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'updated_by',
            select: 'username email',
            // match: { isDeleted: false },
        })
        .lean();

    if (!populatedWorkOrder) {
        throw new ApiError(404, 'Failed to retrieve created work order');
    }

    // Convert timestamps to IST
    const formatDateToIST = (data) => {
        const convertToIST = (date) => {
            if (!date) return null;
            return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        };
        return {
            ...data,
            workOrderDate: convertToIST(data.workOrderDate),
            deliveryDate: convertToIST(data.deliveryDate),
            createdAt: convertToIST(data.createdAt),
            updatedAt: convertToIST(data.updatedAt),
            products: data.products.map((p) => ({
                ...p,
            })),
            files: data.files.map((f) => ({
                ...f,
                uploaded_at: convertToIST(f.uploaded_at),
            })),
        };
    };

    const formattedWorkOrder = formatDateToIST(populatedWorkOrder);

    return res.status(201).json(new ApiResponse(201, formattedWorkOrder, 'Work order created successfully'));
});


const createIronWorkOrder_19_09_2025 = asyncHandler(async (req, res) => {
    // 1. Validation schema (updated to require weight as a number)
    const dimensionSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Dimension name is required' }),
        value: Joi.string().required().messages({ 'string.empty': 'Dimension value is required' }),
    });

    const fileSchema = Joi.object({
        file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
        file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
        uploaded_at: Joi.date().optional(),
    });

    const productSchema = Joi.object({
        shapeId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        quantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        barMark: Joi.string().optional().allow(''),
        memberDetails: Joi.string().optional().allow(''),
        memberQuantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        diameter: Joi.number().min(0).required().messages({
            'number.base': 'Diameter must be a number'
        }),
        weight: Joi.string().required().custom((value, helpers) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                return helpers.error('any.invalid', { message: 'Weight must be a valid non-negative number' });
            }
            return value;
        }, 'Weight validation'),
        cuttingLength: Joi.number().min(0).optional().allow(null),
        dimensions: Joi.array().items(dimensionSchema).optional(),
    });

    const workOrderSchema = Joi.object({
        clientId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        projectId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        workOrderNumber: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
        workOrderDate: Joi.date().required().messages({ 'date.base': 'Work order date must be a valid date' }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        globalMemberDetails: Joi.string().optional().allow(''),
        products: Joi.array().items(productSchema).min(1).required().messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array().items(fileSchema).optional(),
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
    console.log("PRODUCTS", bodyData.products);

    bodyData.products.map((pr) => pr.dimensions.map((d) => console.log("dimensions", d)))
    const userId = req.user?._id?.toString();

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID in request');
    }
    console.log("type", typeof bodyData.products);

    // 3. Parse stringified fields
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);

        } catch (e) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 4. Handle file uploads (unchanged)
    // const uploadedFiles = [];
    // if (req.files && req.files.length > 0) {
    //     try {
    //         for (const file of req.files) {
    //             const tempFilePath = path.join('./public/temp', file.filename);
    //             const fileBuffer = fs.readFileSync(tempFilePath);
    //             const sanitizedFilename = sanitizeFilename(file.originalname);

    //             const maxFileSize = 5 * 1024 * 1024; // 5MB
    //             if (file.size > maxFileSize) {
    //                 fs.unlinkSync(tempFilePath);
    //                 throw new ApiError(400, `File ${file.originalname} exceeds maximum size of 5MB`);
    //             }

    //             const { url } = await putObject(
    //                 { data: fileBuffer, mimetype: file.mimetype },
    //                 `iron-work-orders/${Date.now()}-${sanitizedFilename}`
    //             );

    //             try {
    //                 fs.unlinkSync(tempFilePath);
    //             } catch (error) {
    //                 console.error(`Failed to delete temp file ${tempFilePath}:`, error);
    //             }

    //             uploadedFiles.push({
    //                 file_name: file.originalname,
    //                 file_url: url,
    //                 uploaded_at: new Date(),
    //             });
    //         }
    //     } catch (error) {
    //         if (req.files) {
    //             req.files.forEach((file) => {
    //                 const tempFilePath = path.join('./public/temp', file.filename);
    //                 if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    //             });
    //         }
    //         throw new ApiError(500, `File upload failed: ${error.message}`);
    //     }
    // }

    ///////////////////////////////////////
    //CORRECT FILE UPLOAD -

    // 4. Handle file uploads (directly from memory, no temp folder)
    // const uploadedFiles = [];
    // console.log("file", req.files);
    // if (req.files && req.files.length > 0) {
    //     try {
    //         for (const file of req.files) {
    //             const sanitizedFilename = sanitizeFilename(file.originalname);

    //             const maxFileSize = 5 * 1024 * 1024; // 5MB
    //             if (file.size > maxFileSize) {
    //                 throw new ApiError(400, `File ${file.originalname} exceeds maximum size of 5MB`);
    //             }

    //             // Upload directly to S3 from memory buffer
    //             const { url } = await putObject(
    //                 { data: file.buffer, mimetype: file.mimetype },
    //                 `iron-work-orders/${Date.now()}-${sanitizedFilename}`
    //             );

    //             uploadedFiles.push({
    //                 file_name: file.originalname,
    //                 file_url: url,
    //                 uploaded_at: new Date(),
    //             });
    //         }
    //     } catch (error) {
    //         throw new ApiError(500, `File upload failed: ${error.message}`);
    //     }
    // }
    // else if (bodyData.files && Array.isArray(bodyData.files)) {
    //     uploadedFiles = bodyData.files.map(f => ({
    //         file_name: f.file_name,
    //         file_url: f.file_url,   // must be a proper URL if Joi checks
    //         uploaded_at: f.uploaded_at ? new Date(f.uploaded_at) : new Date(),
    //     }));
    // }


    let uploadedFiles = [];
    console.log("file", req.files);
    if (req.files && req.files.length > 0) {
        try {
            for (const file of req.files) {
                const sanitizedFilename = sanitizeFilename(file.originalname);

                const maxFileSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxFileSize) {
                    throw new ApiError(400, `File ${file.originalname} exceeds maximum size of 5MB`);
                }

                // Upload directly to S3 from memory buffer
                const { url } = await putObject(
                    { data: file.buffer, mimetype: file.mimetype },
                    `iron-work-orders/${Date.now()}-${sanitizedFilename}`
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
    } else if (bodyData.files && Array.isArray(bodyData.files)) {
        // Validate that file_url is a proper URL
        const fileValidation = Joi.array().items(fileSchema).validate(bodyData.files, { abortEarly: false });
        if (fileValidation.error) {
            throw new ApiError(400, 'Invalid file data', fileValidation.error.details);
        }
        uploadedFiles = bodyData.files.map(f => ({
            file_name: f.file_name,
            file_url: f.file_url,
            uploaded_at: f.uploaded_at ? new Date(f.uploaded_at) : new Date(),
        }));
    }


    // 5. Prepare work order data
    const workOrderData = {
        ...bodyData,
        products: bodyData.products,
        files: uploadedFiles,
        workOrderDate: bodyData.workOrderDate ? new Date(bodyData.workOrderDate) : undefined,
        deliveryDate: bodyData.deliveryDate ? new Date(bodyData.deliveryDate) : undefined,
        created_by: userId,
        updated_by: userId,
    };

    // 6. Validate with Joi
    const { error, value } = workOrderSchema.validate(workOrderData, { abortEarly: false });
    if (error) {
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }
        console.log("errorrrrr", error.details);
        throw new ApiError(400, 'Validation failed for work order creation', error.details);
    }

    // 7. Validate referenced documents
    const [client, project, shapes] = await Promise.all([
        mongoose.model('ironClient').findById(value.clientId),
        mongoose.model('ironProject').findById(value.projectId),
        Promise.all(value.products.map((p) => mongoose.model('ironShape').findById(p.shapeId))),
    ]);

    if (!client) throw new ApiError(404, `Client not found with ID: ${value.clientId}`);
    if (!project) throw new ApiError(404, `Project not found with ID: ${value.projectId}`);
    const invalidShape = shapes.findIndex((s) => !s);
    if (invalidShape !== -1) {
        throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shapeId}`);
    }

    // 8. Calculate and validate raw material usage based on weight
    const diameterWeightMap = new Map();
    value.products.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight);
        if (!isNaN(weight)) {
            const currentWeight = diameterWeightMap.get(key) || 0;
            diameterWeightMap.set(key, currentWeight + weight);
        } else {
            throw new ApiError(400, `Invalid weight value for diameter ${product.diameter} mm`);
        }
    });

    const rawMaterials = await RawMaterial.find({
        project: value.projectId,
        diameter: { $in: Array.from(diameterWeightMap.keys()).map(Number) },
        isDeleted: false,
    });

    for (const [diameter, usedWeight] of diameterWeightMap) {
        const rawMaterial = rawMaterials.find((rm) => rm.diameter === Number(diameter));
        console.log("rawMaterial",rawMaterial);
        if (!rawMaterial) {
            throw new ApiError(400, `No raw material available for diameter ${diameter} mm`);
        }
        if (rawMaterial.qty < usedWeight) {
            throw new ApiError(400, `Insufficient raw material for diameter ${diameter} mm. Available: ${rawMaterial.qty}, Required: ${usedWeight}`);
        }
    }

    // 9. Deduct from raw material and track consumption based on weight
    const workOrderId = new mongoose.Types.ObjectId(); // Generate new ID for the work order
    const bulkUpdates = rawMaterials.map((rawMaterial) => {
        const usedWeight = diameterWeightMap.get(rawMaterial.diameter.toString()) || 0;
        return {
            updateOne: {
                filter: { _id: rawMaterial._id, isDeleted: false },
                update: {
                    $inc: { qty: -usedWeight },
                    $push: { consumptionHistory: { workOrderId, quantity: usedWeight } },
                },
            },
        };
    });
    if (bulkUpdates.length > 0) {
        await RawMaterial.bulkWrite(bulkUpdates);
    }

    // 10. Save to MongoDB with the generated ID
    const workOrder = await ironWorkOrder.create({ ...value, _id: workOrderId });

    // 11. Populate and format response (unchanged)
    const populatedWorkOrder = await ironWorkOrder
        .findById(workOrder._id)
        .populate({
            path: 'clientId',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'projectId',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'products.shapeId',
            select: 'name',
            match: { isDeleted: false },
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

    if (!populatedWorkOrder) {
        throw new ApiError(404, 'Failed to retrieve created work order');
    }

    const formatDateToIST = (data) => {
        const convertToIST = (date) => {
            if (!date) return null;
            return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        };
        return {
            ...data,
            workOrderDate: convertToIST(data.workOrderDate),
            deliveryDate: convertToIST(data.deliveryDate),
            createdAt: convertToIST(data.createdAt),
            updatedAt: convertToIST(data.updatedAt),
            products: data.products.map((p) => ({
                ...p,
            })),
            files: data.files.map((f) => ({
                ...f,
                uploaded_at: convertToIST(f.uploaded_at),
            })),
        };
    };

    const formattedWorkOrder = formatDateToIST(populatedWorkOrder);

    return res.status(201).json(new ApiResponse(201, formattedWorkOrder, 'Work order created successfully'));
});




const createIronWorkOrder_23_09_2025_WORKING_REMOVED_TYPE = asyncHandler(async (req, res) => {
    // 1. Validation schema
    const dimensionSchema = Joi.object({
      name: Joi.string().required().messages({ 'string.empty': 'Dimension name is required' }),
      value: Joi.string().required().messages({ 'string.empty': 'Dimension value is required' }),
    });
  
    const fileSchema = Joi.object({
      file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
      file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
      uploaded_at: Joi.date().optional(),
    });
  
    const productSchema = Joi.object({
      shapeId: Joi.string()
        .required()
        .custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation'),
      uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
      quantity: Joi.number().min(0).required().messages({
        'number.base': 'Quantity must be a number',
        'number.min': 'Quantity must be non-negative',
      }),
      deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
      barMark: Joi.string().optional().allow(''),
      memberDetails: Joi.string().optional().allow(''),
      memberQuantity: Joi.number().min(0).required().messages({
        'number.base': 'Quantity must be a number',
        'number.min': 'Quantity must be non-negative',
      }),
      diameter: Joi.number().min(0).required().messages({
        'number.base': 'Diameter must be a number',
      }),
      type: Joi.string().optional().allow(''),
      cuttingLength: Joi.number().min(0).optional().allow(null).messages({
        'number.base': 'Cutting length must be a number',
        'number.min': 'Cutting length must be non-negative',
      }),
      weight: Joi.string().required().custom((value, helpers) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          return helpers.error('any.invalid', { message: 'Weight must be a valid non-negative number' });
        }
        return value;
      }, 'Weight validation'),
      dimensions: Joi.array().items(dimensionSchema).optional(),
    });
  
    const workOrderSchema = Joi.object({
      clientId: Joi.string()
        .required()
        .custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation'),
      projectId: Joi.string()
        .required()
        .custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation'),
      workOrderNumber: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
      workOrderDate: Joi.date().required().messages({ 'date.base': 'Work order date must be a valid date' }),
      deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
      globalMemberDetails: Joi.string().optional().allow(''),
      products: Joi.array().items(productSchema).min(1).required().messages({
        'array.min': 'At least one product is required',
      }),
      files: Joi.array().items(fileSchema).optional(),
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
    const userId = req.user?._id?.toString();
  
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
  
    // 4. Handle file uploads
    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          const sanitizedFilename = sanitizeFilename(file.originalname);
          const maxFileSize = 5 * 1024 * 1024; // 5MB
          if (file.size > maxFileSize) {
            throw new ApiError(400, `File ${file.originalname} exceeds maximum size of 5MB`);
          }
          // Upload directly to S3 from memory buffer
          const { url } = await putObject(
            { data: file.buffer, mimetype: file.mimetype },
            `iron-work-orders/${Date.now()}-${sanitizedFilename}`
          );
          uploadedFiles.push({
            file_name: file.originalname,
            file_url: url,
            uploaded_at: new Date(),
          });
        }
      } catch (error) {
        // No need to cleanup files since they're stored in memory, not on disk
        throw new ApiError(500, `File upload failed: ${error.message}`);
      }
    } else if (bodyData.files && Array.isArray(bodyData.files)) {
      const fileValidation = Joi.array().items(fileSchema).validate(bodyData.files, { abortEarly: false });
      if (fileValidation.error) {
        throw new ApiError(400, 'Invalid file data', fileValidation.error.details);
      }
      uploadedFiles = bodyData.files.map(f => ({
        file_name: f.file_name,
        file_url: f.file_url,
        uploaded_at: f.uploaded_at ? new Date(f.uploaded_at) : new Date(),
      }));
    }
  
    // 5. Prepare work order data
    const workOrderData = {
      ...bodyData,
      products: bodyData.products,
      files: uploadedFiles,
      workOrderDate: bodyData.workOrderDate ? new Date(bodyData.workOrderDate) : undefined,
      created_by: userId,
      updated_by: userId,
    };
  
    // 6. Validate with Joi
    const { error, value } = workOrderSchema.validate(workOrderData, { abortEarly: false });
    if (error) {
    //   if (req.files) {
    //     req.files.forEach((file) => {
    //       const tempFilePath = path.join('./public/temp', file.filename);
    //       if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    //     });
    //   }
      throw new ApiError(400, 'Validation failed for work order creation', error.details);
    }
  
    // 7. Validate referenced documents
    const [client, project, shapes] = await Promise.all([
      mongoose.model('ironClient').findById(value.clientId),
      mongoose.model('ironProject').findById(value.projectId),
      Promise.all(value.products.map((p) => mongoose.model('ironShape').findById(p.shapeId))),
    ]);
  
    if (!client) throw new ApiError(404, `Client not found with ID: ${value.clientId}`);
    if (!project) throw new ApiError(404, `Project not found with ID: ${value.projectId}`);
    const invalidShape = shapes.findIndex((s) => !s);
    if (invalidShape !== -1) {
      throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shapeId}`);
    }
  
    // 8. Calculate and validate raw material usage based on weight
    const diameterWeightMap = new Map();
    value.products.forEach((product) => {
      const key = `${product.diameter}-${product.type}`;
      const weight = parseFloat(product.weight);
      if (!isNaN(weight)) {
        const currentWeight = diameterWeightMap.get(key) || 0;
        diameterWeightMap.set(key, currentWeight + weight);
      } else {
        throw new ApiError(400, `Invalid weight value for diameter ${product.diameter} mm and type ${product.type}`);
      }
    });
  
    // 9. Validate and deduct raw material
    const bulkRawMaterialUpdates = [];
    const bulkDiameterUpdates = [];
    const workOrderId = new mongoose.Types.ObjectId(); // Generate work order ID
  
    for (const [key, usedWeight] of diameterWeightMap) {
      const [diameter, type] = key.split('-');
      const rawMaterials = await RawMaterial.find({
        project: value.projectId,
        diameter: Number(diameter),
        type,
        isDeleted: false,
        qty: { $gt: 0 },
      }).sort({ createdAt: 1 }); // FIFO: oldest first
  
      if (!rawMaterials.length) {
        throw new ApiError(400, `No raw material available for diameter ${diameter} mm and type ${type}`);
      }
  
      let remainingWeight = usedWeight;
    //   for (const rawMaterial of rawMaterials) {
    //     if (remainingWeight <= 0) break;
  
    //     const deductQty = Math.min(rawMaterial.qty, remainingWeight);
    //     remainingWeight -= deductQty;
  
    //     bulkRawMaterialUpdates.push({
    //       updateOne: {
    //         filter: { _id: rawMaterial._id, isDeleted: false },
    //         update: {
    //           $inc: { qty: -deductQty },
    //           $push: {
    //             consumptionHistory: {
    //               workOrderId,
    //               workOrderNumber: value.workOrderNumber,
    //               quantity: deductQty,
    //               timestamp: new Date(),
    //             },
    //           },
    //         },
    //       },
    //     });
    //   }
  


    for (const rawMaterial of rawMaterials) {
        if (remainingWeight <= 0) break;
    
        const deductQty = Math.min(rawMaterial.qty, remainingWeight);
        remainingWeight -= deductQty;
    
        // Calculate remaining qty and update convertedQty
        const remainingQty = rawMaterial.qty - deductQty; // New line
        const newConvertedQty = remainingQty * 1000; // New line
    
        bulkRawMaterialUpdates.push({
            updateOne: {
                filter: { _id: rawMaterial._id, isDeleted: false },
                update: {
                    $inc: { qty: -deductQty },
                    $set: { convertedQty: newConvertedQty }, // New line
                    $push: {
                        consumptionHistory: {
                            workOrderId,
                            workOrderNumber: value.workOrderNumber,
                            quantity: deductQty,
                            timestamp: new Date(),
                        },
                    },
                },
            },
        });
    }




      if (remainingWeight > 0) {
        throw new ApiError(
          400,
          `Insufficient raw material for diameter ${diameter} mm and type ${type}. Required: ${usedWeight}, Available: ${usedWeight - remainingWeight}`
        );
      }
  
      // Update Diameter's subtracted array
      const diameterRecord = await Diameter.findOne({
        project: value.projectId,
        value: Number(diameter),
        type,
        isDeleted: false,
      });
  
      if (diameterRecord) {
        bulkDiameterUpdates.push({
          updateOne: {
            filter: { _id: diameterRecord._id, isDeleted: false },
            update: {
              $push: {
                subtracted: {
                  quantity: usedWeight,
                  workOrderId,
                },
              },
            },
          },
        });
      }
    }
  
    // 10. Perform bulk updates
    if (bulkRawMaterialUpdates.length > 0) {
      await RawMaterial.bulkWrite(bulkRawMaterialUpdates);
    }
    if (bulkDiameterUpdates.length > 0) {
      await Diameter.bulkWrite(bulkDiameterUpdates);
    }
  
    // 11. Save to MongoDB with the generated ID
    const workOrder = await ironWorkOrder.create({ ...value, _id: workOrderId });
  
    // 12. Populate and format response
    const populatedWorkOrder = await ironWorkOrder
      .findById(workOrder._id)
      .populate({
        path: 'clientId',
        select: 'name address',
        match: { isDeleted: false },
      })
      .populate({
        path: 'projectId',
        select: 'name address',
        match: { isDeleted: false },
      })
      .populate({
        path: 'products.shapeId',
        select: 'name',
        match: { isDeleted: false },
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
  
    if (!populatedWorkOrder) {
      throw new ApiError(404, 'Failed to retrieve created work order');
    }
  
    const formatDateToIST = (data) => {
      const convertToIST = (date) => {
        if (!date) return null;
        return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      };
      return {
        ...data,
        workOrderDate: convertToIST(data.workOrderDate),
        createdAt: convertToIST(data.createdAt),
        updatedAt: convertToIST(data.updatedAt),
        products: data.products.map((p) => ({
          ...p,
          deliveryDate: convertToIST(p.deliveryDate),
        })),
        files: data.files.map((f) => ({
          ...f,
          uploaded_at: convertToIST(f.uploaded_at),
        })),
      };
    };
  
    const formattedWorkOrder = formatDateToIST(populatedWorkOrder);
    return res.status(201).json(new ApiResponse(201, formattedWorkOrder, 'Work order created successfully'));
  });














  const createIronWorkOrder = asyncHandler(async (req, res) => {
    // 1. Validation schema
    const dimensionSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Dimension name is required' }),
        value: Joi.string().required().messages({ 'string.empty': 'Dimension value is required' }),
    });

    const fileSchema = Joi.object({
        file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
        file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
        uploaded_at: Joi.date().optional(),
    });

    const productSchema = Joi.object({
        shapeId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        quantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        barMark: Joi.string().optional().allow(''),
        memberDetails: Joi.string().optional().allow(''),
        memberQuantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        diameter: Joi.number().min(0).required().messages({
            'number.base': 'Diameter must be a number',
        }),
        type: Joi.string().optional().allow(''), // Type is optional
        cuttingLength: Joi.number().min(0).optional().allow(null).messages({
            'number.base': 'Cutting length must be a number',
            'number.min': 'Cutting length must be non-negative',
        }),
        weight: Joi.string().required().custom((value, helpers) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                return helpers.error('any.invalid', { message: 'Weight must be a valid non-negative number' });
            }
            return value;
        }, 'Weight validation'),
        dimensions: Joi.array().items(dimensionSchema).optional(),
    });

    const workOrderSchema = Joi.object({
        clientId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        projectId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        workOrderNumber: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
        workOrderDate: Joi.date().required().messages({ 'date.base': 'Work order date must be a valid date' }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        globalMemberDetails: Joi.string().optional().allow(''),
        products: Joi.array().items(productSchema).min(1).required().messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array().items(fileSchema).optional(),
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
    const userId = req.user?._id?.toString();

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

    // 4. Handle file uploads
    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
        try {
            for (const file of req.files) {
                const sanitizedFilename = sanitizeFilename(file.originalname);
                const maxFileSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxFileSize) {
                    throw new ApiError(400, `File ${file.originalname} exceeds maximum size of 5MB`);
                }
                // Upload directly to S3 from memory buffer
                const { url } = await putObject(
                    { data: file.buffer, mimetype: file.mimetype },
                    `iron-work-orders/${Date.now()}-${sanitizedFilename}`
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
    } else if (bodyData.files && Array.isArray(bodyData.files)) {
        const fileValidation = Joi.array().items(fileSchema).validate(bodyData.files, { abortEarly: false });
        if (fileValidation.error) {
            throw new ApiError(400, 'Invalid file data', fileValidation.error.details);
        }
        uploadedFiles = bodyData.files.map(f => ({
            file_name: f.file_name,
            file_url: f.file_url,
            uploaded_at: f.uploaded_at ? new Date(f.uploaded_at) : new Date(),
        }));
    }

    // 5. Prepare work order data
    const workOrderData = {
        ...bodyData,
        products: bodyData.products,
        files: uploadedFiles,
        workOrderDate: bodyData.workOrderDate ? new Date(bodyData.workOrderDate) : undefined,
        created_by: userId,
        updated_by: userId,
    };

    // 6. Validate with Joi
    const { error, value } = workOrderSchema.validate(workOrderData, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for work order creation', error.details);
    }

    // 7. Validate referenced documents
    const [client, project, shapes] = await Promise.all([
        mongoose.model('ironClient').findById(value.clientId),
        mongoose.model('ironProject').findById(value.projectId),
        Promise.all(value.products.map((p) => mongoose.model('ironShape').findById(p.shapeId))),
    ]);

    if (!client) throw new ApiError(404, `Client not found with ID: ${value.clientId}`);
    if (!project) throw new ApiError(404, `Project not found with ID: ${value.projectId}`);
    const invalidShape = shapes.findIndex((s) => !s);
    if (invalidShape !== -1) {
        throw new ApiError(404, `Shape not found with ID: ${value.products[invalidShape].shapeId}`);
    }

    // 8. Calculate and validate raw material usage based on weight
    const diameterWeightMap = new Map();
    value.products.forEach((product) => {
        const diameter = product.diameter;
        const weight = parseFloat(product.weight);
        if (!isNaN(weight)) {
            const currentWeight = diameterWeightMap.get(diameter) || 0;
            diameterWeightMap.set(diameter, currentWeight + weight);
        } else {
            throw new ApiError(400, `Invalid weight value for diameter ${product.diameter} mm`);
        }
    });

    // 9. Validate and deduct raw material
    const bulkRawMaterialUpdates = [];
    const bulkDiameterUpdates = [];
    const workOrderId = new mongoose.Types.ObjectId(); // Generate work order ID

    for (const [diameter, usedWeight] of diameterWeightMap) {
        const rawMaterials = await RawMaterial.find({
            project: value.projectId,
            diameter: Number(diameter),
            isDeleted: false,
            qty: { $gt: 0 },
        }).sort({ createdAt: 1 }); // FIFO: oldest first

        if (!rawMaterials.length) {
            throw new ApiError(400, `No raw material available for diameter ${diameter} mm`);
        }

        let remainingWeight = usedWeight;
        for (const rawMaterial of rawMaterials) {
            if (remainingWeight <= 0) break;

            const deductQty = Math.min(rawMaterial.qty, remainingWeight);
            remainingWeight -= deductQty;

            // Calculate remaining qty and update convertedQty
            const remainingQty = rawMaterial.qty - deductQty;
            const newConvertedQty = remainingQty * 1000;

            bulkRawMaterialUpdates.push({
                updateOne: {
                    filter: { _id: rawMaterial._id, isDeleted: false },
                    update: {
                        $inc: { qty: -deductQty },
                        $set: { convertedQty: newConvertedQty },
                        $push: {
                            consumptionHistory: {
                                workOrderId,
                                workOrderNumber: value.workOrderNumber,
                                quantity: deductQty,
                                type: rawMaterial.type, // Use raw material's type
                                timestamp: new Date(),
                            },
                        },
                    },
                },
            });
        }

        if (remainingWeight > 0) {
            throw new ApiError(
                400,
                `Insufficient raw material for diameter ${diameter} mm. Required: ${usedWeight}, Available: ${usedWeight - remainingWeight}`
            );
        }

        // Update Diameter's subtracted array
        const diameterRecord = await Diameter.findOne({
            project: value.projectId,
            value: Number(diameter),
            isDeleted: false,
        });

        if (diameterRecord) {
            bulkDiameterUpdates.push({
                updateOne: {
                    filter: { _id: diameterRecord._id, isDeleted: false },
                    update: {
                        $push: {
                            subtracted: {
                                quantity: usedWeight,
                                workOrderId,
                            },
                        },
                    },
                },
            });
        }
    }

    // 10. Perform bulk updates
    if (bulkRawMaterialUpdates.length > 0) {
        await RawMaterial.bulkWrite(bulkRawMaterialUpdates);
    }
    if (bulkDiameterUpdates.length > 0) {
        await Diameter.bulkWrite(bulkDiameterUpdates);
    }

    // 11. Save to MongoDB with the generated ID
    const workOrder = await ironWorkOrder.create({ ...value, _id: workOrderId });

    // 12. Populate and format response
    const populatedWorkOrder = await ironWorkOrder
        .findById(workOrder._id)
        .populate({
            path: 'clientId',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'projectId',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate({
            path: 'products.shapeId',
            select: 'name',
            match: { isDeleted: false },
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

    if (!populatedWorkOrder) {
        throw new ApiError(404, 'Failed to retrieve created work order');
    }

    const formatDateToIST = (data) => {
        const convertToIST = (date) => {
            if (!date) return null;
            return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        };
        return {
            ...data,
            workOrderDate: convertToIST(data.workOrderDate),
            createdAt: convertToIST(data.createdAt),
            updatedAt: convertToIST(data.updatedAt),
            products: data.products.map((p) => ({
                ...p,
                deliveryDate: convertToIST(p.deliveryDate),
            })),
            files: data.files.map((f) => ({
                ...f,
                uploaded_at: convertToIST(f.uploaded_at),
            })),
        };
    };

    const formattedWorkOrder = formatDateToIST(populatedWorkOrder);
    return res.status(201).json(new ApiResponse(201, formattedWorkOrder, 'Work order created successfully'));
});





//////////////////GET API - To get all the iron work order data


// const getAllIronWorkOrders = asyncHandler(async (req, res) => {
//     // 1. Validation schema for query parameters
//     const querySchema = Joi.object({
//         page: Joi.number().integer().min(1).default(1).messages({
//             'number.base': 'Page must be a number',
//             'number.min': 'Page must be at least 1',
//         }),
//         limit: Joi.number().integer().min(1).max(100).default(10).messages({
//             'number.base': 'Limit must be a number',
//             'number.min': 'Limit must be at least 1',
//             'number.max': 'Limit cannot exceed 100',
//         }),
//         sortBy: Joi.string()
//             .valid('workOrderDate', 'createdAt', 'updatedAt')
//             .default('createdAt')
//             .messages({
//                 'any.only': 'SortBy must be one of workOrderDate, createdAt, updatedAt',
//             }),
//         sortOrder: Joi.string()
//             .valid('asc', 'desc')
//             .default('desc')
//             .messages({
//                 'any.only': 'SortOrder must be asc or desc',
//             }),
//     });

//     // 2. Validate query parameters
//     const { error, value } = querySchema.validate(req.query, { abortEarly: false });
//     if (error) {
//         throw new ApiError(400, 'Invalid query parameters', error.details);
//     }

//     const { page, limit, sortBy, sortOrder } = value;

//     // 3. Validate user authentication
//     const userId = req.user?._id?.toString();
//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//         throw new ApiError(401, 'Invalid or missing user ID in request');
//     }

//     // 4. Build query
//     const query = {};

//     // 5. Calculate pagination
//     const skip = (page - 1) * limit;

//     // 6. Build sort options
//     const sortOptions = {};
//     sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

//     // 7. Fetch work orders with pagination, sorting, and population
//     const [workOrders, totalCount] = await Promise.all([
//         ironWorkOrder
//             .find(query)
//             .sort(sortOptions)
//             .skip(skip)
//             .limit(limit)
//             .populate({
//                 path: 'clientId',
//                 select: 'name address',
//                 match: { isDeleted: false },
//             })
//             .populate({
//                 path: 'projectId',
//                 select: 'name address',
//                 match: { isDeleted: false },
//             })
//             .populate({
//                 path: 'products.shapeId',
//                 select: 'name',
//                 match: { isDeleted: false },
//             })
//             .populate({
//                 path: 'created_by',
//                 select: 'username email',
//             })
//             .populate({
//                 path: 'updated_by',
//                 select: 'username email',
//             })
//             .lean(),
//         ironWorkOrder.countDocuments(query),
//     ]);

//     // 8. Format timestamps to IST
//     const formatDateToIST = (data) => {
//         const convertToIST = (date) => {
//             if (!date) return null;
//             return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
//         };
//         return data.map((item) => ({
//             ...item,
//             workOrderDate: convertToIST(item.workOrderDate),
//             createdAt: convertToIST(item.createdAt),
//             updatedAt: convertToIST(item.createdAt),
//             products: item.products.map((p) => ({
//                 ...p,
//                 deliveryDate: convertToIST(p.deliveryDate),
//             })),
//             files: item.files.map((f) => ({
//                 ...f,
//                 uploaded_at: convertToIST(f.uploaded_at),
//             })),
//         }));
//     };

//     const formattedWorkOrders = formatDateToIST(workOrders);

//     // 9. Prepare pagination metadata
//     const pagination = {
//         currentPage: page,
//         totalPages: Math.ceil(totalCount / limit),
//         totalItems: totalCount,
//         limit,
//     };

//     // 10. Return response
//     return res.status(200).json(
//         new ApiResponse(
//             200,
//             {
//                 workOrders: formattedWorkOrders,
//                 pagination,
//             },
//             'Work orders retrieved successfully'
//         )
//     );
// });




// const getAllIronWorkOrders = asyncHandler(async (req, res) => {
//     // 1. Validation schema for query parameters
//     const querySchema = Joi.object({
//       page: Joi.number().integer().min(1).default(1).messages({
//         'number.base': 'Page must be a number',
//         'number.min': 'Page must be at least 1',
//       }),
//       limit: Joi.number().integer().min(1).max(100).default(10).messages({
//         'number.base': 'Limit must be a number',
//         'number.min': 'Limit must be at least 1',
//         'number.max': 'Limit cannot exceed 100',
//       }),
//       sortBy: Joi.string()
//         .valid('workOrderNumber', 'clientId.name', 'projectId.name', 'createdAt', 'updatedAt', 'status')
//         .default('createdAt')
//         .messages({
//           'any.only': 'SortBy must be one of workOrderNumber, clientId.name, projectId.name, createdAt, updatedAt, status',
//         }),
//       sortOrder: Joi.string()
//         .valid('asc', 'desc')
//         .default('desc')
//         .messages({
//           'any.only': 'SortOrder must be asc or desc',
//         }),
//       search: Joi.string().allow('').default('').messages({
//         'string.base': 'Search must be a string',
//       }),
//       fromDate: Joi.string().allow('').default('').messages({
//         'string.base': 'FromDate must be a string',
//       }),
//       toDate: Joi.string().allow('').default('').messages({
//         'string.base': 'ToDate must be a string',
//       }),
//     });

//     // 2. Validate query parameters
//     const { error, value } = querySchema.validate(req.query, { abortEarly: false });
//     if (error) {
//       throw new ApiError(400, 'Invalid query parameters', error.details);
//     }

//     const { page, limit, sortBy, sortOrder, search, fromDate, toDate } = value;

//     // 3. Validate user authentication
//     const userId = req.user?._id?.toString();
//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       throw new ApiError(401, 'Invalid or missing user ID in request');
//     }

//     // 4. Build query
//     const query = {};
//     if (search) {
//       query.$or = [
//         { workOrderNumber: { $regex: search, $options: 'i' } },
//         { 'clientId.name': { $regex: search, $options: 'i' } },
//         { 'projectId.name': { $regex: search, $options: 'i' } },
//         { status: { $regex: search, $options: 'i' } },
//       ];
//     }
//     if (fromDate || toDate) {
//       query.workOrderDate = {};
//       if (fromDate) query.workOrderDate.$gte = new Date(fromDate);
//       if (toDate) query.workOrderDate.$lte = new Date(toDate);
//     }

//     // 5. Calculate pagination
//     const skip = (page - 1) * limit;

//     // 6. Build sort options
//     const sortOptions = {};
//     sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

//     // 7. Fetch work orders with pagination, sorting, and population
//     const [workOrders, totalCount] = await Promise.all([
//       ironWorkOrder
//         .find(query)
//         .sort(sortOptions)
//         .skip(skip)
//         .limit(limit)
//         .populate({
//           path: 'clientId',
//           select: 'name address',
//         //   match: { isDeleted: false },
//         })
//         .populate({
//           path: 'projectId',
//           select: 'name address',
//         //   match: { isDeleted: false },
//         })
//         .populate({
//           path: 'products.shapeId',
//           select: 'name',
//           match: { isDeleted: false },
//         })
//         .populate({
//           path: 'created_by',
//           select: 'username email',
//         })
//         .populate({
//           path: 'updated_by',
//           select: 'username email',
//         })
//         .lean(),
//       ironWorkOrder.countDocuments(query),
//     ]);

//     // 8. Format timestamps to IST
//     const formatDateToIST = (data) => {
//       const convertToIST = (date) => {
//         if (!date) return null;
//         return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
//       };
//       return data.map((item) => ({
//         ...item,
//         workOrderDate: convertToIST(item.workOrderDate),
//         createdAt: convertToIST(item.createdAt),
//         updatedAt: convertToIST(item.createdAt),
//         products: item.products.map((p) => ({
//           ...p,
//           deliveryDate: convertToIST(p.deliveryDate),
//         })),
//         files: item.files.map((f) => ({
//           ...f,
//           uploaded_at: convertToIST(f.uploaded_at),
//         })),
//       }));
//     };

//     const formattedWorkOrders = formatDateToIST(workOrders);

//     // 9. Prepare pagination metadata
//     const pagination = {
//       total: totalCount,
//       page,
//       limit,
//       totalPages: Math.ceil(totalCount / limit),
//     };

//     // 10. Return response
//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           workOrders: formattedWorkOrders,
//           pagination,
//         },
//         'Work orders retrieved successfully'
//       )
//     );
//   });



const getAllIronWorkOrders = asyncHandler(async (req, res) => {
    // 1. Validation schema for query parameters
    const querySchema = Joi.object({
        sortBy: Joi.string()
            .valid('workOrderNumber', 'clientId.name', 'projectId.name', 'createdAt', 'updatedAt', 'status')
            .default('createdAt')
            .messages({
                'any.only': 'SortBy must be one of workOrderNumber, clientId.name, projectId.name, createdAt, updatedAt, status',
            }),
        sortOrder: Joi.string()
            .valid('asc', 'desc')
            .default('desc')
            .messages({
                'any.only': 'SortOrder must be asc or desc',
            }),
        search: Joi.string().allow('').default('').messages({
            'string.base': 'Search must be a string',
        }),
        fromDate: Joi.string().allow('').default('').messages({
            'string.base': 'FromDate must be a string',
        }),
        toDate: Joi.string().allow('').default('').messages({
            'string.base': 'ToDate must be a string',
        }),
    });

    // 2. Validate query parameters
    const { error, value } = querySchema.validate(req.query, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Invalid query parameters', error.details);
    }

    const { sortBy, sortOrder, search, fromDate, toDate } = value;

    // 3. Validate user authentication
    const userId = req.user?._id?.toString();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID in request');
    }

    // 4. Build query
    const query = {};
    if (search) {
        query.$or = [
            { workOrderNumber: { $regex: search, $options: 'i' } },
            { 'clientId.name': { $regex: search, $options: 'i' } },
            { 'projectId.name': { $regex: search, $options: 'i' } },
            { status: { $regex: search, $options: 'i' } },
        ];
    }
    if (fromDate || toDate) {
        query.workOrderDate = {};
        if (fromDate) query.workOrderDate.$gte = new Date(fromDate);
        if (toDate) query.workOrderDate.$lte = new Date(toDate);
    }

    // 5. Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // 6. Fetch work orders with sorting and population
    const workOrders = await ironWorkOrder
        .find(query)
        .sort(sortOptions)
        .populate({
            path: 'clientId',
            select: 'name address',
        })
        .populate({
            path: 'projectId',
            select: 'name address',
        })
        .populate({
            path: 'products.shapeId',
            select: 'name',
            match: { isDeleted: false },
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

    // 7. Format timestamps to IST
    const formatDateToIST = (data) => {
        const convertToIST = (date) => {
            if (!date) return null;
            return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        };
        return data.map((item) => ({
            ...item,
            workOrderDate: convertToIST(item.workOrderDate),
            deliveryDate: convertToIST(item.deliveryDate),
            createdAt: convertToIST(item.createdAt),
            updatedAt: convertToIST(item.createdAt),
            products: item.products.map((p) => ({
                ...p,
            })),
            files: item.files.map((f) => ({
                ...f,
                uploaded_at: convertToIST(f.uploaded_at),
            })),
        }));
    };

    const formattedWorkOrders = formatDateToIST(workOrders);

    // 8. Return response
    return res.status(200).json(
        new ApiResponse(
            200,
            formattedWorkOrders, // Return array directly
            'Work orders retrieved successfully'
        )
    );
});


//////////////////API to get work order by id -
// const getIronWorkOrderById = asyncHandler(async (req, res) => {
//     // 1. Validation schema for params
//     const paramsSchema = Joi.object({
//         workOrderId: Joi.string()
//             .required()
//             .custom((value, helpers) => {
//                 if (!mongoose.Types.ObjectId.isValid(value)) {
//                     return helpers.error('any.invalid', { message: `Work order ID (${value}) is not a valid ObjectId` });
//                 }
//                 return value;
//             }, 'ObjectId validation'),
//     });

//     // 2. Validate params
//     const { error, value } = paramsSchema.validate(req.params, { abortEarly: false });
//     if (error) {
//         throw new ApiError(400, 'Invalid work order ID', error.details);
//     }

//     const { workOrderId } = value;

//     // 3. Validate user authentication
//     const userId = req.user?._id?.toString();
//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//         throw new ApiError(401, 'Invalid or missing user ID in request');
//     }

//     // 4. Fetch work order with population
//     const workOrder = await ironWorkOrder
//         .findById(workOrderId)
//         .populate({
//             path: 'clientId',
//             select: 'name address',
//             // match: { isDeleted: false },
//         })
//         .populate({
//             path: 'projectId',
//             select: 'name address',
//             // match: { isDeleted: false },
//         })
//         .populate({
//             path: 'products.shapeId',
//             select: 'shape_code description',
//             // match: { isDeleted: false },
//         })
//         .populate({
//             path: 'created_by',
//             select: 'username',
//         })
//         .lean();

//     if (!workOrder) {
//         throw new ApiError(404, `Work order not found with ID: ${workOrderId}`);
//     }

//     // 5. Format timestamps to IST (DD-MM-YYYY HH:MM AM/PM)
//     const formatDateToIST = (date) => {
//         if (!date) return null;
//         const istDate = new Date(date).toLocaleString('en-IN', {
//             timeZone: 'Asia/Kolkata',
//             day: '2-digit',
//             month: '2-digit',
//             year: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true,
//         });
//         // Convert to desired format: DD-MM-YYYY HH:MM AM/PM
//         const [datePart, timePart] = istDate.split(', ');
//         const [day, month, year] = datePart.split('/');
//         const [time, period] = timePart.split(' ');
//         return `${day}-${month}-${year} ${time} ${period}`;
//     };

//     // 6. Structure response to match desired format
//     const formattedWorkOrder = {
//         client_id: workOrder.clientId
//             ? {
//                   _id: workOrder.clientId._id,
//                   name: workOrder.clientId.name,
//                   address: workOrder.clientId.address,
//               }
//             : null,
//         project_id: workOrder.projectId
//             ? {
//                   _id: workOrder.projectId._id,
//                   name: workOrder.projectId.name,
//                   address: workOrder.projectId.address,
//               }
//             : null,
//         work_order_details: {
//             _id: workOrder._id,
//             work_order_number: workOrder.workOrderNumber,
//             created_at: formatDateToIST(workOrder.createdAt),
//             created_by: workOrder.created_by?.username || 'Unknown',
//             date: formatDateToIST(workOrder.workOrderDate),
//             status: workOrder.status,
//         },
//         products: workOrder.products.map((product) => ({
//             shapeId: product.shapeId
//                 ? {
//                       _id: product.shapeId._id,
//                       shape_code: product.shapeId.shape_code,
//                       description: product.shapeId.description,
//                   }
//                 : null,
//             barMark: product.barMark || '',
//             uom: product.uom,
//             quantity: product.quantity,
//             memberDetails: product.memberDetails || '',
//             deliveryDate: formatDateToIST(product.deliveryDate),
//             _id: product._id,
//         })),
//     };

//     // 7. Check if populated fields are null (due to isDeleted: true or non-existent references)
//     if (!formattedWorkOrder.client_id) {
//         throw new ApiError(404, `Client not found or deleted for work order ID: ${workOrderId}`);
//     }
//     if (!formattedWorkOrder.project_id) {
//         throw new ApiError(404, `Project not found or deleted for work order ID: ${workOrderId}`);
//     }
//     if (formattedWorkOrder.products.some((p) => !p.shapeId)) {
//         throw new ApiError(404, `One or more shapes not found or deleted for work order ID: ${workOrderId}`);
//     }

//     // 8. Return response
//     return res.status(200).json(
//         new ApiResponse(200, formattedWorkOrder, 'Work order retrieved successfully')
//     );
// });



const getIronWorkOrderById = asyncHandler(async (req, res) => {
    // 1. Validation schema for params
    const paramsSchema = Joi.object({
        workOrderId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Work order ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
    });

    // 2. Validate params
    const { error, value } = paramsSchema.validate(req.params, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Invalid work order ID', error.details);
    }

    const { workOrderId } = value;

    // 3. Validate user authentication
    const userId = req.user?._id?.toString();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID in request');
    }

    // 4. Fetch work order with population
    const workOrder = await ironWorkOrder
        .findById(workOrderId)
        .populate({
            path: 'clientId',
            select: 'name address',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'projectId',
            select: 'name address',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'products.shapeId',
            select: 'shape_code description',
            // match: { isDeleted: false },
        })
        .populate({
            path: 'created_by',
            select: 'username',
        })
        .lean();

    // 4.1. Fetch dynamic quantities from all sections
    const shapeIds = workOrder.products.map(p => p.shapeId?._id).filter(Boolean);
    // Keep a parallel array of stringified shape ids for safe comparisons
    const shapeIdStrings = shapeIds.map((id) => id.toString());
    
    // Initialize quantities object
    const quantitiesByShape = {};
    shapeIds.forEach(shapeId => {
        quantitiesByShape[shapeId.toString()] = { achieved: 0, packed: 0, dispatched: 0, recycled: 0 };
    });

    try {
        // Fetch production data (achieved quantities)
        const productionData = await mongoose.model('ironDailyProduction')
            .find({ 
                work_order: workOrderId,
                'products.shape_id': { $in: shapeIds }
            })
            .select('products.shape_id products.achieved_quantity')
            .lean();

        // Process production data
        productionData.forEach((prod) => {
            (prod.products || []).forEach((product) => {
                if (product.shape_id) {
                    const shapeId = product.shape_id.toString();
                    if (shapeIdStrings.includes(shapeId)) {
                        quantitiesByShape[shapeId].achieved += product.achieved_quantity || 0;
                    }
                }
            });
        });

        // Fetch packing data (packed quantities) - using ironPacking model
        const packingData = await mongoose.model('ironPacking')
            .find({ 
                work_order: workOrderId,
                shape_id: { $in: shapeIds }
            })
            .select('shape_id product_quantity')
            .lean();

        // Process packing data
        packingData.forEach((pack) => {
            const shapeId = pack.shape_id?.toString();
            if (shapeId && shapeIdStrings.includes(shapeId)) {
                quantitiesByShape[shapeId].packed += pack.product_quantity || 0;
            }
        });

        // Fetch dispatch data (dispatched quantities)
        const dispatchData = await mongoose.model('ironDispatch')
            .find({ 
                work_order: workOrderId,
                'products.shape_id': { $in: shapeIds }
            })
            .select('products.shape_id products.dispatch_quantity')
            .lean();

        // Process dispatch data
        dispatchData.forEach((dispatch) => {
            (dispatch.products || []).forEach((product) => {
                const shapeId = product.shape_id?.toString();
                if (shapeId && shapeIdStrings.includes(shapeId)) {
                    quantitiesByShape[shapeId].dispatched += product.dispatch_quantity || 0;
                }
            });
        });

        // Fetch QC data (recycled quantities)
        const qcData = await mongoose.model('ironQCCheck')
            .find({ 
                work_order: workOrderId,
                shape_id: { $in: shapeIds }
            })
            .select('shape_id recycled_quantity')
            .lean();

        // Process QC data
        qcData.forEach((qc) => {
            const shapeId = qc.shape_id?.toString();
            if (shapeId && shapeIdStrings.includes(shapeId)) {
                quantitiesByShape[shapeId].recycled += qc.recycled_quantity || 0;
            }
        });
    } catch (error) {
        console.error('Error fetching quantities:', error);
        // Continue with zero quantities if there's an error
    }

    if (!workOrder) {
        throw new ApiError(404, `Work order not found with ID: ${workOrderId}`);
    }

    // 5. Format timestamps to IST (DD-MM-YYYY HH:MM AM/PM)
    const formatDateToIST = (date) => {
        if (!date) return null;
        const istDate = new Date(date).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        // Convert to desired format: DD-MM-YYYY HH:MM AM/PM
        const [datePart, timePart] = istDate.split(', ');
        const [day, month, year] = datePart.split('/');
        const [time, period] = timePart.split(' ');
        return `${day}-${month}-${year} ${time} ${period}`;
    };

    // Format date only (DD-MM-YYYY)
    const formatDateOnly = (date) => {
        if (!date) return null;
        const istDate = new Date(date).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
        // Convert to desired format: DD-MM-YYYY
        const [day, month, year] = istDate.split('/');
        return `${day}-${month}-${year}`;
    };

    workOrder.products.map((product) => console.log("product", product))

    // 6. Structure response to match desired format
    const formattedWorkOrder = {
        client_id: workOrder.clientId
            ? {
                _id: workOrder.clientId._id,
                name: workOrder.clientId.name,
                address: workOrder.clientId.address,
            }
            : null,
        project_id: workOrder.projectId
            ? {
                _id: workOrder.projectId._id,
                name: workOrder.projectId.name,
                address: workOrder.projectId.address,
            }
            : null,
        work_order_details: {
            _id: workOrder._id,
            work_order_number: workOrder.workOrderNumber,
            created_at: formatDateToIST(workOrder.createdAt),
            created_by: workOrder.created_by?.username || 'Unknown',
            date: formatDateToIST(workOrder.workOrderDate),
            delivery_date: formatDateOnly(workOrder.deliveryDate),
            globalMemberDetails: workOrder.globalMemberDetails || '',
            status: workOrder.status,
        },
        products: workOrder.products.map((product) => {
            const shapeId = product.shapeId?._id?.toString();
            const quantities = quantitiesByShape[shapeId] || { achieved: 0, packed: 0, dispatched: 0, recycled: 0 };
            const netPacked = Math.max(0, (quantities.packed || 0) - (quantities.dispatched || 0));
            
            return {
                shapeId: product.shapeId
                    ? {
                        _id: product.shapeId._id,
                        shape_code: product.shapeId.shape_code,
                        description: product.shapeId.description,
                    }
                    : null,
                barMark: product.barMark || '',
                uom: product.uom,
                quantity: product.quantity,
                memberDetails: product.memberDetails || '',
                memberQuantity: product.memberQuantity,
                diameter: product.diameter || null,
                weight: product.weight || '',
                cuttingLength: product.cuttingLength || null,
                dimensions: product.dimensions || [],
                _id: product._id,
                // Add dynamic quantities
                achieved_quantity: quantities.achieved,
                packed_quantity: netPacked,
                dispatched_quantity: quantities.dispatched,
                recycled_quantity: quantities.recycled,
            };
        }),
        files: workOrder.files || [], // Add files array to the response
    };

    // 7. Check if populated fields are null (due to isDeleted: true or non-existent references)
    if (!formattedWorkOrder.client_id) {
        throw new ApiError(404, `Client not found or deleted for work order ID: ${workOrderId}`);
    }
    if (!formattedWorkOrder.project_id) {
        throw new ApiError(404, `Project not found or deleted for work order ID: ${workOrderId}`);
    }
    if (formattedWorkOrder.products.some((p) => !p.shapeId)) {
        throw new ApiError(404, `One or more shapes not found or deleted for work order ID: ${workOrderId}`);
    }

    // 8. Return response
    return res.status(200).json(
        new ApiResponse(200, formattedWorkOrder, 'Work order retrieved successfully')
    );
});


//////////////////API to update data - 

const updateIronWorkOrder_04_08_2025 = asyncHandler(async (req, res) => {
    const workOrderId = req.params.workOrderId;
    console.log("workOrderId", workOrderId);

    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
        throw new ApiError(400, 'Invalid Work Order ID');
    }

    const bodyData = req.body;
    console.log("bodyData", bodyData.products.dimensions);
    const userId = req.user?._id?.toString();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID');
    }

    // Parse products if stringified
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch {
            throw new ApiError(400, 'Invalid products JSON');
        }
    }

    // Normalize date inputs (accepts ISO, YYYY-MM-DD, or DD-MM-YYYY)
    const normalizeDateInput = (val) => {
        if (!val) return val;
        if (val instanceof Date) return val;
        if (typeof val === 'string') {
            // ISO or YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d;
            }
            // DD-MM-YYYY
            const m = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (m) {
                const day = m[1].padStart(2, '0');
                const month = m[2].padStart(2, '0');
                const year = m[3];
                const d = new Date(`${year}-${month}-${day}`);
                return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    };

    bodyData.workOrderDate = normalizeDateInput(bodyData.workOrderDate);
    bodyData.deliveryDate = normalizeDateInput(bodyData.deliveryDate);

    // Fetch existing work order
    const existingWorkOrder = await ironWorkOrder.findById(workOrderId);
    if (!existingWorkOrder) {
        throw new ApiError(404, 'Work order not found');
    }

    // Handle file uploads
    const newFiles = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const tempPath = path.join('./public/temp', file.filename);
            const buffer = fs.readFileSync(tempPath);
            const sanitized = sanitizeFilename(file.originalname);
            console.log("sanitized", sanitized);

            // const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            // console.log("allowedTypes",allowedTypes);
            // console.log(file.mimetype);
            // if (!allowedTypes.includes(file.mimetype)) {
            //     fs.unlinkSync(tempPath);
            //     throw new ApiError(400, `Invalid file type: ${file.originalname}`);
            // }

            if (file.size > 5 * 1024 * 1024) {
                fs.unlinkSync(tempPath);
                throw new ApiError(400, `${file.originalname} exceeds 5MB`);
            }

            const { url, key } = await putObject(
                { data: buffer, mimetype: file.mimetype },
                `iron-work-orders/${Date.now()}-${sanitized}`
            );

            fs.unlinkSync(tempPath);

            newFiles.push({
                file_name: file.originalname,
                file_url: url,
                uploaded_at: new Date(),
            });
        }

        // Delete old files from S3
        if (existingWorkOrder.files?.length > 0) {
            for (const oldFile of existingWorkOrder.files) {
                const key = oldFile.file_url.split('/').slice(-1)[0];
                await deleteObject(`iron-work-orders/${key}`);
            }
        }
    }

    // Disallow updating `uom` from products
    if (Array.isArray(bodyData.products)) {
        bodyData.products = bodyData.products.map((product, idx) => {
            const existingProduct = existingWorkOrder.products[idx] || {};
            const { uom, ...rest } = product;
            return { ...existingProduct.toObject(), ...rest };
        });
    }

    // Prepare updated fields
    const updateFields = {
        ...existingWorkOrder.toObject(),
        ...bodyData,
        updated_by: userId,
        ...(newFiles.length > 0 && { files: newFiles }),
    };

    // Cleanup schema: remove _id and __v
    delete updateFields._id;
    delete updateFields.__v;

    // Perform update
    const updatedWorkOrder = await ironWorkOrder.findByIdAndUpdate(
        workOrderId,
        { $set: updateFields },
        { new: true }
    )
        .populate('clientId', 'name address')
        .populate('projectId', 'name address')
        .populate('products.shapeId', 'name')
        .populate('updated_by', 'username email')
        .lean();

    // Format IST
    const convertToIST = (date) =>
        date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null;

    const formatted = {
        ...updatedWorkOrder,
        workOrderDate: convertToIST(updatedWorkOrder.workOrderDate),
        createdAt: convertToIST(updatedWorkOrder.createdAt),
        updatedAt: convertToIST(updatedWorkOrder.updatedAt),
        products: updatedWorkOrder.products.map((p) => ({
            ...p,
            deliveryDate: convertToIST(p.deliveryDate),
        })),
        files: updatedWorkOrder.files.map((f) => ({
            ...f,
            uploaded_at: convertToIST(f.uploaded_at),
        })),
    };

    return res.status(200).json(new ApiResponse(200, formatted, 'Work order updated successfully'));
});



const updateIronWorkOrder_18_08_2025 = asyncHandler(async (req, res) => {
    const workOrderId = req.params.workOrderId;
    console.log("workOrderId", workOrderId);

    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
        throw new ApiError(400, 'Invalid Work Order ID');
    }

    const bodyData = req.body;
    console.log("bodyData", bodyData);
    bodyData.products.map((product) => console.log("dimensions", product));
    const userId = req.user?._id?.toString();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID');
    }

    // Parse products if stringified
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch {
            throw new ApiError(400, 'Invalid products JSON');
        }
    }

    // Fetch existing work order
    const existingWorkOrder = await ironWorkOrder.findById(workOrderId).lean();
    if (!existingWorkOrder) {
        throw new ApiError(404, 'Work order not found');
    }

    // Handle file uploads
    const newFiles = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const tempPath = path.join('./public/temp', file.filename);
            const buffer = fs.readFileSync(tempPath);
            const sanitized = sanitizeFilename(file.originalname);
            console.log("sanitized", sanitized);

            if (file.size > 5 * 1024 * 1024) {
                fs.unlinkSync(tempPath);
                throw new ApiError(400, `${file.originalname} exceeds 5MB`);
            }

            const { url, key } = await putObject(
                { data: buffer, mimetype: file.mimetype },
                `iron-work-orders/${Date.now()}-${sanitized}`
            );

            fs.unlinkSync(tempPath);

            newFiles.push({
                file_name: file.originalname,
                file_url: url,
                uploaded_at: new Date(),
            });
        }

        // Delete old files from S3
        if (existingWorkOrder.files?.length > 0) {
            for (const oldFile of existingWorkOrder.files) {
                const key = oldFile.file_url.split('/').slice(-1)[0];
                await deleteObject(`iron-work-orders/${key}`);
            }
        }
    }

    // Disallow updating `uom` from products
    if (Array.isArray(bodyData.products)) {
        bodyData.products = bodyData.products.map((product, idx) => {
            const existingProduct = existingWorkOrder.products[idx] || {};
            const { uom, ...rest } = product;
            return { ...existingProduct, ...rest };
        });
    }

    // Calculate weight changes
    const existingDiameterWeightMap = new Map();
    existingWorkOrder.products.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight) || 0;
        const currentWeight = existingDiameterWeightMap.get(key) || 0;
        existingDiameterWeightMap.set(key, currentWeight + weight);
    });

    const newDiameterWeightMap = new Map();
    bodyData.products.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight) || 0;
        const currentWeight = newDiameterWeightMap.get(key) || 0;
        newDiameterWeightMap.set(key, currentWeight + weight);
    });

    const netDiameterWeightMap = new Map();
    for (const [diameter, newWeight] of newDiameterWeightMap) {
        const oldWeight = existingDiameterWeightMap.get(diameter) || 0;
        netDiameterWeightMap.set(diameter, newWeight - oldWeight);
    }

    // Validate and update raw material
    const rawMaterials = await RawMaterial.find({
        project: existingWorkOrder.projectId,
        diameter: { $in: Array.from(netDiameterWeightMap.keys()).map(Number) },
        isDeleted: false,
    });

    for (const [diameter, netWeight] of netDiameterWeightMap) {
        if (netWeight > 0) { // Additional weight required
            const rawMaterial = rawMaterials.find((rm) => rm.diameter === Number(diameter));
            if (!rawMaterial) {
                throw new ApiError(400, `No raw material available for diameter ${diameter} mm`);
            }
            if (rawMaterial.qty < netWeight) {
                throw new ApiError(400, `Insufficient raw material for diameter ${diameter} mm. Available: ${rawMaterial.qty}, Required: ${netWeight}`);
            }
        }
    }

    const bulkUpdates = rawMaterials.map((rawMaterial) => {
        const netWeight = netDiameterWeightMap.get(rawMaterial.diameter.toString()) || 0;
        const updateObj = { $inc: { qty: -netWeight } };

        // Find or create/update consumption history
        const existingConsumptionIndex = rawMaterial.consumptionHistory.findIndex((ch) => ch.workOrderId.equals(workOrderId));
        if (netWeight !== 0) {
            if (existingConsumptionIndex !== -1) {
                // Update existing entry
                const newQuantity = rawMaterial.consumptionHistory[existingConsumptionIndex].quantity + netWeight;
                if (newQuantity <= 0) {
                    updateObj.$pull = { consumptionHistory: { workOrderId } };
                } else {
                    updateObj.$set = {
                        [`consumptionHistory.${existingConsumptionIndex}.quantity`]: newQuantity,
                    };
                }
            } else if (netWeight > 0) {
                // Add new entry
                updateObj.$push = { consumptionHistory: { workOrderId, quantity: netWeight } };
            }
        }

        return {
            updateOne: {
                filter: { _id: rawMaterial._id, isDeleted: false },
                update: updateObj,
            },
        };
    });
    if (bulkUpdates.length > 0) {
        await RawMaterial.bulkWrite(bulkUpdates);
    }

    // Prepare updated fields
    const updateFields = {
        ...existingWorkOrder,
        ...bodyData,
        updated_by: userId,
        ...(newFiles.length > 0 && { files: newFiles }),
    };

    // Cleanup schema: remove _id and __v
    delete updateFields._id;
    delete updateFields.__v;

    // Perform update
    const updatedWorkOrder = await ironWorkOrder.findByIdAndUpdate(
        workOrderId,
        { $set: updateFields },
        { new: true }
    )
        .populate('clientId', 'name address')
        .populate('projectId', 'name address')
        .populate('products.shapeId', 'name')
        .populate('updated_by', 'username email')
        .lean();

    // Format IST
    const convertToIST = (date) =>
        date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null;

    const formatted = {
        ...updatedWorkOrder,
        workOrderDate: convertToIST(updatedWorkOrder.workOrderDate),
        createdAt: convertToIST(updatedWorkOrder.createdAt),
        updatedAt: convertToIST(updatedWorkOrder.updatedAt),
        products: updatedWorkOrder.products.map((p) => ({
            ...p,
            deliveryDate: convertToIST(p.deliveryDate),
        })),
        files: updatedWorkOrder.files.map((f) => ({
            ...f,
            uploaded_at: convertToIST(f.uploaded_at),
        })),
    };

    return res.status(200).json(new ApiResponse(200, formatted, 'Work order updated successfully'));
});



const updateIronWorkOrder_23_09_2025_WORKING = asyncHandler(async (req, res) => {
    const workOrderId = req.params.workOrderId;
    console.log("workOrderId", workOrderId);

    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
        throw new ApiError(400, 'Invalid Work Order ID');
    }

    const bodyData = req.body;
    console.log("bodyData", bodyData);
    const userId = req.user?._id?.toString();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID');
    }

    // Parse products if stringified
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch {
            throw new ApiError(400, 'Invalid products JSON');
        }
    }

    // Normalize product data types
    const normalizedProducts = bodyData.products.map((product) => ({
        ...product,
        quantity: Number(product.quantity),
        memberQuantity: Number(product.memberQuantity),
        diameter: Number(product.diameter),
        weight: String(product.weight),
        cuttingLength: product.cuttingLength ? Number(product.cuttingLength) : null,
        dimensions: product.dimensions || [],
        ...(product._id && mongoose.Types.ObjectId.isValid(product._id) ? { _id: product._id } : {}),
    }));

    // Normalize workOrderDate
    const normalizedWorkOrderDate = bodyData.workOrderDate
        ? moment(bodyData.workOrderDate, ['DD-MM-YYYY', 'YYYY-MM-DD']).toDate()
        : null;

    // Normalize deliveryDate
    const normalizedDeliveryDate = bodyData.deliveryDate
        ? moment(bodyData.deliveryDate, ['DD-MM-YYYY', 'YYYY-MM-DD']).toDate()
        : null;

    // Validate normalized products with Joi
    const productSchema = Joi.object({
        shapeId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        quantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        barMark: Joi.string().optional().allow(''),
        memberDetails: Joi.string().optional().allow(''),
        memberQuantity: Joi.number().min(0).required().messages({
            'number.base': 'Member quantity must be a number',
            'number.min': 'Member quantity must be non-negative',
        }),
        diameter: Joi.number().min(0).required().messages({ 
            'number.base': 'Diameter must be a number',
            'number.min': 'Diameter must be non-negative',
        }),
        weight: Joi.string().required().custom((value, helpers) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                return helpers.error('any.invalid', { message: 'Weight must be a valid non-negative number' });
            }
            return value;
        }, 'Weight validation'),
        cuttingLength: Joi.number().min(0).optional().allow(null),
        dimensions: Joi.array()
            .items(
                Joi.object({
                    name: Joi.string().required().messages({ 'string.empty': 'Dimension name is required' }),
                    value: Joi.string().required().messages({ 'string.empty': 'Dimension value is required' }),
                })
            )
            .optional(),
        _id: Joi.string().optional().custom((value, helpers) => {
            if (value && !mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
    });

    const workOrderSchema = Joi.object({
        clientId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        projectId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        workOrderNumber: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
        workOrderDate: Joi.date().required().messages({ 'date.base': 'Work order date must be a valid date' }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        globalMemberDetails: Joi.string().optional().allow(''),
        products: Joi.array().items(productSchema).min(1).required().messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array()
            .items(
                Joi.object({
                    file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
                    file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
                    uploaded_at: Joi.date().optional(),
                })
            )
            .optional(),
        updated_by: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        existing_files: Joi.alternatives()
            .try(Joi.string(), Joi.array().items(Joi.string()))
            .optional()
            .messages({ 'alternatives.types': 'existing_files must be a string or array of strings' }),
    });

    // Validate normalized data
    const { error } = workOrderSchema.validate(
        {
            ...bodyData,
            products: normalizedProducts,
            workOrderDate: normalizedWorkOrderDate,
            deliveryDate: normalizedDeliveryDate,
            updated_by: userId,
        },
        { abortEarly: false }
    );
    if (error) {
        throw new ApiError(400, 'Validation failed for work order update', error.details);
    }

    // Fetch existing work order
    const existingWorkOrder = await ironWorkOrder.findById(workOrderId).lean();
    if (!existingWorkOrder) {
        throw new ApiError(404, 'Work order not found');
    }

    // Handle file uploads
    // const newFiles = [];
    // if (req.files && req.files.length > 0) {
    //     for (const file of req.files) {
    //         const tempPath = path.join('./public/temp', file.filename);
    //         const buffer = fs.readFileSync(tempPath);
    //         const sanitized = sanitizeFilename(file.originalname);

    //         if (file.size > 5 * 1024 * 1024) {
    //             fs.unlinkSync(tempPath);
    //             throw new ApiError(400, `${file.originalname} exceeds 5MB`);
    //         }

    //         const { url } = await putObject(
    //             { data: buffer, mimetype: file.mimetype },
    //             `iron-work-orders/${Date.now()}-${sanitized}`
    //         );

    //         fs.unlinkSync(tempPath);

    //         newFiles.push({
    //             file_name: file.originalname,
    //             file_url: url,
    //             uploaded_at: new Date(),
    //         });
    //     }

    //     // Delete old files from S3
    //     if (existingWorkOrder.files?.length > 0) {
    //         for (const oldFile of existingWorkOrder.files) {
    //             const key = oldFile.file_url.split('/').slice(-1)[0];
    //             await deleteObject(`iron-work-orders/${key}`);
    //         }
    //     }
    // }




    // Handle file uploads (directly from memory, no temp folder)
    const newFiles = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const sanitized = sanitizeFilename(file.originalname);

            if (file.size > 5 * 1024 * 1024) {
                throw new ApiError(400, `${file.originalname} exceeds 5MB`);
            }

            // Upload directly from memory buffer
            const { url } = await putObject(
                { data: file.buffer, mimetype: file.mimetype },
                `iron-work-orders/${Date.now()}-${sanitized}`
            );

            newFiles.push({
                file_name: file.originalname,
                file_url: url,
                uploaded_at: new Date(),
            });
        }

        // Delete old files from S3 if completely replacing
        if (existingWorkOrder.files?.length > 0 && !bodyData.existing_files) {
            for (const oldFile of existingWorkOrder.files) {
                const key = oldFile.file_url.split('/').slice(-1)[0];
                await deleteObject(`iron-work-orders/${key}`);
            }
        }
    }


    // Handle existing files
    let files = newFiles;
    if (bodyData.existing_files) {
        try {
            const existingFiles = Array.isArray(bodyData.existing_files)
                ? bodyData.existing_files
                : [bodyData.existing_files];
            files = [
                ...existingWorkOrder.files.filter((f) =>
                    existingFiles.includes(f._id.toString())
                ),
                ...newFiles,
            ];
        } catch {
            console.warn('Failed to parse existing_files, ignoring');
        }
    }

    // Calculate weight changes
    const existingDiameterWeightMap = new Map();
    existingWorkOrder.products.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight) || 0;
        existingDiameterWeightMap.set(key, (existingDiameterWeightMap.get(key) || 0) + weight);
    });

    const newDiameterWeightMap = new Map();
    normalizedProducts.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight) || 0;
        newDiameterWeightMap.set(key, (newDiameterWeightMap.get(key) || 0) + weight);
    });

    const netDiameterWeightMap = new Map();
    for (const [diameter, newWeight] of newDiameterWeightMap) {
        const oldWeight = existingDiameterWeightMap.get(diameter) || 0;
        netDiameterWeightMap.set(diameter, newWeight - oldWeight);
    }

    // Validate and update raw material
    const rawMaterials = await RawMaterial.find({
        project: existingWorkOrder.projectId,
        diameter: { $in: Array.from(netDiameterWeightMap.keys()).map(Number) },
        isDeleted: false,
    });

    for (const [diameter, netWeight] of netDiameterWeightMap) {
        if (netWeight > 0) {
            const rawMaterial = rawMaterials.find((rm) => rm.diameter === Number(diameter));
            if (!rawMaterial) {
                throw new ApiError(400, `No raw material available for diameter ${diameter} mm`);
            }
            if (rawMaterial.qty < netWeight) {
                throw new ApiError(400, `Insufficient raw material for diameter ${diameter} mm. Available: ${rawMaterial.qty}, Required: ${netWeight}`);
            }
        }
    }

    const bulkUpdates = rawMaterials.map((rawMaterial) => {
        const netWeight = netDiameterWeightMap.get(rawMaterial.diameter.toString()) || 0;
        const updateObj = { $inc: { qty: -netWeight } };

        const existingConsumptionIndex = rawMaterial.consumptionHistory.findIndex((ch) =>
            ch.workOrderId.equals(workOrderId)
        );
        if (netWeight !== 0) {
            if (existingConsumptionIndex !== -1) {
                const newQuantity = rawMaterial.consumptionHistory[existingConsumptionIndex].quantity + netWeight;
                if (newQuantity <= 0) {
                    updateObj.$pull = { consumptionHistory: { workOrderId } };
                } else {
                    updateObj.$set = {
                        [`consumptionHistory.${existingConsumptionIndex}.quantity`]: newQuantity,
                    };
                }
            } else if (netWeight > 0) {
                updateObj.$push = { consumptionHistory: { workOrderId, quantity: netWeight } };
            }
        }

        return {
            updateOne: {
                filter: { _id: rawMaterial._id, isDeleted: false },
                update: updateObj,
            },
        };
    });

    if (bulkUpdates.length > 0) {
        await RawMaterial.bulkWrite(bulkUpdates);
    }

    // Prepare updated fields
    const updateFields = {
        ...bodyData,
        products: normalizedProducts,
        workOrderDate: normalizedWorkOrderDate || existingWorkOrder.workOrderDate,
        deliveryDate: normalizedDeliveryDate || existingWorkOrder.deliveryDate,
        updated_by: userId,
        ...(files.length > 0 && { files }),
    };

    // Cleanup schema: remove _id, __v, and unexpected fields
    delete updateFields._id;
    delete updateFields.__v;
    delete updateFields.existing_files;

    // Perform update
    const updatedWorkOrder = await ironWorkOrder.findByIdAndUpdate(
        workOrderId,
        { $set: updateFields },
        { new: true }
    )
        .populate('clientId', 'name address')
        .populate('projectId', 'name address')
        .populate('products.shapeId', 'name')
        .populate('updated_by', 'username email')
        .lean();

    if (!updatedWorkOrder) {
        throw new ApiError(404, 'Failed to update work order');
    }

    // Format IST
    const convertToIST = (date) =>
        date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null;

    const formatted = {
        ...updatedWorkOrder,
        workOrderDate: convertToIST(updatedWorkOrder.workOrderDate),
        createdAt: convertToIST(updatedWorkOrder.createdAt),
        updatedAt: convertToIST(updatedWorkOrder.updatedAt),
        products: updatedWorkOrder.products.map((p) => ({
            ...p,
            deliveryDate: convertToIST(p.deliveryDate),
        })),
        files: updatedWorkOrder.files.map((f) => ({
            ...f,
            uploaded_at: convertToIST(f.uploaded_at),
        })),
    };

    return res.status(200).json(new ApiResponse(200, formatted, 'Work order updated successfully'));
});







const updateIronWorkOrder = asyncHandler(async (req, res) => {
    const workOrderId = req.params.workOrderId;

    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
        throw new ApiError(400, 'Invalid Work Order ID');
    }

    const bodyData = req.body;
    const userId = req.user?._id?.toString();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, 'Invalid or missing user ID');
    }

    // Parse products if stringified
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch {
            throw new ApiError(400, 'Invalid products JSON');
        }
    }

    // Normalize product data types
    const normalizedProducts = bodyData.products.map((product) => ({
        ...product,
        quantity: Number(product.quantity),
        memberQuantity: Number(product.memberQuantity),
        diameter: Number(product.diameter),
        weight: String(product.weight),
        cuttingLength: product.cuttingLength ? Number(product.cuttingLength) : null,
        dimensions: product.dimensions || [],
        ...(product._id && mongoose.Types.ObjectId.isValid(product._id) ? { _id: product._id } : {}),
    }));

    // Validate normalized products with Joi
    const productSchema = Joi.object({
        shapeId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Shape ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        uom: Joi.string().required().messages({ 'string.empty': 'UOM is required' }),
        quantity: Joi.number().min(0).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be non-negative',
        }),
        barMark: Joi.string().optional().allow(''),
        memberDetails: Joi.string().optional().allow(''),
        memberQuantity: Joi.number().min(0).required().messages({
            'number.base': 'Member quantity must be a number',
            'number.min': 'Member quantity must be non-negative',
        }),
        diameter: Joi.number().min(0).required().messages({
            'number.base': 'Diameter must be a number',
            'number.min': 'Diameter must be non-negative',
        }),
        weight: Joi.string().required().custom((value, helpers) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                return helpers.error('any.invalid', { message: 'Weight must be a valid non-negative number' });
            }
            return value;
        }, 'Weight validation'),
        cuttingLength: Joi.number().min(0).optional().allow(null),
        dimensions: Joi.array()
            .items(
                Joi.object({
                    name: Joi.string().required().messages({ 'string.empty': 'Dimension name is required' }),
                    value: Joi.string().required().messages({ 'string.empty': 'Dimension value is required' }),
                })
            )
            .optional(),
        _id: Joi.string().optional().custom((value, helpers) => {
            if (value && !mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid', { message: `Product ID (${value}) is not a valid ObjectId` });
            }
            return value;
        }, 'ObjectId validation'),
    });

    const workOrderSchema = Joi.object({
        clientId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        projectId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        workOrderNumber: Joi.string().required().messages({ 'string.empty': 'Work order number is required' }),
        workOrderDate: Joi.date().required().messages({ 'date.base': 'Work order date must be a valid date' }),
        deliveryDate: Joi.date().optional().allow(null).messages({ 'date.base': 'Delivery date must be a valid date' }),
        globalMemberDetails: Joi.string().optional().allow(''),
        products: Joi.array().items(productSchema).min(1).required().messages({
            'array.min': 'At least one product is required',
        }),
        files: Joi.array()
            .items(
                Joi.object({
                    file_name: Joi.string().required().messages({ 'string.empty': 'File name is required' }),
                    file_url: Joi.string().uri().required().messages({ 'string.uri': 'File URL must be a valid URL' }),
                    uploaded_at: Joi.date().optional(),
                })
            )
            .optional(),
        updated_by: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Updated by ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        existing_files: Joi.alternatives()
            .try(Joi.string(), Joi.array().items(Joi.string()))
            .optional()
            .messages({ 'alternatives.types': 'existing_files must be a string or array of strings' }),
    });

    // Validate normalized data
    const { error } = workOrderSchema.validate(
        {
            ...bodyData,
            products: normalizedProducts,
            updated_by: userId,
        },
        { abortEarly: false }
    );
    if (error) {
        throw new ApiError(400, 'Validation failed for work order update', error.details);
    }

    // Fetch existing work order
    const existingWorkOrder = await ironWorkOrder.findById(workOrderId).lean();
    if (!existingWorkOrder) {
        throw new ApiError(404, 'Work order not found');
    }

    // Handle file uploads
    const newFiles = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const sanitized = sanitizeFilename(file.originalname);

            if (file.size > 5 * 1024 * 1024) {
                throw new ApiError(400, `${file.originalname} exceeds 5MB`);
            }

            const { url } = await putObject(
                { data: file.buffer, mimetype: file.mimetype },
                `iron-work-orders/${Date.now()}-${sanitized}`
            );

            newFiles.push({
                file_name: file.originalname,
                file_url: url,
                uploaded_at: new Date(),
            });
        }

        // Delete old files from S3 if completely replacing
        if (existingWorkOrder.files?.length > 0 && !bodyData.existing_files) {
            for (const oldFile of existingWorkOrder.files) {
                const key = oldFile.file_url.split('/').slice(-1)[0];
                await deleteObject(`iron-work-orders/${key}`);
            }
        }
    }

    // Handle existing files
    let files = newFiles;
    if (bodyData.existing_files) {
        try {
            const existingFiles = Array.isArray(bodyData.existing_files)
                ? bodyData.existing_files
                : [bodyData.existing_files];
            files = [
                ...existingWorkOrder.files.filter((f) => existingFiles.includes(f._id.toString())),
                ...newFiles,
            ];
        } catch {
            console.warn('Failed to parse existing_files, ignoring');
        }
    }

    // Calculate weight changes
    const existingDiameterWeightMap = new Map();
    existingWorkOrder.products.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight) || 0;
        existingDiameterWeightMap.set(key, (existingDiameterWeightMap.get(key) || 0) + weight);
    });

    const newDiameterWeightMap = new Map();
    normalizedProducts.forEach((product) => {
        const key = `${product.diameter}`;
        const weight = parseFloat(product.weight) || 0;
        newDiameterWeightMap.set(key, (newDiameterWeightMap.get(key) || 0) + weight);
    });

    const netDiameterWeightMap = new Map();
    for (const [diameter, newWeight] of newDiameterWeightMap) {
        const oldWeight = existingDiameterWeightMap.get(diameter) || 0;
        netDiameterWeightMap.set(diameter, newWeight - oldWeight);
    }

    // Validate and update raw material
    const rawMaterials = await RawMaterial.find({
        project: existingWorkOrder.projectId,
        diameter: { $in: Array.from(netDiameterWeightMap.keys()).map(Number) },
        isDeleted: false,
    });

    for (const [diameter, netWeight] of netDiameterWeightMap) {
        if (netWeight > 0) {
            const rawMaterial = rawMaterials.find((rm) => rm.diameter === Number(diameter));
            if (!rawMaterial) {
                throw new ApiError(400, `No raw material available for diameter ${diameter} mm`);
            }
            if (rawMaterial.qty < netWeight) {
                throw new ApiError(400, `Insufficient raw material for diameter ${diameter} mm. Available: ${rawMaterial.qty}, Required: ${netWeight}`);
            }
        }
    }

    const bulkUpdates = rawMaterials.map((rawMaterial) => {
        const netWeight = netDiameterWeightMap.get(rawMaterial.diameter.toString()) || 0;
        const updateObj = { $inc: { qty: -netWeight } };

        const existingConsumptionIndex = rawMaterial.consumptionHistory.findIndex((ch) =>
            ch.workOrderId.equals(workOrderId)
        );
        if (netWeight !== 0) {
            if (existingConsumptionIndex !== -1) {
                const newQuantity = rawMaterial.consumptionHistory[existingConsumptionIndex].quantity + netWeight;
                if (newQuantity <= 0) {
                    updateObj.$pull = { consumptionHistory: { workOrderId } };
                } else {
                    updateObj.$set = {
                        [`consumptionHistory.${existingConsumptionIndex}.quantity`]: newQuantity,
                    };
                }
            } else if (netWeight > 0) {
                updateObj.$push = { consumptionHistory: { workOrderId, quantity: netWeight } };
            }
        }

        return {
            updateOne: {
                filter: { _id: rawMaterial._id, isDeleted: false },
                update: updateObj,
            },
        };
    });

    if (bulkUpdates.length > 0) {
        await RawMaterial.bulkWrite(bulkUpdates);
    }

    // Prepare updated fields
    const updateFields = {
        ...bodyData,
        products: normalizedProducts,
        workOrderDate: bodyData.workOrderDate || existingWorkOrder.workOrderDate,
        deliveryDate: bodyData.deliveryDate || existingWorkOrder.deliveryDate,
        updated_by: userId,
        ...(files.length > 0 && { files }),
    };

    // Cleanup schema
    delete updateFields._id;
    delete updateFields.__v;
    delete updateFields.existing_files;

    // Perform update
    const updatedWorkOrder = await ironWorkOrder.findByIdAndUpdate(
        workOrderId,
        { $set: updateFields },
        { new: true }
    )
        .populate('clientId', 'name address')
        .populate('projectId', 'name address')
        .populate('products.shapeId', 'name')
        .populate('updated_by', 'username email')
        .lean();

    if (!updatedWorkOrder) {
        throw new ApiError(404, 'Failed to update work order');
    }

    // Format response
    const formatted = {
        ...updatedWorkOrder,
        workOrderDate: updatedWorkOrder.workOrderDate ? new Date(updatedWorkOrder.workOrderDate).toISOString().split('T')[0] : null,
        createdAt: updatedWorkOrder.createdAt ? new Date(updatedWorkOrder.createdAt).toISOString() : null,
        updatedAt: updatedWorkOrder.updatedAt ? new Date(updatedWorkOrder.updatedAt).toISOString() : null,
        files: updatedWorkOrder.files.map((f) => ({
            ...f,
            uploaded_at: f.uploaded_at ? new Date(f.uploaded_at).toISOString() : null,
        })),
    };

    return res.status(200).json(new ApiResponse(200, formatted, 'Work order updated successfully'));
});








/////////////////API to delete data - 

const deleteIronWorkOrder = asyncHandler(async (req, res) => {
    const { workOrderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
        throw new ApiError(400, 'Invalid Work Order ID');
    }

    // 1. Find the existing work order
    const workOrder = await ironWorkOrder.findById(workOrderId);
    if (!workOrder) {
        throw new ApiError(404, 'Work order not found');
    }

    // 2. Delete files from S3 (if any)
    if (Array.isArray(workOrder.files) && workOrder.files.length > 0) {
        for (const file of workOrder.files) {
            try {
                const key = file.file_url.split('/').slice(-1)[0]; // extract key from URL
                await deleteObject(`iron-work-orders/${key}`);
            } catch (err) {
                console.error(`Failed to delete file from S3: ${file.file_name}`, err);
                // You can choose to continue or throw depending on criticality
            }
        }
    }

    // 3. Delete the document from MongoDB
    await ironWorkOrder.findByIdAndDelete(workOrderId);

    return res.status(200).json(new ApiResponse(200, null, 'Work order and files deleted successfully'));
});




export { createIronWorkOrder, getAllIronWorkOrders, getIronWorkOrderById, updateIronWorkOrder, deleteIronWorkOrder };