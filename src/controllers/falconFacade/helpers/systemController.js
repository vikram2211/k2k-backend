// import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from "../../../utils/ApiError.js";
import { formatDateToIST } from "../../../utils/formatDate.js";

import { ApiResponse } from '../../../utils/ApiResponse.js';
import { falconSystem } from '../../../models/falconFacade/helpers/falconSystem.model.js';
import { falconInternalWorkOrder } from '../../../models/falconFacade/falconInternalWorder.model.js';
import Joi from 'joi';

//Create a client
const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
      statusCode: response.statusCode,
      success: response.success,
      message: response.message,
      data: response.data,
    });
  };

  const createFalconSystem = asyncHandler(async (req, res) => {
    console.log("Inside system api");
    console.log("system creation request:", req.body);
  
    // Validation schema
    const sysytmSchema = Joi.object({
      name: Joi.string().required().messages({ 'string.empty': 'Name is required' })
    });
  
    // Validate request body
    const { error, value } = sysytmSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, 'Validation failed for System creation', error.details);
    }
  
    // Extract validated fields
    const { name } = value;
    const created_by = req.user?._id;
  
    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
      throw new ApiError(400, 'Invalid or missing user ID in request');
    }
  
    // Create client
    const system = await falconSystem.create({ name, created_by });
  
    // Send response
    return sendResponse(res, new ApiResponse(201, system, 'System created successfully'));
  });
  

  const getAllFalconSystems = asyncHandler(async (req, res) => {
    const systems = await falconSystem
      .find({ isDeleted: false })
      .populate('created_by', 'username email')
      .lean();
  
    if (!systems || systems.length === 0) {
      throw new ApiError(404, 'No active systems available');
    }
  
    // Convert timestamps to IST
    const formattedSystems = formatDateToIST(systems);
  
    return sendResponse(res, new ApiResponse(200, formattedSystems, 'Systems fetched successfully'));
  });
  
  // Fetch system by ID
  const getFalconSystemById = asyncHandler(async (req, res) => {
    const { id: systemId } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(systemId)) {
      throw new ApiError(400, `Provided System ID (${systemId}) is not a valid ObjectId`);
    }
  
    const system = await falconSystem
      .findById(systemId)
      .populate('created_by', 'username email')
      .lean();
  
    if (!system) {
      throw new ApiError(404, 'No system found with the given ID');
    }
  
    // Convert timestamps to IST
    const formattedSystem = formatDateToIST(system);
  
    return sendResponse(res, new ApiResponse(200, formattedSystem, 'System fetched successfully'));
  });
  
  // Update system by ID
  const updateFalconSystem = asyncHandler(async (req, res) => {
    // Validation schema
    const systemSchema = Joi.object({
      name: Joi.string().optional().allow('').messages({ 'string.empty': 'Name cannot be empty' }),
      status: Joi.string().valid('Active', 'Inactive').optional().messages({
        'any.only': 'Status must be Active or Inactive',
      }),
    });
  
    // Validate request body
    const { error, value } = systemSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, 'Validation failed for system update', error.details);
    }
  
    const { id: systemId } = req.params;
  
    // Validate systemId
    if (!mongoose.Types.ObjectId.isValid(systemId)) {
      throw new ApiError(400, `Provided System ID (${systemId}) is not a valid ObjectId`);
    }
  
    // Prepare update data
    const updateData = {};
    if (value.name) updateData.name = value.name;
    if (value.status) updateData.status = value.status;
  
    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
    }
  
    // Update system
    const system = await falconSystem
      .findByIdAndUpdate(systemId, updateData, { new: true })
      .populate('created_by', 'username email')
      .lean();
  
    if (!system) {
      throw new ApiError(404, 'No system found with the given ID');
    }
  
    // Convert timestamps to IST
    const formattedSystem = formatDateToIST(system);
  
    return sendResponse(res, new ApiResponse(200, formattedSystem, 'System updated successfully'));
  });
  
  // Soft delete systems by IDs
  const deleteFalconSystem = asyncHandler(async (req, res) => {
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
    const result = await falconSystem.updateMany(
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
      throw new ApiError(404, 'No non-deleted systems found with provided IDs');
    }
  
    return sendResponse(
      res,
      new ApiResponse(
        200,
        { modifiedCount: result.modifiedCount },
        `${result.modifiedCount} system(s) marked as deleted successfully`
      )
    );
  });
  
  // Get system usage statistics
  const getSystemUsageStats = asyncHandler(async (req, res) => {
    try {
      // Get all systems
      const systems = await falconSystem
        .find({ isDeleted: false })
        .populate('created_by', 'username email')
        .lean();

      // Get all internal work orders with their products
      const internalWorkOrders = await falconInternalWorkOrder
        .find({})
        .select('products')
        .lean();

      // Extract all system IDs that are being used in internal work orders
      const usedSystemIds = new Set();
      
      internalWorkOrders.forEach((iwo) => {
        if (iwo.products && Array.isArray(iwo.products)) {
          iwo.products.forEach((product) => {
            if (product.system) {
              usedSystemIds.add(product.system.toString());
            }
          });
        }
      });

      // Categorize systems based on usage
      const activeSystems = systems.filter((system) => 
        usedSystemIds.has(system._id.toString())
      );
      
      const inactiveSystems = systems.filter((system) => 
        !usedSystemIds.has(system._id.toString())
      );

      // Calculate additional statistics
      const totalSystems = systems.length;
      const activeCount = activeSystems.length;
      const inactiveCount = inactiveSystems.length;
      
      const createdToday = systems.filter((system) => {
        const createdDate = new Date(system.createdAt);
        return createdDate.toDateString() === new Date().toDateString();
      }).length;

      const recentActivity = systems.filter((system) => {
        const updatedDate = new Date(system.updatedAt);
        return updatedDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }).length;

      const stats = {
        total: totalSystems,
        active: activeCount,
        inactive: inactiveCount,
        createdToday,
        recentActivity,
        usedSystemIds: Array.from(usedSystemIds),
        activeSystems: activeSystems.map(system => ({
          _id: system._id,
          name: system.name,
          status: system.status
        })),
        inactiveSystems: inactiveSystems.map(system => ({
          _id: system._id,
          name: system.name,
          status: system.status
        }))
      };

      return sendResponse(res, new ApiResponse(200, stats, 'System usage statistics fetched successfully'));
    } catch (error) {
      console.error('Error fetching system usage stats:', error);
      throw new ApiError(500, 'Failed to fetch system usage statistics');
    }
  });

  export {createFalconSystem, getAllFalconSystems, getFalconSystemById, updateFalconSystem, deleteFalconSystem, getSystemUsageStats };