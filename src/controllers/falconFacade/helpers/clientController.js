// import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from "../../../utils/ApiError.js";
import { formatDateToIST } from "../../../utils/formatDate.js";

import { ApiResponse } from '../../../utils/ApiResponse.js';
import { falconClient } from '../../../models/falconFacade/helpers/falconClient.model.js';
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
  
  const createFalconClient = asyncHandler(async (req, res) => {
    console.log("Inside client api");
    console.log("Client creation request:", req.body);
  
    // Validation schema
    const clientSchema = Joi.object({
      name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
      address: Joi.string().required().messages({ 'string.empty': 'Address is required' }),
    });
  
    // Validate request body
    const { error, value } = clientSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, 'Validation failed for client creation', error.details);
    }
  
    // Extract validated fields
    const { name, address } = value;
    const created_by = req.user?._id;
  
    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
      throw new ApiError(400, 'Invalid or missing user ID in request');
    }
  
    // Create client
    const client = await falconClient.create({ name, address, created_by });
  
    // Send response
    return sendResponse(res, new ApiResponse(201, client, 'Client created successfully'));
  });

// Edit a client
const updateFalconClient = asyncHandler(async (req, res) => {
    // Validation schema
    const clientSchema = Joi.object({
      name: Joi.string().optional().allow('').messages({ 'string.empty': 'Name cannot be empty' }),
      address: Joi.string().optional().allow('').messages({ 'string.empty': 'Address cannot be empty' }),
      created_by: Joi.string()
        .optional()
        .custom((value, helpers) => {
          if (value && !mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `User ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation'),
    });
  
    // Validate request body
    const { error, value } = clientSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, 'Validation failed for client update', error.details);
    }
  
    const { id: clientId } = req.params;
  
    // Validate clientId
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new ApiError(400, `Provided Client ID (${clientId}) is not a valid ObjectId`);
    }
  
    // Prepare update data
    const updateData = {};
    if (value.name) updateData.name = value.name;
    if (value.address) updateData.address = value.address;
    if (value.created_by) updateData.created_by = value.created_by;
  
    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
    }
  
    // Update client
    const client = await falconClient.findByIdAndUpdate(clientId, updateData, { new: true })
      .populate('created_by', 'username email')
      .lean();
  
    if (!client) {
      throw new ApiError(404, 'No client found with the given ID');
    }
  
    // Send response
    return sendResponse(res, new ApiResponse(200, client, 'Client updated successfully'));
  });
// Fetch all clients
const getAllFalconClients = asyncHandler(async (req, res) => {
    const clients = await falconClient.find({ isDeleted: false })
      .populate('created_by', 'username email')
      .lean();
  
    if (!clients || clients.length === 0) {
      throw new ApiError(404, 'No active clients available');
    }
    const formattedClients = formatDateToIST(clients);

  
    return sendResponse(res, new ApiResponse(200, formattedClients, 'Clients fetched successfully'));
  });
  
  // Fetch client by ID
  const getFalconClientById = asyncHandler(async (req, res) => {
    const { id: clientId } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new ApiError(400, `Provided Client ID (${clientId}) is not a valid ObjectId`);
    }
  
    const client = await falconClient.findById(clientId)
      .populate('created_by', 'username email')
      .lean();
  
    if (!client) {
      throw new ApiError(404, 'No client found with the given ID');
    }
    const formattedClient = formatDateToIST(client);

    return sendResponse(res, new ApiResponse(200, formattedClient, 'Client fetched successfully'));
  });

  const deleteFalconClient = asyncHandler(async (req, res) => {
    // Extract IDs from request body
    let ids = req.body.ids;
        console.log('ids', ids);
  
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
  
    // Perform soft deletion by setting isDeleted: true and status: Inactive
    const result = await falconClient.updateMany(
      { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted clients
      {
        $set: {
          isDeleted: true,
          status: 'Inactive',
          updatedAt: Date.now(),
        },
      } // Set isDeleted, status, and update timestamp
    );
  
    // Check if any documents were updated
    if (result.matchedCount === 0) {
      throw new ApiError(404, 'No non-deleted clients found with provided IDs');
    }
  
    // Send response
    return sendResponse(
      res,
      new ApiResponse(
        200,
        { modifiedCount: result.modifiedCount },
        `${result.modifiedCount} client(s) marked as deleted successfully`
      )
    );
  });

export { createFalconClient, updateFalconClient, getAllFalconClients, getFalconClientById, deleteFalconClient };