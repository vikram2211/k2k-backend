import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { ironShape } from '../../../models/ironSmith/helpers/ironShape.model.js';
import Joi from 'joi';
import { formatDateToIST } from '../../../utils/formatDate.js';
import { putObject } from '../../../../util/putObject.js';
import path from 'path';
import fs from 'fs';

// Helper function to send response
const sendResponse = (res, response) => {
  return res.status(response.statusCode).json({
    statusCode: response.statusCode,
    success: response.success,
    message: response.message,
    data: response.data,
  });
};

// Create a shape
const createIronShape = asyncHandler(async (req, res) => {
  console.log("Inside iron shape creation API");
  console.log("Shape creation request:", req.body, req.files);

  // Validation schema for request body
  const shapeSchema = Joi.object({
    dimension: Joi.string().required().messages({ 'string.empty': 'Dimesion is required' }),
    description: Joi.string().required().messages({ 'string.empty': 'Description is required' }),
    shape_code: Joi.string().required().messages({ 'string.empty': 'Shape code is required' }),
  });

  // Validate request body
  const { error, value } = shapeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw new ApiError(400, 'Validation failed for shape creation', error.details);
  }

  // Extract validated fields
  const { dimension, description, shape_code } = value;
  const created_by = req.user?._id;

  // Validate created_by
  if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
    throw new ApiError(400, 'Invalid or missing user ID in request');
  }

  // Validate file upload
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'At least one file is required');
  }

  // Handle file upload to S3
  const uploadedFiles = [];
  for (const file of req.files) {
    const tempFilePath = path.join('./public/temp', file.filename);
    const fileBuffer = fs.readFileSync(tempFilePath);

    // Upload to S3
    const { url } = await putObject(
      { data: fileBuffer, mimetype: file.mimetype },
      `shapes/${Date.now()}-${file.originalname}`
    );

    // Delete temp file
    fs.unlinkSync(tempFilePath);

    uploadedFiles.push({
      file_name: file.originalname,
      file_url: url,
    });
  }

  // Use the first uploaded file (assuming single file upload for simplicity)
  const file = uploadedFiles[0];

  // Create shape with isDeleted set to false by default
  const shape = await ironShape.create({
    dimension,
    description,
    shape_code,
    file,
    created_by,
    isDeleted: false,
  });

  // Send response
  return sendResponse(res, new ApiResponse(201, shape, 'Shape created successfully'));
});

// Update a shape
const updateIronShape = asyncHandler(async (req, res) => {
    // Validation schema
    const shapeSchema = Joi.object({
      dimension: Joi.string().optional().allow('').messages({ 'string.empty': 'Dimension cannot be empty' }),
      description: Joi.string().optional().allow('').messages({ 'string.empty': 'Description cannot be empty' }),
      shape_code: Joi.string().optional().allow('').messages({ 'string.empty': 'Shape code cannot be empty' }),
      created_by: Joi.string()
        .optional()
        .custom((value, helpers) => {
          if (value && !mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error('any.invalid', { message: `User ID (${value}) is not a valid ObjectId` });
          }
          return value;
        }, 'ObjectId validation'),
    });
    console.log("body",req.body);
  
    // Validate request body
    const { error, value } = shapeSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, 'Validation failed for shape update', error.details);
    }
  
    const { id: shapeId } = req.params;
    console.log("id",req.params.id);
    console.log("value",value);
  
    // Validate shapeId
    if (!mongoose.Types.ObjectId.isValid(shapeId)) {
      throw new ApiError(400, `Provided Shape ID (${shapeId}) is not a valid ObjectId`);
    }
  
    // Prepare update data
    const updateData = {};
    if (value.dimension !== undefined) updateData.dimension = value.dimension;
    if (value.description !== undefined) updateData.description = value.description;
    if (value.shape_code !== undefined) updateData.shape_code = value.shape_code;
    if (value.created_by) updateData.created_by = value.created_by;
  
    // Handle file upload if provided
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        const tempFilePath = path.join('./public/temp', file.filename);
        const fileBuffer = fs.readFileSync(tempFilePath);
  
        // Upload to S3
        const { url } = await putObject(
          { data: fileBuffer, mimetype: file.mimetype },
          `shapes/${Date.now()}-${file.originalname}`
        );
  
        // Delete temp file
        fs.unlinkSync(tempFilePath);
  
        uploadedFiles.push({
          file_name: file.originalname,
          file_url: url,
        });
      }
      updateData.file = uploadedFiles[0]; // Use the first uploaded file
    }
  
    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'At least one valid field must be provided for update');
    }
  
    // Update shape
    const shape = await ironShape.findOneAndUpdate(
      { _id: shapeId, isDeleted: false },
      updateData,
      { new: true }
    )
      .populate('created_by', 'username email')
      .lean();
  
    if (!shape) {
      throw new ApiError(404, 'No non-deleted shape found with the given ID');
    }
  
    // Format timestamps
    const formattedShape = formatDateToIST(shape);
  
    // Send response
    return sendResponse(res, new ApiResponse(200, formattedShape, 'Shape updated successfully'));
  });

// Fetch all shapes
// const getAllIronShapes = asyncHandler(async (req, res) => {
//   const shapes = await ironShape
//     .find({ isDeleted: false })
//     .populate('created_by', 'username email')
//     .populate('dimension', 'dimension_name')
//     .lean();

//   if (!shapes || shapes.length === 0) {
//     throw new ApiError(404, 'No non-deleted shapes available');
//   }

//   const formattedShapes = formatDateToIST(shapes);

//   return sendResponse(res, new ApiResponse(200, formattedShapes, 'Shapes fetched successfully'));
// });


const getAllIronShapes = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalShapes = await ironShape.countDocuments({ isDeleted: false });

  const shapes = await ironShape.find({ isDeleted: false })
    .populate('created_by', 'username email')
    .populate('dimension', 'dimension_name')
    .skip(skip)
    .limit(limit)
    .lean();

  if (!shapes || shapes.length === 0) {
    throw new ApiError(404, 'No non-deleted shapes available');
  }

  const formattedShapes = formatDateToIST(shapes);

  return sendResponse(
    res,
    new ApiResponse(200, {
      shapes: formattedShapes,
      pagination: {
        total: totalShapes,
        page,
        limit,
        totalPages: Math.ceil(totalShapes / limit),
      },
    }, 'Shapes fetched successfully')
  );
});



// Fetch shape by ID
const getIronShapeById = asyncHandler(async (req, res) => {
  const { id: shapeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(shapeId)) {
    throw new ApiError(400, `Provided Shape ID (${shapeId}) is not a valid ObjectId`);
  }

  const shape = await ironShape
    .findOne({ _id: shapeId, isDeleted: false })
    .populate('created_by', 'username email')
    .populate('dimension', 'dimension_name') 
    .lean();

  if (!shape) {
    throw new ApiError(404, 'No non-deleted shape found with the given ID');
  }

  const formattedShape = formatDateToIST(shape);

  return sendResponse(res, new ApiResponse(200, formattedShape, 'Shape fetched successfully'));
});

// Delete shapes
const deleteIronShape = asyncHandler(async (req, res) => {
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

  // Perform soft deletion by setting isDeleted: true
  const result = await ironShape.updateMany(
    { _id: { $in: ids }, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        updatedAt: Date.now(),
      },
    }
  );

  // Check if any documents were updated
  if (result.matchedCount === 0) {
    throw new ApiError(404, 'No non-deleted shapes found with provided IDs');
  }

  // Send response
  return sendResponse(
    res,
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount },
      `${result.modifiedCount} shape(s) marked as deleted successfully`
    )
  );
});

export { createIronShape, updateIronShape, getAllIronShapes, getIronShapeById, deleteIronShape };