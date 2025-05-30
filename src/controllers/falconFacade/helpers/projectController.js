import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { falconProject } from '../../../models/falconFacade/helpers/falconProject.model.js';
import { falconClient } from '../../../models/falconFacade/helpers/falconClient.model.js';
import { formatDateToIST } from "../../../utils/formatDate.js";
import Joi from 'joi';


const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

// Create a new project
const createFalconProject = asyncHandler(async (req, res, next) => {
    console.log("Project creation request:", req.body);

    if (!req.user || !req.user._id) {
        return next(new ApiError(401, "Unauthorized. User must be logged in."));
    }

    // Validation schema
    const projectSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Project Name is required' }),
        client: Joi.string().required().messages({ 'string.empty': 'Client ID is required' }),
        address: Joi.string().required().messages({ 'string.empty': 'Address is required' }),

    });

    const { error, value } = projectSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return next(new ApiError(400, 'Validation failed for project creation', error.details));
    }

    const { name, client, address } = value;

    if (!mongoose.Types.ObjectId.isValid(client)) {
        return next(new ApiError(400, `Provided Client ID (${client}) is not a valid ObjectId`));
    }

    // Check if client exists
    const existingClient = await falconClient.findById(client);
    if (!existingClient) {
        return next(new ApiError(404, 'No client found with the given ID'));
    }

    // Assign logged-in user's ObjectId as `created_by`
    const created_by = req.user._id;
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    const project = await falconProject.create({ name, client, address, created_by });

    return sendResponse(res, new ApiResponse(201, project, 'Project created successfully'));
});

// Update a project
const updateFalconProject = asyncHandler(async (req, res) => {
    // Validation schema
    const projectSchema = Joi.object({
        name: Joi.string().optional().allow('').messages({ 'string.empty': 'Project Name cannot be empty' }),
        address: Joi.string().optional().allow('').messages({ 'string.empty': 'Address cannot be empty' }),
        client: Joi.string()
            .optional()
            .custom((value, helpers) => {
                if (value && !mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
    });

    // Validate request body
    const { error, value } = projectSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for project update', error.details);
    }

    const { id: projectId } = req.params;

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`);
    }

    // Prepare update data
    const updateData = {};
    if (value.name) updateData.name = value.name;
    if (value.address) updateData.address = value.address;
    if (value.client) updateData.client = value.client;

    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No valid fields provided for update');
    }

    // Update project
    const project = await falconProject.findByIdAndUpdate(projectId, updateData, { new: true })
        .populate({
            path: 'client',
            select: 'name address',
            match: { isDeleted: false },
        })
        .populate('created_by', 'username email')
        .lean();

    if (!project) {
        throw new ApiError(404, 'No project found with the given ID');
    }

    // Convert timestamps to IST
    const formattedProject = formatDateToIST(project);

    // Send response
    return sendResponse(res, new ApiResponse(200, formattedProject, 'Project updated successfully'));
});

// Fetch all projects
const getAllFalconProjects = asyncHandler(async (req, res) => {
    const projects = await falconProject
        .find({ isDeleted: false })
        .populate({
            path: 'client', // Correct path matching schema field
            select: 'name address',
            match: { isDeleted: false }, // Only include non-deleted clients
        })
        .populate('created_by', 'username email')
        .lean();

    if (!projects || projects.length === 0) {
        throw new ApiError(404, 'No active projects available');
    }

    // Convert timestamps to IST
    const formattedProjects = formatDateToIST(projects);

    return sendResponse(res, new ApiResponse(200, formattedProjects, 'Projects fetched successfully'));
});

// Fetch project by ID
const getFalconProjectById = asyncHandler(async (req, res, next) => {
    const projectId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return next(new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`));
    }

    const project = await falconProject.findById(projectId)
        .populate('client', 'name address') // Fetch Client details
        .populate('created_by', 'username email')
        .lean(); // Fetch User details who created the project

    if (!project) {
        return next(new ApiError(404, 'No project found with the given ID'));
    }
    const formattedProject = formatDateToIST(project);

    return sendResponse(res, new ApiResponse(200, formattedProject, 'Project fetched successfully'));

});

const deleteFalconProject = asyncHandler(async (req, res, next) => {
    // Extract IDs from request body
    let ids = req.body.ids;
    // console.log('ids', ids);

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
    const result = await falconProject.updateMany(
        { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted projects
        {
            $set: {
                isDeleted: true,
                status: 'Inactive',
                updatedAt: Date.now()
            }
        } // Set isDeleted and update timestamp
    );

    // Check if any documents were updated
    if (result.matchedCount === 0) {
        return res.status(404).json(new ApiResponse(404, null, 'No non-deleted projects found with provided IDs'));
    }

    // Send response
    return sendResponse(
        res,
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          `${result.modifiedCount} project(s) marked as deleted successfully`
        )
      );
});

export { createFalconProject, updateFalconProject, getAllFalconProjects, getFalconProjectById, deleteFalconProject };
