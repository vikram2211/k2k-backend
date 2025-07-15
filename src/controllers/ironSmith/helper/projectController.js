import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { ironProject } from '../../../models/ironSmith/helpers/ironProject.model.js';
import { ironClient } from '../../../models/ironSmith/helpers/ironClient.model.js';
import Joi from 'joi';
import { formatDateToIST } from '../../../utils/formatDate.js';
import { RawMaterial } from '../../../models/ironSmith/helpers/client-project-qty.model.js';


// Helper function to send response
const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

// Create a project
const createIronProject = asyncHandler(async (req, res) => {
    console.log("Inside iron project creation API");
    console.log("Project creation request:", req.body);

    // Validation schema
    const projectSchema = Joi.object({
        name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
        client: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        address: Joi.string().required().messages({ 'string.empty': 'Address is required' }),
    });

    // Validate request body
    const { error, value } = projectSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for project creation', error.details);
    }

    // Extract validated fields
    const { name, client, address } = value;
    const created_by = req.user?._id;

    // Validate created_by
    if (!created_by || !mongoose.Types.ObjectId.isValid(created_by)) {
        throw new ApiError(400, 'Invalid or missing user ID in request');
    }

    // Validate client exists and is not deleted
    const clientExists = await ironClient.findOne({ _id: client, isDeleted: false });
    if (!clientExists) {
        throw new ApiError(404, 'No non-deleted client found with the provided ID');
    }

    // Create project with isDeleted set to false by default
    const project = await ironProject.create({ name, client, address, created_by, isDeleted: false });

    // Send response
    return sendResponse(res, new ApiResponse(201, project, 'Project created successfully'));
});

// Update a project
const updateIronProject = asyncHandler(async (req, res) => {
    // Validation schema
    const projectSchema = Joi.object({
        name: Joi.string().optional().allow('').messages({ 'string.empty': 'Name cannot be empty' }),
        client: Joi.string()
            .optional()
            .custom((value, helpers) => {
                if (value && !mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Client ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
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
    if (value.client) {
        // Validate client exists and is not deleted
        const clientExists = await ironClient.findOne({ _id: value.client, isDeleted: false });
        if (!clientExists) {
            throw new ApiError(404, 'No non-deleted client found with the provided ID');
        }
        updateData.client = value.client;
    }
    if (value.address) updateData.address = value.address;
    if (value.created_by) updateData.created_by = value.created_by;

    // Check if updateData is empty
    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No valid fields provided for update');
    }

    // Update project
    const project = await ironProject.findOneAndUpdate(
        { _id: projectId, isDeleted: false },
        updateData,
        { new: true }
    )
        .populate('created_by', 'username emailhofer')
        .populate('client', 'name address')
        .lean();

    if (!project) {
        throw new ApiError(404, 'No non-deleted project found with the given ID');
    }

    // Send response
    return sendResponse(res, new ApiResponse(200, project, 'Project updated successfully'));
});

// Fetch all projects
const getAllIronProjects = asyncHandler(async (req, res) => {
    const projects = await ironProject
        .find({ isDeleted: false })
        .populate('created_by', 'username email')
        .populate('client', 'name address')
        .lean();

    if (!projects || projects.length === 0) {
        throw new ApiError(404, 'No non-deleted projects available');
    }

    const formattedProjects = formatDateToIST(projects);

    return sendResponse(res, new ApiResponse(200, formattedProjects, 'Projects fetched successfully'));
});

// Fetch project by ID
const getIronProjectById = asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`);
    }

    const project = await ironProject
        .findOne({ _id: projectId, isDeleted: false })
        .populate('created_by', 'username email')
        .populate('client', 'name address')
        .lean();

    if (!project) {
        throw new ApiError(404, 'No non-deleted project found with the given ID');
    }

    const formattedProject = formatDateToIST(project);

    return sendResponse(res, new ApiResponse(200, formattedProject, 'Project fetched successfully'));
});

// Delete projects
const deleteIronProject = asyncHandler(async (req, res) => {
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
    const result = await ironProject.updateMany(
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
        throw new ApiError(404, 'No non-deleted projects found with provided IDs');
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


const addRawMaterial = asyncHandler(async (req, res) => {
    const { id, diameter, qty } = req.body;
    console.log(id, diameter, qty);
    console.log(typeof(id));
    console.log(typeof(diameter));
    console.log(typeof(qty));

    // Validation schema
    const rawMaterialSchema = Joi.object({
        id: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return helpers.error('any.invalid', { message: `Project ID (${value}) is not a valid ObjectId` });
                }
                return value;
            }, 'ObjectId validation'),
        diameter: Joi.number().required().positive().messages({ 'number.base': 'Diameter must be a number' }),
        qty: Joi.number().required().positive().messages({ 'number.base': 'Quantity must be a number' }),
    });

    // Validate request body
    const { error, value } = rawMaterialSchema.validate({ id, diameter, qty }, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for raw material data', error.details);
    }

    // Validate project exists and is not deleted
    const projectExists = await ironProject.findOne({ _id: id, isDeleted: false });
    if (!projectExists) {
        throw new ApiError(404, 'No non-deleted project found with the provided ID');
    }

    // Create raw material entry
    const rawMaterial = await RawMaterial.create({
        project: id,
        diameter: value.diameter,
        qty: value.qty,
    });

    return sendResponse(res, new ApiResponse(201, rawMaterial, 'Raw material data added successfully'));
});

// Update raw material data
const updateRawMaterial = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {  qty } = req.body; //diameter,

    // Validation schema
    const rawMaterialSchema = Joi.object({
        // diameter: Joi.number().optional().positive().messages({ 'number.base': 'Diameter must be a number' }),
        qty: Joi.number().optional().positive().messages({ 'number.base': 'Quantity must be a number' }),
    });

    // Validate request body
    const { error, value } = rawMaterialSchema.validate({ qty }, { abortEarly: false }); //diameter, 
    if (error) {
        throw new ApiError(400, 'Validation failed for raw material update', error.details);
    }

    if (Object.keys(value).length === 0) {
        throw new ApiError(400, 'No valid fields provided for update');
    }

    // Validate rawMaterialId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Provided Raw Material ID (${id}) is not a valid ObjectId`);
    }

    // Update raw material
    const rawMaterial = await RawMaterial.findOneAndUpdate(
        { _id: id, isDeleted: false },
        value,
        { new: true }
    );

    if (!rawMaterial) {
        throw new ApiError(404, 'No non-deleted raw material found with the given ID');
    }

    return sendResponse(res, new ApiResponse(200, rawMaterial, 'Raw material data updated successfully'));
});

// Delete raw material data
const deleteRawMaterial = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Provided Raw Material ID (${id}) is not a valid ObjectId`);
    }

    const result = await RawMaterial.updateOne(
        { _id: id, isDeleted: false },
        { $set: { isDeleted: true, updatedAt: Date.now() } }
    );

    if (result.matchedCount === 0) {
        throw new ApiError(404, 'No non-deleted raw material found with the provided ID');
    }

    return sendResponse(res, new ApiResponse(200, null, 'Raw material data marked as deleted successfully'));
});

const getRawMaterialsByProjectId = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`);
    }

    const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
        .lean();

    if (!rawMaterials || rawMaterials.length === 0) {
        throw new ApiError(404, 'No raw material data found for the given project ID');
    }

    return sendResponse(res, new ApiResponse(200, rawMaterials, 'Raw material data fetched successfully'));
});

export { createIronProject, updateIronProject, getAllIronProjects, getIronProjectById, deleteIronProject, addRawMaterial, updateRawMaterial, deleteRawMaterial, getRawMaterialsByProjectId};