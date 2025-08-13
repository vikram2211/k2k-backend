import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { Machine } from "../../../models/konkreteKlinkers/helpers/machine.model.js";
import Joi from "joi";

// Create a new machine
const createMachine = asyncHandler(async (req, res, next) => {
  console.log("Machine creation request:", req.body);

  // Joi validation schema
  const machineSchema = Joi.object({
    // client_id: Joi.string().required().messages({ "string.empty": "Client ID is required" }),
    plant_id: Joi.string().required().messages({ "string.empty": "Client ID is required" }),
    name: Joi.string().required().messages({ "string.empty": "Machine name is required" }),
  });

  const { error, value } = machineSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ApiError(400, "Validation failed for machine creation", error.details));
  }

  // const { client_id, name } = value;
  const { plant_id, name } = value;

  // Ensure `created_by` is taken from the logged-in user
  const created_by = req.user._id;

  // Validate `client_id` as a valid MongoDB ObjectId
  // if (!mongoose.Types.ObjectId.isValid(client_id)) {
  //     return next(new ApiError(400, `Provided Client ID (${client_id}) is not a valid ObjectId`));
  // }
  if (!mongoose.Types.ObjectId.isValid(plant_id)) {
    return next(new ApiError(400, `Provided Client ID (${plant_id}) is not a valid ObjectId`));
  }

  // const machine = await Machine.create({ client_id, name, created_by });
  const machine = await Machine.create({ plant_id, name, created_by });

  return res.status(201).json(new ApiResponse(201, machine, "Machine created successfully"));
});

// Update a machine
const updateMachine = asyncHandler(async (req, res, next) => {
  const machineSchema = Joi.object({
    plant_id: Joi.string().optional(),
    name: Joi.string().optional(),
  });

  const { error, value } = machineSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ApiError(400, "Validation failed for machine update", error.details));
  }

  const machineId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(machineId)) {
    return next(new ApiError(400, `Provided Machine ID (${machineId}) is not a valid ObjectId`));
  }

  const updateData = {};
  if (value.plant_id) {
    if (!mongoose.Types.ObjectId.isValid(value.plant_id)) {
      return next(new ApiError(400, `Provided Plant ID (${value.plant_id}) is not a valid ObjectId`));
    }
    updateData.plant_id = value.plant_id;
  }
  if (value.name) updateData.name = value.name;

  const machine = await Machine.findByIdAndUpdate(machineId, updateData, { new: true });

  if (!machine) {
    return next(new ApiError(404, "No machine found with the given ID"));
  }

  return res.status(200).json(new ApiResponse(200, machine, "Machine updated successfully"));
});
//UPDATED

// Fetch all machines
const getAllMachines = asyncHandler(async (req, res, next) => {
    const machines = await Machine.find({ isDeleted: false }).populate("plant_id", "plant_name").populate("created_by", "username email");

    if (!machines || machines.length === 0) {
        return next(new ApiError(404, "No machines available"));
    }

    return res.status(200).json(new ApiResponse(200, machines, "Machines fetched successfully"));
});

const getAllMachines_25_07_2025 = asyncHandler(async (req, res, next) => {

  // Default values for pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalMachines = await Machine.countDocuments({ isDeleted: false });


  const machines = await Machine.find({ isDeleted: false })
    .populate({
      path: 'plant_id',
      select: 'plant_name plant_code',
      match: { isDeleted: false }, // Only include non-deleted plants
    })
c    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });;

  // Filter out machines where plant_id is null (i.e., plant was deleted)
  const validMachines = machines.filter((machine) => machine.plant_id !== null);

  if (!validMachines || validMachines.length === 0) {
    return next(new ApiError(404, 'No active machines with non-deleted plants available'));
  }

  return res.status(200).json(new ApiResponse(200, {
    machines: validMachines,
    pagination: {
      total: totalMachines,
      page,
      limit,
      totalPages: Math.ceil(totalMachines / limit),
    },
  }, 'Machines fetched successfully'));
});
// Fetch machine by ID
const getMachineById = asyncHandler(async (req, res, next) => {
  const machineId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(machineId)) {
    return next(new ApiError(400, `Provided Machine ID (${machineId}) is not a valid ObjectId`));
  }

  const machine = await Machine.findById(machineId).populate("plant_id", "plant_name").populate("created_by", "username email");

  if (!machine) {
    return next(new ApiError(404, "No machine found with the given ID"));
  }

  return res.status(200).json(new ApiResponse(200, machine, "Machine fetched successfully"));
});
const deleteMachine = asyncHandler(async (req, res, next) => {
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
  const result = await Machine.updateMany(
    { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted machines
    { $set: { isDeleted: true, updatedAt: Date.now() } } // Set isDeleted and update timestamp
  );

  // Check if any documents were updated
  if (result.matchedCount === 0) {
    return res.status(404).json(new ApiResponse(404, null, 'No non-deleted machines found with provided IDs'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount },
      `${result.modifiedCount} machine(s) marked as deleted successfully`
    )
  );
});

export { createMachine, updateMachine, getAllMachines, getMachineById, deleteMachine };
