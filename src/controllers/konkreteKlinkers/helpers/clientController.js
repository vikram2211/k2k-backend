// import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from "../../../utils/ApiError.js";

import { ApiResponse } from '../../../utils/ApiResponse.js';
import { Client } from '../../../models/konkreteKlinkers/helpers/client.model.js';
import Joi from 'joi';

//Create a client
const createClient = asyncHandler(async (req, res, next) => {
  console.log("Inside client api");
  console.log("Client creation request:", req.body);

  // Validation schema
  const clientSchema = Joi.object({
    name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
    address: Joi.string().required().messages({ 'string.empty': 'Address is required' }),
    // created_by: Joi.string().required().messages({ 'string.empty': 'User ID is required' }),
  });

  const { error, value } = clientSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ApiError(400, 'Validation failed for client creation', error.details));
  }

  const { name, address } = value; //created_by
  console.log("user", req.user);
  let created_by = req.user._id;
  console.log("created_by", created_by);


  if (!mongoose.Types.ObjectId.isValid(created_by)) {
    return next(new ApiError(400, `Provided User ID (${created_by}) is not a valid ObjectId`));
  }

  const client = await Client.create({ name, address, created_by });

  return res.status(201).json(new ApiResponse(201, client, 'Client created successfully'));
});

// Edit a client
const updateClient = asyncHandler(async (req, res, next) => {
  const clientSchema = Joi.object({
    name: Joi.string().optional().messages({ 'string.empty': 'Name is required' }),
    address: Joi.string().optional().messages({ 'string.empty': 'Address is required' }),
    created_by: Joi.string().optional().messages({ 'string.empty': 'User ID cannot be empty' }),
  });

  const { error, value } = clientSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ApiError(400, 'Validation failed for client update', error.details));
  }

  const clientId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return next(new ApiError(400, `Provided Client ID (${clientId}) is not a valid ObjectId`));
  }

  if (value.created_by && !mongoose.Types.ObjectId.isValid(value.created_by)) {
    return next(new ApiError(400, `Provided User ID (${value.created_by}) is not a valid ObjectId`));
  }

  const updateData = {};
  if (value.name) updateData.name = value.name;
  if (value.address) updateData.address = value.address;
  if (value.created_by) updateData.created_by = value.created_by;

  const client = await Client.findByIdAndUpdate(clientId, updateData, { new: true });

  if (!client) {
    return next(new ApiError(404, 'No client found with the given ID'));
  }

  return res.status(200).json(new ApiResponse(200, client, 'Client updated successfully'));
});

// Fetch all clients
// const getAllClients = asyncHandler(async (req, res, next) => {
//   const clients = await Client.find({ isDeleted: false }).populate('created_by', 'username email');

//   if (!clients || clients.length === 0) {
//     return next(new ApiError(404, 'No active clients available'));
//   }

//   return res.status(200).json(new ApiResponse(200, clients, 'Clients fetched successfully'));
// });


// Fetch all clients with pagination
const getAllClients = asyncHandler(async (req, res, next) => {
  // Default values
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  // Count total
  const totalClients = await Client.countDocuments({ isDeleted: false });

  // Fetch paginated clients
  const clients = await Client.find({ isDeleted: false })
    .populate('created_by', 'username email')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 }); // Optional: Sort newest first

  if (!clients || clients.length === 0) {
    return next(new ApiError(404, 'No active clients available'));
  }

  // Respond with pagination metadata
  return res.status(200).json(
    new ApiResponse(200, {
      clients,
      pagination: {
        total: totalClients,
        page,
        limit,
        totalPages: Math.ceil(totalClients / limit),
      },
    }, 'Clients fetched successfully')
  );
});


////////////////////////////////////////////////////////////////////////////////////////////

// Fetch client by ID
const getClientById = asyncHandler(async (req, res, next) => {
  const clientId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return next(new ApiError(400, `Provided Client ID (${clientId}) is not a valid ObjectId`));
  }

  const client = await Client.findById(clientId).populate('created_by', 'username email');

  if (!client) {
    return next(new ApiError(404, 'No client found with the given ID'));
  }

  return res.status(200).json(new ApiResponse(200, client, 'Client fetched successfully'));
});

const deleteClient = asyncHandler(async (req, res, next) => {
  // Extract IDs from request body
  let ids = req.body.ids;
  console.log('ids', ids);

  // Ensure ids is always an array
  if (!ids) {
    return res.status(400).json(new ApiResponse(400, null, 'No IDs provided'));
  }
  if (!Array.isArray(ids)) {
    ids = [ids]; // Convert single ID to array
  }

  // Validate IDs
  if (ids.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, 'IDs array cannot be empty'));
  }

  // Validate MongoDB ObjectIds
  const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
  }

  // Perform soft deletion by setting isDeleted: true
  const result = await Client.updateMany(
    { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted clients
    { $set: { isDeleted: true, updatedAt: Date.now() } } // Set isDeleted and update timestamp
  );

  // Check if any documents were updated
  if (result.matchedCount === 0) {
    return res.status(404).json(new ApiResponse(404, null, 'No non-deleted clients found with provided IDs'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount },
      `${result.modifiedCount} client(s) marked as deleted successfully`
    )
  );
});

export { createClient, updateClient, getAllClients, getClientById, deleteClient };