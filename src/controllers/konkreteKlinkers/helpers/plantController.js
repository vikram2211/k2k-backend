import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { Plant } from "../../../models/konkreteKlinkers/helpers/plant.model.js";
import Joi from "joi";

// Create a new plant
const createPlant = asyncHandler(async (req, res, next) => {
  console.log("Plant creation request:", req.body);

  // Joi validation schema
  const plantSchema = Joi.object({
    plant_code: Joi.string().required().messages({ "string.empty": "Plant code is required" }),
    plant_name: Joi.string().required().messages({ "string.empty": "Plant name is required" }),
  });

  const { error, value } = plantSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ApiError(400, "Validation failed for plant creation", error.details));
  }

  const { plant_code, plant_name } = value;

  // Ensure `created_by` is taken from the logged-in user
  const created_by = req.user._id;

  const plant = await Plant.create({ plant_code, plant_name, created_by });

  return res.status(201).json(new ApiResponse(201, plant, "Plant created successfully"));
});

// Update a plant
const updatePlant = asyncHandler(async (req, res, next) => {
  const plantSchema = Joi.object({
    plant_code: Joi.string().optional(),
    plant_name: Joi.string().optional(),
  });

  const { error, value } = plantSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ApiError(400, "Validation failed for plant update", error.details));
  }

  const plantId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(plantId)) {
    return next(new ApiError(400, `Provided Plant ID (${plantId}) is not a valid ObjectId`));
  }

  const updateData = {};
  if (value.plant_code) updateData.plant_code = value.plant_code;
  if (value.plant_name) updateData.plant_name = value.plant_name;

  const plant = await Plant.findByIdAndUpdate(plantId, updateData, { new: true });

  if (!plant) {
    return next(new ApiError(404, "No plant found with the given ID"));
  }

  return res.status(200).json(new ApiResponse(200, plant, "Plant updated successfully"));
});

// Fetch all plants
// const getAllPlants = asyncHandler(async (req, res, next) => {
//   const plants = await Plant.find({ isDeleted: false }).populate('created_by', 'username email');

//   if (!plants || plants.length === 0) {
//     return next(new ApiError(404, 'No active plants available'));
//   }

//   return res.status(200).json(new ApiResponse(200, plants, 'Plants fetched successfully'));
// });


const getAllPlants = asyncHandler(async (req, res, next) => {
  // Extract page and limit from query params (defaults to page 1, 10 items per page)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  // Count total active plants
  const totalPlants = await Plant.countDocuments({ isDeleted: false });

  // Fetch paginated plants
  const plants = await Plant.find({ isDeleted: false })
    .populate('created_by', 'username email')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 }); // Optional: sort newest first

  if (!plants || plants.length === 0) {
    return next(new ApiError(404, 'No active plants available'));
  }

  // Respond with paginated data and metadata
  return res.status(200).json(
    new ApiResponse(200, {
      plants,
      pagination: {
        total: totalPlants,
        page,
        limit,
        totalPages: Math.ceil(totalPlants / limit),
      },
    }, 'Plants fetched successfully')
  );
});


// Fetch plant by ID
const getPlantById = asyncHandler(async (req, res, next) => {
  const plantId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(plantId)) {
    return next(new ApiError(400, `Provided Plant ID (${plantId}) is not a valid ObjectId`));
  }

  const plant = await Plant.findById(plantId).populate("created_by", "username email");

  if (!plant) {
    return next(new ApiError(404, "No plant found with the given ID"));
  }

  return res.status(200).json(new ApiResponse(200, plant, "Plant fetched successfully"));
});

const deletePlant = asyncHandler(async (req, res, next) => {
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
  const result = await Plant.updateMany(
    { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted plants
    { $set: { isDeleted: true, updatedAt: Date.now() } } // Set isDeleted and update timestamp
  );

  // Check if any documents were updated
  if (result.matchedCount === 0) {
    return res.status(404).json(new ApiResponse(404, null, 'No non-deleted plants found with provided IDs'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount },
      `${result.modifiedCount} plant(s) marked as deleted successfully`
    )
  );
});

export { createPlant, updatePlant, getAllPlants, getPlantById, deletePlant };
