import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { ironMachine } from '../../../models/ironSmith/helpers/ironMachine.model.js';
import {putObject} from '../../../../util/putObject.js';
import Joi from 'joi';
import { formatDateToIST } from '../../../utils/formatDate.js';

// Helper function to send response
const sendResponse = (res, response) => {
  return res.status(response.statusCode).json({
    statusCode: response.statusCode,
    success: response.success,
    message: response.message,
    data: response.data,
  });
};

// Create a machine
const createIronMachine_19_09_2025 = asyncHandler(async (req, res) => {
    console.log("Inside iron machine creation API");
    console.log("Machine creation request:", req.body);
  
    // Validation schema
    const machineSchema = Joi.object({
      name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
      role: Joi.string().required().messages({ 'string.empty': 'Role is required' }),
    });
  
    // Validate request body
    const { error, value } = machineSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, 'Validation failed for machine creation', error.details);
    }
  
    // Extract validated fields
    const { name, role } = value;
    const created_by = req.user?._id;
  
    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
      throw new ApiError(400, 'Invalid or missing user ID in request');
    }
  
    // Create machine with isDeleted set to false by default
    const machine = await ironMachine.create({ name, role, created_by, isDeleted: false });
  
    // Send response
    return sendResponse(res, new ApiResponse(201, machine, 'Machine created successfully'));
  });
  const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  };

  const createIronMachine = asyncHandler(async (req, res) => {
    console.log("Inside iron machine creation API");
    console.log("Machine creation request:", req.body);
  
    // ✅ Validation schema for machine fields
    const machineSchema = Joi.object({
      name: Joi.string().required().messages({ "string.empty": "Name is required" }),
      role: Joi.string().required().messages({ "string.empty": "Role is required" }),
    });
  
    // Validate request body
    const { error, value } = machineSchema.validate(req.body, { abortEarly: false });
    if (error) {
      throw new ApiError(400, "Validation failed for machine creation", error.details);
    }
  
    const { name, role } = value;
    const created_by = req.user?._id;
  
    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
      throw new ApiError(400, "Invalid or missing user ID in request");
    }
  
    // ✅ Handle file upload to S3
    let fileData = null;
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        try {
          // Key format: machines/<timestamp>-filename.pdf|jpg|png
          const s3Key = `machines/${Date.now()}-${sanitizeFilename(file.originalname)}`;
          const { url } = await putObject(
            { data: file.buffer, mimetype: file.mimetype },
            s3Key
          );
  
          uploadedFiles.push({
            file_name: file.originalname,
            file_url: url,
          });
        } catch (err) {
          throw new ApiError(500, `Failed to upload machine file: ${err.message}`);
        }
      }
  
      // Use only first file for now
      fileData = uploadedFiles[0];
    } else {
      throw new ApiError(400, "Machine file (pdf/image) is required");
    }
  
    // ✅ Create machine record
    const machine = await ironMachine.create({
      name,
      role,
      created_by,
      isDeleted: false,
      file: fileData,
    });
  
    // ✅ Send response
    return sendResponse(res, new ApiResponse(201, machine, "Machine created successfully"));
  });

// Update a machine
const updateIronMachine_22_09_2025 = asyncHandler(async (req, res) => {
  // Validation schema
  const machineSchema = Joi.object({
    name: Joi.string().optional().allow('').messages({ 'string.empty': 'Name cannot be empty' }),
    role: Joi.string().optional().allow('').messages({ 'string.empty': 'Role cannot be empty' }),
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
  const { error, value } = machineSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw new ApiError(400, 'Validation failed for machine update', error.details);
  }

  const { id: machineId } = req.params;

  // Validate machineId
  if (!mongoose.Types.ObjectId.isValid(machineId)) {
    throw new ApiError(400, `Provided Machine ID (${machineId}) is not a valid ObjectId`);
  }

  // Prepare update data
  const updateData = {};
  if (value.name) updateData.name = value.name;
  if (value.role) updateData.role = value.role;
  if (value.created_by) updateData.created_by = value.created_by;

  // Check if updateData is empty
  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'No valid fields provided for update');
  }

  // Update machine
  const machine = await ironMachine.findByIdAndUpdate(machineId, updateData, { new: true })
    .populate('created_by', 'username email')
    .lean();

  if (!machine) {
    throw new ApiError(404, 'No machine found with the given ID');
  }

  // Send response
  return sendResponse(res, new ApiResponse(200, machine, 'Machine updated successfully'));
});




const updateIronMachine = asyncHandler(async (req, res) => {
  const { id: machineId } = req.params;

  // Validate machineId
  if (!mongoose.Types.ObjectId.isValid(machineId)) {
      throw new ApiError(400, `Provided Machine ID (${machineId}) is not a valid ObjectId`);
  }

  // Prepare update data
  const updateData = {};

  // Handle file upload to S3
  if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
          try {
              const s3Key = `machines/${Date.now()}-${sanitizeFilename(file.originalname)}`;
              const { url } = await putObject(
                  { data: file.buffer, mimetype: file.mimetype },
                  s3Key
              );
              uploadedFiles.push({
                  file_name: file.originalname,
                  file_url: url,
              });
          } catch (err) {
              throw new ApiError(500, `Failed to upload machine file: ${err.message}`);
          }
      }
      updateData.file = uploadedFiles[0];
  }

  // Parse FormData for name and role
  if (req.body.name) updateData.name = req.body.name;
  if (req.body.role) updateData.role = req.body.role;

  // If updateData is still empty, but a file was uploaded, force include the file
  if (Object.keys(updateData).length === 0 && req.files && req.files.length > 0) {
      updateData.file = {
          file_name: req.files[0].originalname,
          file_url: `machines/${Date.now()}-${sanitizeFilename(req.files[0].originalname)}`,
      };
  }

  // Check if updateData is empty
  if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
  }

  // Update machine
  const machine = await ironMachine.findByIdAndUpdate(machineId, updateData, { new: true })
      .populate('created_by', 'username email')
      .lean();

  if (!machine) {
      throw new ApiError(404, 'No machine found with the given ID');
  }

  // Send response
  return sendResponse(res, new ApiResponse(200, machine, 'Machine updated successfully'));
});







// Fetch all machines
const getAllIronMachines = asyncHandler(async (req, res) => {
  const machines = await ironMachine.find({isDeleted:false})
    .populate('created_by', 'username email')
    .lean();

  if (!machines || machines.length === 0) {
    throw new ApiError(404, 'No machines available');
  }

  const formattedMachines = formatDateToIST(machines);

  return sendResponse(res, new ApiResponse(200, formattedMachines, 'Machines fetched successfully'));
});

// Fetch machine by ID
const getIronMachineById = asyncHandler(async (req, res) => {
  const { id: machineId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(machineId)) {
    throw new ApiError(400, `Provided Machine ID (${machineId}) is not a valid ObjectId`);
  }

  const machine = await ironMachine.findById(machineId)
    .populate('created_by', 'username email')
    .lean();

  if (!machine) {
    throw new ApiError(404, 'No machine found with the given ID');
  }

  const formattedMachine = formatDateToIST(machine);

  return sendResponse(res, new ApiResponse(200, formattedMachine, 'Machine fetched successfully'));
});

// Delete machines
const deleteIronMachine = asyncHandler(async (req, res) => {
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
    const result = await ironMachine.updateMany(
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
      throw new ApiError(404, 'No non-deleted machines found with provided IDs');
    }
  
    // Send response
    return sendResponse(
      res,
      new ApiResponse(
        200,
        { modifiedCount: result.modifiedCount },
        `${result.modifiedCount} machine(s) marked as deleted successfully`
      )
    );
  });

export { createIronMachine, updateIronMachine, getAllIronMachines, getIronMachineById, deleteIronMachine };