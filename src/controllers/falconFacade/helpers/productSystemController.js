// import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from "../../../utils/ApiError.js";
import { formatDateToIST } from "../../../utils/formatDate.js";

import { ApiResponse } from '../../../utils/ApiResponse.js';
import { falconProductSystem } from '../../../models/falconFacade/helpers/falconProductSystem.model.js';
import { falconInternalWorkOrder } from '../../../models/falconFacade/falconInternalWorder.model.js';
import Joi from 'joi';


const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

// Create a product system
const createFalconProductSystem = asyncHandler(async (req, res) => {
    // Validation schema
    const productSystemSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
        system: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `System ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
    });

    // Validate request body
    const { error, value } = productSystemSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for product system creation', error.details);
    }

    // Extract validated fields
    const { name, system } = value;
    const created_by = req.user?._id;

    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // Create product system
    const productSystem = await falconProductSystem.create({ name, system, created_by });

    // Populate system and created_by
    const populatedProductSystem = await falconProductSystem
        .findById(productSystem._id)
        .populate({
            path: 'system',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .lean();

    if (!populatedProductSystem) {
        throw new ApiError(404, 'Failed to retrieve created product system');
    }

    // Convert timestamps to IST
    const formattedProductSystem = formatDateToIST(populatedProductSystem);

    return sendResponse(res, new ApiResponse(201, formattedProductSystem, 'Product system created successfully'));
});

// Fetch all non-deleted product systems
const getAllFalconProductSystems = asyncHandler(async (req, res) => {
    const productSystems = await falconProductSystem
        .find({ isDeleted: false })
        .populate({
            path: 'system',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .lean();
        console.log("productSystems",productSystems);

    if (!productSystems || productSystems.length === 0) {
        throw new ApiError(404, 'No active product systems available');
    }

    // Convert timestamps to IST
    const formattedProductSystems = formatDateToIST(productSystems);

    return sendResponse(res, new ApiResponse(200, formattedProductSystems, 'Product systems fetched successfully'));
});

// Fetch product system by ID
const getFalconProductSystemById = asyncHandler(async (req, res) => {
    const { id: productSystemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productSystemId)) {
        throw new ApiError(400, `Provided Product System ID (${productSystemId}) is not a valid ObjectId`);
    }

    const productSystem = await falconProductSystem
        .findById(productSystemId)
        .populate({
            path: 'system',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .lean();

    if (!productSystem) {
        throw new ApiError(404, 'No product system found with the given ID');
    }

    // Convert timestamps to IST
    const formattedProductSystem = formatDateToIST(productSystem);

    return sendResponse(res, new ApiResponse(200, formattedProductSystem, 'Product system fetched successfully'));
});

// Update product system by ID
const updateFalconProductSystem = asyncHandler(async (req, res) => {
    // Validation schema
    const productSystemSchema = Joi.object({
        name: Joi.string().optional().allow('').messages({ 'string.empty': 'Name cannot be empty' }),
        system: Joi.string()
            .optional()
            .custom((value, helpers) => {
                if (value && !mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `System ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        status: Joi.string().valid('Active', 'Inactive').optional().messages({
            'any.only': 'Status must be Active or Inactive',
        }),
    });

    // Validate request body
    const { error, value } = productSystemSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for product system update', error.details);
    }

    const { id: productSystemId } = req.params;

    // Validate productSystemId
    if (!mongoose.Types.ObjectId.isValid(productSystemId)) {
        throw new ApiError(400, `Provided Product System ID (${productSystemId}) is not a valid ObjectId`);
    }

    // Prepare update data
    const updateData = {};
    if (value.name) updateData.name = value.name;
    if (value.system) updateData.system = value.system;
    if (value.status) updateData.status = value.status;

    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No valid fields provided for update');
    }

    // Update product system
    const productSystem = await falconProductSystem
        .findByIdAndUpdate(productSystemId, updateData, { new: true })
        .populate({
            path: 'system',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .lean();

    if (!productSystem) {
        throw new ApiError(404, 'No product system found with the given ID');
    }

    // Convert timestamps to IST
    const formattedProductSystem = formatDateToIST(productSystem);

    return sendResponse(res, new ApiResponse(200, formattedProductSystem, 'Product system updated successfully'));
});

// Soft delete product systems by IDs
const deleteFalconProductSystem = asyncHandler(async (req, res) => {
    // Extract IDs from request body
    let { ids } = req.body;

    // Validate IDs presence
    if (!ids) {
        throw new ApiError(400, 'No IDs provided');
    }

    // Ensure ids is an array
    if (!Array.isArray(ids)) {
        ids = [ids]; // Convert single ID to array
    }

    // Validate IDs array
    if (ids.length === 0) {
        throw new ApiError(400, 'IDs array cannot be empty');
    }

    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        throw new ApiError(400, `Invalid ID(s): ${invalidIds.join(', ')}`);
    }

    // Perform soft deletion
    const result = await falconProductSystem.updateMany(
        { _id: { $in: ids }, isDeleted: false },
        {
            $set: {
                isDeleted: true,
                status: 'Inactive',
                updatedAt: Date.now(),
            },
        }
    );

    // Check if any documents were updated
    if (result.matchedCount === 0) {
        throw new ApiError(404, 'No non-deleted product systems found with provided IDs');
    }

    return sendResponse(
        res,
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            `${result.modifiedCount} product system(s) marked as deleted successfully`
        )
    );
});

// Get product system usage statistics
const getProductSystemUsageStats = asyncHandler(async (req, res) => {
    try {
        // Get all product systems
        const productSystems = await falconProductSystem
            .find({ isDeleted: false })
            .populate('system', 'name')
            .populate('created_by', 'username email')
            .lean();

        // Get all internal work orders with their products
        const internalWorkOrders = await falconInternalWorkOrder
            .find({})
            .select('products')
            .lean();

        // Extract all product system IDs that are being used in internal work orders
        const usedProductSystemIds = new Set();
        
        internalWorkOrders.forEach((iwo) => {
            if (iwo.products && Array.isArray(iwo.products)) {
                iwo.products.forEach((product) => {
                    if (product.product_system) {
                        usedProductSystemIds.add(product.product_system.toString());
                    }
                });
            }
        });

        // Categorize product systems based on usage
        const activeProductSystems = productSystems.filter((productSystem) => 
            usedProductSystemIds.has(productSystem._id.toString())
        );
        
        const inactiveProductSystems = productSystems.filter((productSystem) => 
            !usedProductSystemIds.has(productSystem._id.toString())
        );

        // Calculate additional statistics
        const totalProductSystems = productSystems.length;
        const activeCount = activeProductSystems.length;
        const inactiveCount = inactiveProductSystems.length;
        
        const createdToday = productSystems.filter((productSystem) => {
            const createdDate = new Date(productSystem.createdAt);
            return createdDate.toDateString() === new Date().toDateString();
        }).length;

        const recentActivity = productSystems.filter((productSystem) => {
            const updatedDate = new Date(productSystem.updatedAt);
            return updatedDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }).length;

        const stats = {
            total: totalProductSystems,
            active: activeCount,
            inactive: inactiveCount,
            createdToday,
            recentActivity,
            usedProductSystemIds: Array.from(usedProductSystemIds),
            activeProductSystems: activeProductSystems.map(productSystem => ({
                _id: productSystem._id,
                name: productSystem.name,
                system: productSystem.system,
                status: productSystem.status
            })),
            inactiveProductSystems: inactiveProductSystems.map(productSystem => ({
                _id: productSystem._id,
                name: productSystem.name,
                system: productSystem.system,
                status: productSystem.status
            }))
        };

        return sendResponse(res, new ApiResponse(200, stats, 'Product system usage statistics fetched successfully'));
    } catch (error) {
        console.error('Error fetching product system usage stats:', error);
        throw new ApiError(500, 'Failed to fetch product system usage statistics');
    }
});

export { createFalconProductSystem, getAllFalconProductSystems, getFalconProductSystemById, updateFalconProductSystem, deleteFalconProductSystem, getProductSystemUsageStats };