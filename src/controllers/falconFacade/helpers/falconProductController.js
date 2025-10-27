// import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from "../../../utils/ApiError.js";
import { formatDateToIST } from "../../../utils/formatDate.js";

import { ApiResponse } from '../../../utils/ApiResponse.js';
import { falconProduct } from '../../../models/falconFacade/helpers/falconProduct.model.js';
import { falconJobOrder } from '../../../models/falconFacade/falconJobOrder.model.js';
import Joi from 'joi';

const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
      statusCode: response.statusCode,
      success: response.success,
      message: response.message,
      data: response.data,
    });
  };

const createFalconProduct = asyncHandler(async (req, res) => {
    // Validation schema
    const productSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
    });

    // Validate request body
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for product creation', error.details);
    }

    // Extract validated fields
    const { name } = value;
    const created_by = req.user?._id;

    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // Create product
    const product = await falconProduct.create({ name, created_by });

    // Populate created_by
    const populatedProduct = await falconProduct
        .findById(product._id)
        .populate('created_by', 'username email')
        .lean();

    if (!populatedProduct) {
        throw new ApiError(404, 'Failed to retrieve created product');
    }

    // Convert timestamps to IST
    const formattedProduct = formatDateToIST(populatedProduct);

    return sendResponse(res, new ApiResponse(201, formattedProduct, 'Product created successfully'));
});

// Fetch all non-deleted products
const getAllFalconProducts = asyncHandler(async (req, res) => {
    const products = await falconProduct
        .find({ isDeleted: false })
        .populate('created_by', 'username email')
        .lean();

    if (!products || products.length === 0) {
        throw new ApiError(404, 'No active products available');
    }

    // Convert timestamps to IST
    const formattedProducts = formatDateToIST(products);

    return sendResponse(res, new ApiResponse(200, formattedProducts, 'Products fetched successfully'));
});

// Fetch product by ID
const getFalconProductById = asyncHandler(async (req, res) => {
    const { id: productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new ApiError(400, `Provided Product ID (${productId}) is not a valid ObjectId`);
    }

    const product = await falconProduct
        .findById(productId)
        .populate('created_by', 'username email')
        .lean();

    if (!product) {
        throw new ApiError(404, 'No product found with the given ID');
    }

    // Convert timestamps to IST
    const formattedProduct = formatDateToIST(product);

    return sendResponse(res, new ApiResponse(200, formattedProduct, 'Product fetched successfully'));
});

// Update product by ID
const updateFalconProduct = asyncHandler(async (req, res) => {
    // Validation schema
    const productSchema = Joi.object({
        name: Joi.string().optional().allow('').messages({ 'string.empty': 'Name cannot be empty' }),
        status: Joi.string().valid('Active', 'Inactive').optional().messages({
            'any.only': 'Status must be Active or Inactive',
        }),
    });

    // Validate request body
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for product update', error.details);
    }

    const { id: productId } = req.params;

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new ApiError(400, `Provided Product ID (${productId}) is not a valid ObjectId`);
    }

    // Prepare update data
    const updateData = {};
    if (value.name) updateData.name = value.name;
    if (value.status) updateData.status = value.status;

    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No valid fields provided for update');
    }

    // Update product
    const product = await falconProduct
        .findByIdAndUpdate(productId, updateData, { new: true })
        .populate('created_by', 'username email')
        .lean();

    if (!product) {
        throw new ApiError(404, 'No product found with the given ID');
    }

    // Convert timestamps to IST
    const formattedProduct = formatDateToIST(product);

    return sendResponse(res, new ApiResponse(200, formattedProduct, 'Product updated successfully'));
});

// Soft delete products by IDs
const deleteFalconProduct = asyncHandler(async (req, res) => {
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
    const result = await falconProduct.updateMany(
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
        throw new ApiError(404, 'No non-deleted products found with provided IDs');
    }

    return sendResponse(
        res,
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            `${result.modifiedCount} product(s) marked as deleted successfully`
        )
    );
});

// Get product usage statistics
const getProductUsageStats = asyncHandler(async (req, res) => {
    try {
        // Get all products
        const products = await falconProduct
            .find({ isDeleted: false })
            .populate('created_by', 'username email')
            .lean();

        // Get all job orders with their products
        const jobOrders = await falconJobOrder
            .find({})
            .select('products')
            .lean();

        // Extract all product IDs that are being used in job orders
        const usedProductIds = new Set();
        
        jobOrders.forEach((jobOrder) => {
            if (jobOrder.products && Array.isArray(jobOrder.products)) {
                jobOrder.products.forEach((product) => {
                    if (product.product) {
                        usedProductIds.add(product.product.toString());
                    }
                });
            }
        });

        // Categorize products based on usage
        const activeProducts = products.filter((product) => 
            usedProductIds.has(product._id.toString())
        );
        
        const inactiveProducts = products.filter((product) => 
            !usedProductIds.has(product._id.toString())
        );

        // Calculate additional statistics
        const totalProducts = products.length;
        const activeCount = activeProducts.length;
        const inactiveCount = inactiveProducts.length;
        
        const createdToday = products.filter((product) => {
            const createdDate = new Date(product.createdAt);
            return createdDate.toDateString() === new Date().toDateString();
        }).length;

        const recentActivity = products.filter((product) => {
            const updatedDate = new Date(product.updatedAt);
            return updatedDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }).length;

        const stats = {
            total: totalProducts,
            active: activeCount,
            inactive: inactiveCount,
            createdToday,
            recentActivity,
            usedProductIds: Array.from(usedProductIds),
            activeProducts: activeProducts.map(product => ({
                _id: product._id,
                name: product.name,
                status: product.status
            })),
            inactiveProducts: inactiveProducts.map(product => ({
                _id: product._id,
                name: product.name,
                status: product.status
            }))
        };

        return sendResponse(res, new ApiResponse(200, stats, 'Product usage statistics fetched successfully'));
    } catch (error) {
        console.error('Error fetching product usage stats:', error);
        throw new ApiError(500, 'Failed to fetch product usage statistics');
    }
});

export { createFalconProduct, getAllFalconProducts, getFalconProductById, updateFalconProduct, deleteFalconProduct, getProductUsageStats };     