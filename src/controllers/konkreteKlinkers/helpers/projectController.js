import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { Project } from '../../../models/konkreteKlinkers/helpers/project.model.js';
import { Client } from '../../../models/konkreteKlinkers/helpers/client.model.js';
import Joi from 'joi';

// Create a new project
const createProject = asyncHandler(async (req, res, next) => {
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
    const existingClient = await Client.findById(client);
    if (!existingClient) {
        return next(new ApiError(404, 'No client found with the given ID'));
    }

    // Assign logged-in user's ObjectId as `created_by`
    const created_by = req.user._id;

    const project = await Project.create({ name, client, address, created_by });

    return res.status(201).json(new ApiResponse(201, project, 'Project created successfully'));
});

// Update a project
const updateProject = asyncHandler(async (req, res, next) => {
    const projectSchema = Joi.object({
        name: Joi.string().optional().messages({ 'string.empty': 'Project Name cannot be empty' }),
        client: Joi.string().optional().messages({ 'string.empty': 'Client ID cannot be empty' }),
        address: Joi.string().optional().messages({ 'string.empty': 'address cannot be empty' }),

    });

    const { error, value } = projectSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return next(new ApiError(400, 'Validation failed for project update', error.details));
    }

    const projectId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return next(new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`));
    }

    if (value.client && !mongoose.Types.ObjectId.isValid(value.client)) {
        return next(new ApiError(400, `Provided Client ID (${value.client}) is not a valid ObjectId`));
    }

    const updateData = {};
    if (value.name) updateData.name = value.name;
    if (value.client) updateData.client = value.client;
    if (value.address) updateData.address = value.address;

    const project = await Project.findByIdAndUpdate(projectId, updateData, { new: true });

    if (!project) {
        return next(new ApiError(404, 'No project found with the given ID'));
    }

    return res.status(200).json(new ApiResponse(200, project, 'Project updated successfully'));
});

// Fetch all projects
const getAllProjects = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Count total projects that meet the criteria
    const totalProjects = await Project.countDocuments({ isDeleted: false });
    const projects = await Project.find({ isDeleted: false })
        .populate({
            path: 'client',
            select: 'name address',
            match: { isDeleted: false }, // Only include non-deleted clients
        })
        .populate('created_by', 'username email')
        .skip(skip)
        // .limit(limit)
        .sort({ createdAt: -1 });;

    // Filter out projects where client is null (i.e., client was deleted)
    const validProjects = projects.filter((project) => project.client !== null);

    if (!validProjects || validProjects.length === 0) {
        return next(new ApiError(404, 'No active projects with non-deleted clients available'));
    }

    return res.status(200).json(new ApiResponse(200,{
        projects: validProjects,
        pagination: {
            total: totalProjects,
            page,
            limit,
            totalPages: Math.ceil(totalProjects / limit),
        },
    }, 'Projects fetched successfully'));
});

// Fetch project by ID
const getProjectById = asyncHandler(async (req, res, next) => {
    const projectId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return next(new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`));
    }

    const project = await Project.findById(projectId)
        .populate('client', 'name address') // Fetch Client details
        .populate('created_by', 'username email'); // Fetch User details who created the project

    if (!project) {
        return next(new ApiError(404, 'No project found with the given ID'));
    }

    return res.status(200).json(new ApiResponse(200, project, 'Project fetched successfully'));
});

const deleteProject = asyncHandler(async (req, res, next) => {
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
    const result = await Project.updateMany(
        { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted projects
        { $set: { isDeleted: true, updatedAt: Date.now() } } // Set isDeleted and update timestamp
    );

    // Check if any documents were updated
    if (result.matchedCount === 0) {
        return res.status(404).json(new ApiResponse(404, null, 'No non-deleted projects found with provided IDs'));
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            `${result.modifiedCount} project(s) marked as deleted successfully`
        )
    );
});

export { createProject, updateProject, getAllProjects, getProjectById, deleteProject };
