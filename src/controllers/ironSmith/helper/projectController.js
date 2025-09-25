import mongoose from 'mongoose';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { ironProject } from '../../../models/ironSmith/helpers/ironProject.model.js';
import { ironClient } from '../../../models/ironSmith/helpers/ironClient.model.js';
import Joi from 'joi';
import { formatDateToIST } from '../../../utils/formatDate.js';
import { RawMaterial } from '../../../models/ironSmith/helpers/client-project-qty.model.js';
import { Diameter } from '../../../models/ironSmith/helpers/projectDia.model.js';



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


const addRawMaterial_18_09_2025 = asyncHandler(async (req, res) => {
    const { id, diameter, qty,convertedQty,date } = req.body;
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
        convertedQty: Joi.number().required().positive().messages({ 'number.base': 'Converted Quantity must be a number' }),
        date: Joi.date().required().messages({ 'date.base': 'Date is required' }),
    });

    // Validate request body
    const { error, value } = rawMaterialSchema.validate({ id, diameter, qty,convertedQty,date }, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for raw material data', error.details);
    }

    // Validate project exists and is not deleted
    const projectExists = await ironProject.findOne({ _id: id, isDeleted: false });
    if (!projectExists) {
        throw new ApiError(404, 'No non-deleted project found with the provided ID');
    }

    // Optional: Verify convertedQty matches qty * 1000
  if (value.convertedQty !== value.qty * 1000) {
    throw new ApiError(400, 'Converted Quantity must be Quantity (tons) * 1000');
  }

    // Create raw material entry
    const rawMaterial = await RawMaterial.create({
        project: id,
        diameter: value.diameter,
        qty: value.qty,
        convertedQty: value.convertedQty,
        date: value.date,
    });

    return sendResponse(res, new ApiResponse(201, rawMaterial, 'Raw material data added successfully'));
});


const addRawMaterial_19_09_2025 = asyncHandler(async (req, res) => {
    const { id, diameter, type, qty, convertedQty, date } = req.body;

    const schema = Joi.object({
        id: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
        diameter: Joi.number().required().positive(),
        type: Joi.string().required(), // Added type validation
        qty: Joi.number().required().positive(),
        convertedQty: Joi.number().required().positive(),
        date: Joi.date().required(),
    });

    const { error } = schema.validate({ id, diameter, type, qty, convertedQty, date });
    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    const rawMaterial = await RawMaterial.create({
        project: id,
        diameter,
        type,
        qty,
        convertedQty,
        date,
    });
    return res.status(201).json(new ApiResponse(201, rawMaterial, 'Raw material added successfully'));
});

const addRawMaterial_23_09_2025_WORKING = asyncHandler(async (req, res) => {
    const { id, diameter, type, qty, convertedQty, date } = req.body;
  
    const schema = Joi.object({
      id: Joi.string().required().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }),
      diameter: Joi.number().required().positive(),
      type: Joi.string().required(),
      qty: Joi.number().required().positive(),
      convertedQty: Joi.number().required().positive(),
      date: Joi.date().required(),
    });
  
    const { error } = schema.validate({ id, diameter, type, qty, convertedQty, date });
    if (error) {
      throw new ApiError(400, error.details[0].message);
    }
  
    // Find the corresponding Diameter record
    const diameterRecord = await Diameter.findOne({
      project: id,
      value: diameter,
      type,
      isDeleted: false,
    });
  
    if (!diameterRecord) {
      throw new ApiError(404, `Diameter ${diameter} mm with type ${type} not found for this project`);
    }
  
    // Create the RawMaterial
    const rawMaterial = await RawMaterial.create({
      project: id,
      diameter,
      type,
      qty,
      convertedQty,
      date,
    });
  
    // Update the Diameter's added array
    await Diameter.updateOne(
      { _id: diameterRecord._id },
      {
        $push: {
          added: { quantity: qty },
        },
      }
    );
  
    return res.status(201).json(new ApiResponse(201, rawMaterial, 'Raw material added successfully'));
  });


  const addRawMaterial = asyncHandler(async (req, res) => {
    const { id, diameter, type, qty, convertedQty, date } = req.body;
  
    const schema = Joi.object({
      id: Joi.string().required().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }),
      diameter: Joi.number().required().positive(),
      type: Joi.string().required(),
      qty: Joi.number().required().positive(),
      convertedQty: Joi.number().required().positive(),
      date: Joi.date().required(),
    });
  
    const { error } = schema.validate({ id, diameter, type, qty, convertedQty, date });
    if (error) {
      throw new ApiError(400, error.details[0].message);
    }
  
    // Find the corresponding Diameter record (no type)
    const diameterRecord = await Diameter.findOne({
      project: id,
      value: diameter,
      isDeleted: false,
    });
  
    if (!diameterRecord) {
      throw new ApiError(404, `Diameter ${diameter} mm not found for this project`);
    }
  
    // Create the RawMaterial
    const rawMaterial = await RawMaterial.create({
      project: id,
      diameter,
      type,
      qty,
      convertedQty,
      date,
    });
  
    // Update the Diameter's added array
    await Diameter.updateOne(
      { _id: diameterRecord._id },
      {
        $push: {
          added: { quantity: qty },
        },
      }
    );
  
    return res.status(201).json(new ApiResponse(201, rawMaterial, 'Raw material added successfully'));
  });

// Update raw material data
const updateRawMaterial_22_09_2025 = asyncHandler(async (req, res) => {
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

const updateRawMaterial_23_09_2025 = asyncHandler(async (req, res) => {
    const { id } = req.params; // RawMaterial ID
    const { qty, type } = req.body;

    // Validation schema
    const rawMaterialSchema = Joi.object({
        qty: Joi.number().required().positive().messages({
            'number.base': 'Quantity must be a number',
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required',
        }),
        type: Joi.string().optional(), // Type is optional unless you allow changing it
    });

    // Validate request body
    const { error, value } = rawMaterialSchema.validate({ qty, type }, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for raw material update', error.details);
    }

    // Validate rawMaterialId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Provided Raw Material ID (${id}) is not a valid ObjectId`);
    }

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the existing RawMaterial
        const rawMaterial = await RawMaterial.findOne({ _id: id, isDeleted: false }, null, { session });
        if (!rawMaterial) {
            throw new ApiError(404, 'No non-deleted raw material found with the given ID');
        }

        // Find the corresponding Diameter record
        const diameterRecord = await Diameter.findOne(
            {
                project: rawMaterial.project,
                value: rawMaterial.diameter,
                type: value.type || rawMaterial.type, // Use provided type or existing type
                isDeleted: false,
            },
            null,
            { session }
        );
        if (!diameterRecord) {
            throw new ApiError(404, `Diameter ${rawMaterial.diameter} mm with type ${value.type || rawMaterial.type} not found for this project`);
        }

        // Calculate convertedQty
        const convertedQty = value.qty * 1000;

        // Update RawMaterial
        const updatedRawMaterial = await RawMaterial.findOneAndUpdate(
            { _id: id, isDeleted: false },
            { qty: value.qty, convertedQty, type: value.type || rawMaterial.type },
            { new: true, session }
        );

        // Update Diameter's added array
        // Strategy: Remove the previous added entry (if it exists) and push a new one
        const previousAddedEntry = diameterRecord.added.find(
            (entry) => entry.timestamp.toISOString() === rawMaterial.createdAt.toISOString()
        );
        if (previousAddedEntry) {
            await Diameter.updateOne(
                { _id: diameterRecord._id },
                { $pull: { added: { timestamp: rawMaterial.createdAt } } },
                { session }
            );
        }

        await Diameter.updateOne(
            { _id: diameterRecord._id },
            { $push: { added: { quantity: value.qty, timestamp: new Date() } } },
            { session }
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(new ApiResponse(200, updatedRawMaterial, 'Raw material and diameter data updated successfully'));
    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        session.endSession();
        throw error instanceof ApiError ? error : new ApiError(500, 'Failed to update raw material and diameter data');
    }
});






const updateRawMaterial_23_09_2025_WORKING = asyncHandler(async (req, res) => {
    const { id } = req.params; // RawMaterial ID
    const { qty, type, date } = req.body;

    // Validation schema
    const rawMaterialSchema = Joi.object({
        qty: Joi.number().required().positive().messages({
            'number.base': 'Quantity must be a number',
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required',
        }),
        type: Joi.string().optional(),
        date: Joi.date().required().messages({
            'date.base': 'Date must be a valid date',
            'any.required': 'Date is required',
        }),
    });

    // Validate request body
    const { error, value } = rawMaterialSchema.validate({ qty, type, date }, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for raw material update', error.details);
    }

    // Validate rawMaterialId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Provided Raw Material ID (${id}) is not a valid ObjectId`);
    }

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the existing RawMaterial
        const rawMaterial = await RawMaterial.findOne({ _id: id, isDeleted: false }, null, { session });
        if (!rawMaterial) {
            throw new ApiError(404, 'No non-deleted raw material found with the given ID');
        }

        // Find the corresponding Diameter record
        const diameterRecord = await Diameter.findOne(
            {
                project: rawMaterial.project,
                value: rawMaterial.diameter,
                type: value.type || rawMaterial.type,
                isDeleted: false,
            },
            null,
            { session }
        );
        if (!diameterRecord) {
            throw new ApiError(404, `Diameter ${rawMaterial.diameter} mm with type ${value.type || rawMaterial.type} not found for this project`);
        }

        // Calculate convertedQty
        const convertedQty = value.qty * 1000;

        // Update RawMaterial
        const updatedRawMaterial = await RawMaterial.findOneAndUpdate(
            { _id: id, isDeleted: false },
            {
                qty: value.qty,
                convertedQty,
                type: value.type || rawMaterial.type,
                date: value.date,
            },
            { new: true, session }
        );

        // Update Diameter's added array
        // Strategy: Remove the previous added entry (if it exists) and push a new one
        const previousAddedEntry = diameterRecord.added.find(
            (entry) => entry.timestamp.toISOString() === rawMaterial.createdAt.toISOString()
        );
        if (previousAddedEntry) {
            await Diameter.updateOne(
                { _id: diameterRecord._id },
                { $pull: { added: { timestamp: rawMaterial.createdAt } } },
                { session }
            );
        }

        await Diameter.updateOne(
            { _id: diameterRecord._id },
            { $push: { added: { quantity: value.qty, timestamp: new Date() } } },
            { session }
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(new ApiResponse(200, updatedRawMaterial, 'Raw material and diameter data updated successfully'));
    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        session.endSession();
        throw error instanceof ApiError ? error : new ApiError(500, 'Failed to update raw material and diameter data');
    }
});









const updateRawMaterial = asyncHandler(async (req, res) => {
    const { id } = req.params; // RawMaterial ID
    const { qty, type, date } = req.body;

    // Validation schema
    const rawMaterialSchema = Joi.object({
        qty: Joi.number().required().positive().messages({
            'number.base': 'Quantity must be a number',
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required',
        }),
        type: Joi.string().required().messages({ // Made required since editable
            'any.required': 'Type is required',
        }),
        date: Joi.date().required().messages({
            'date.base': 'Date must be a valid date',
            'any.required': 'Date is required',
        }),
    });

    // Validate request body
    const { error, value } = rawMaterialSchema.validate({ qty, type, date }, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for raw material update', error.details);
    }

    // Validate rawMaterialId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Provided Raw Material ID (${id}) is not a valid ObjectId`);
    }

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the existing RawMaterial
        const rawMaterial = await RawMaterial.findOne({ _id: id, isDeleted: false }, null, { session });
        if (!rawMaterial) {
            throw new ApiError(404, 'No non-deleted raw material found with the given ID');
        }

        // Find the corresponding Diameter record (no type)
        const diameterRecord = await Diameter.findOne(
            {
                project: rawMaterial.project,
                value: rawMaterial.diameter,
                isDeleted: false,
            },
            null,
            { session }
        );
        if (!diameterRecord) {
            throw new ApiError(404, `Diameter ${rawMaterial.diameter} mm not found for this project`);
        }

        // Calculate convertedQty
        const convertedQty = value.qty * 1000;

        // Update RawMaterial
        const updatedRawMaterial = await RawMaterial.findOneAndUpdate(
            { _id: id, isDeleted: false },
            {
                qty: value.qty,
                convertedQty,
                type: value.type,
                date: value.date,
            },
            { new: true, session }
        );

        // Update Diameter's added array
        // Strategy: Remove the previous added entry (if it exists) and push a new one
        const previousAddedEntry = diameterRecord.added.find(
            (entry) => entry.timestamp.toISOString() === rawMaterial.createdAt.toISOString()
        );
        if (previousAddedEntry) {
            await Diameter.updateOne(
                { _id: diameterRecord._id },
                { $pull: { added: { timestamp: rawMaterial.createdAt } } },
                { session }
            );
        }

        await Diameter.updateOne(
            { _id: diameterRecord._id },
            { $push: { added: { quantity: value.qty, timestamp: new Date() } } },
            { session }
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(new ApiResponse(200, updatedRawMaterial, 'Raw material and diameter data updated successfully'));
    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        session.endSession();
        throw error instanceof ApiError ? error : new ApiError(500, 'Failed to update raw material and diameter data');
    }
});









// Delete raw material data
const deleteRawMaterial_22_09_2025 = asyncHandler(async (req, res) => {
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



const deleteRawMaterial = asyncHandler(async (req, res) => {
    const  rawMaterialId  = req.params.id;
    console.log("rawMaterialId",rawMaterialId);

    // Validation schema
    const schema = Joi.object({
        rawMaterialId: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
    });

    const { error } = schema.validate({ rawMaterialId });
    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the RawMaterial record
        const rawMaterial = await RawMaterial.findOne(
            { _id: rawMaterialId, isDeleted: false },
            null,
            { session }
        );
        if (!rawMaterial) {
            throw new ApiError(404, 'Raw material not found or already deleted');
        }

        // Find the corresponding Diameter record
        const diameterRecord = await Diameter.findOne(
            {
                project: rawMaterial.project,
                value: rawMaterial.diameter,
                type: rawMaterial.type,
                isDeleted: false,
            },
            null,
            { session }
        );
        if (!diameterRecord) {
            throw new ApiError(404, `Diameter ${rawMaterial.diameter} mm with type ${rawMaterial.type} not found for this project`);
        }

        // Update RawMaterial: set qty and convertedQty to 0, mark as deleted
        rawMaterial.qty = 0;
        rawMaterial.convertedQty = 0;
        rawMaterial.isDeleted = true;
        await rawMaterial.save({ session });

        // Remove the corresponding entry from Diameter's added array
        await Diameter.updateOne(
            { _id: diameterRecord._id },
            { $pull: { added: { timestamp: rawMaterial.createdAt } } },
            { session }
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(new ApiResponse(200, null, 'Raw material marked as deleted successfully'));
    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        session.endSession();
        throw error instanceof ApiError ? error : new ApiError(500, 'Failed to delete raw material');
    }
});

const getRawMaterialsByProjectId = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`);
    }

    const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
        .lean();
        console.log("rawMaterials",rawMaterials);

    if (!rawMaterials || rawMaterials.length === 0) {
        throw new ApiError(404, 'No raw material data found for the given project ID');
    }

    return sendResponse(res, new ApiResponse(200, rawMaterials, 'Raw material data fetched successfully'));
});

const getRawMaterialConsumption_18_09_2025 = asyncHandler(async (req, res) => {
    const { _id, dia, projectId } = req.query;

    // Validate query parameters
    const hasId = _id !== undefined && mongoose.Types.ObjectId.isValid(_id);
    const hasDia = dia !== undefined && !isNaN(parseFloat(dia));
    const hasProjectId = projectId !== undefined && mongoose.Types.ObjectId.isValid(projectId);

    // Ensure at least one parameter is provided
    if (!hasId && !hasDia && !hasProjectId) {
        throw new ApiError(400, 'At least one of _id, dia, or projectId is required');
    }

    // Build query with all provided parameters
    let query = { isDeleted: false };
    if (hasId) query._id = new mongoose.Types.ObjectId(_id);
    if (hasDia) query.diameter = parseFloat(dia);
    if (hasProjectId) query.project = new mongoose.Types.ObjectId(projectId);

    // Fetch raw material with populated consumption history
    const rawMaterial = await RawMaterial.findOne(query)
        .populate({
            path: 'consumptionHistory.workOrderId',
            select: 'workOrderNumber',
            // match: { isDeleted: false },
        })
        .lean();

    if (!rawMaterial) {
        throw new ApiError(404, 'Raw material not found');
    }

    // Additional validation to ensure consistency if multiple parameters are provided
    if (hasId && (hasDia || hasProjectId)) {
        const expectedDia = hasDia ? parseFloat(dia) : rawMaterial.diameter;
        const expectedProjectId = hasProjectId ? new mongoose.Types.ObjectId(projectId) : rawMaterial.project;
        if (rawMaterial.diameter !== expectedDia || !rawMaterial.project.equals(expectedProjectId)) {
            throw new ApiError(404, 'Raw material does not match the provided dia or projectId');
        }
    }

    // Format response
    const response = {
        _id: rawMaterial._id,
        diameter: rawMaterial.diameter,
        project: rawMaterial.project,
        qty: rawMaterial.qty,
        consumptionHistory: rawMaterial.consumptionHistory
            .filter(ch => ch.workOrderId) // Filter out entries where workOrderId population failed
            .map(ch => ({
                workOrderId: ch.workOrderId._id,
                workOrderNumber: ch.workOrderId.workOrderNumber,
                quantity: ch.quantity,
                timestamp: ch.timestamp,
            })),
    };

    return res.status(200).json(new ApiResponse(200, response, 'Raw material consumption details retrieved successfully'));
});


// backend/controllers/rawMaterialController.js
const getRawMaterialConsumption_18_09_2025_5_30_PM = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    console.log("projectId",projectId);

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Invalid project ID: ${projectId}`);
    }

    const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
        .populate({
            path: 'consumptionHistory.workOrderId',
            select: 'workOrderNumber',
            // match: { isDeleted: false },
        })
        .lean();
        console.log("rawMaterials",rawMaterials);

    if (!rawMaterials.length) {
        throw new ApiError(404, 'No raw material data found for the given project ID');
    }

    const response = rawMaterials.map((rm) => ({
        _id: rm._id,
        project: rm.project,
        diameter: rm.diameter,
        type: rm.type,
        qty: rm.qty,
        convertedQty: rm.convertedQty,
        date: rm.date,
        createdAt: rm.createdAt,
        updatedAt: rm.updatedAt,
        consumptionHistory: rm.consumptionHistory
            .filter((ch) => ch.workOrderId) // Filter out failed populations
            .map((ch) => ({
                workOrderId: ch.workOrderId._id,
                workOrderNumber: ch.workOrderId.workOrderNumber,
                quantity: ch.quantity,
                timestamp: ch.timestamp,
            })),
    }));

    return sendResponse(res, new ApiResponse(200, response, 'Raw materials fetched successfully'));
});





const getRawMaterialConsumption_19_09_2025_12_PM = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    console.log("projectId", projectId);

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Invalid project ID: ${projectId}`);
    }

    const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
        .populate({
            path: 'consumptionHistory.workOrderId',
            select: 'workOrderNumber', // Ensure workOrderNumber is selected
            // match: { isDeleted: false }, // Optional: Filter out deleted work orders
        })
        .lean();
    console.log("rawMaterials", rawMaterials);

    if (!rawMaterials.length) {
        throw new ApiError(404, 'No raw material data found for the given project ID');
    }
    rawMaterials.map((rm) => (
        rm.consumptionHistory.map((ch) => (console.log("ch",ch)))))

    const response = rawMaterials.map((rm) => ({
        _id: rm._id,
        project: rm.project,
        diameter: rm.diameter,
        type: rm.type,
        qty: rm.qty,
        convertedQty: rm.convertedQty,
        date: rm.date,
        createdAt: rm.createdAt,
        updatedAt: rm.updatedAt,
        consumptionHistory: rm.consumptionHistory.map((ch) => ({
            workOrderId: ch.workOrderId ? ch.workOrderId._id : null,
            workOrderNumber: ch.workOrderId ? ch.workOrderId.workOrderNumber : 'N/A', // Handle missing population
            quantity: ch.quantity || 0,
            timestamp: ch.timestamp || null,
        })),
    }));

    return sendResponse(res, new ApiResponse(200, response, 'Raw materials fetched successfully'));
});






const getRawMaterialConsumption = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    console.log("projectId", projectId);

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Invalid project ID: ${projectId}`);
    }

    // Fetch RawMaterial data
    const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
        .populate({
            path: 'consumptionHistory.workOrderId',
            select: 'workOrderNumber',
        })
        .lean();

    console.log("rawMaterials", rawMaterials);

    if (!rawMaterials.length) {
        throw new ApiError(404, 'No raw material data found for the given project ID');
    }

    // Fetch Diameter data and aggregate added/subtracted quantities
    const diameters = await Diameter.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId), isDeleted: false } },
        { $unwind: "$added" }, // Unwind the added array
        { $unwind: "$subtracted" }, // Unwind the subtracted array
        {
            $group: {
                _id: { diameter: "$value", type: "$type" },
                totalAdded: { $sum: "$added.quantity" }, // Sum all quantities in added array
                totalSubtracted: { $sum: "$subtracted.quantity" }, // Sum all quantities in subtracted array
            },
        },
    ]);
    console.log("diameters", diameters);

    // Map rawMaterials with diameter-derived totals
    const response = rawMaterials.map((rm) => {
        const diameterData = diameters.find(
            (d) => d._id.diameter === rm.diameter && d._id.type === rm.type
        ) || { totalAdded: 0, totalSubtracted: 0 };

        return {
            _id: rm._id,
            project: rm.project,
            diameter: rm.diameter,
            type: rm.type,
            qty: rm.qty, // Retain RawMaterial qty for reference, or replace with totalAdded if Diameter is authoritative
            convertedQty: rm.convertedQty,
            date: rm.date,
            createdAt: rm.createdAt,
            updatedAt: rm.updatedAt,
            consumptionHistory: rm.consumptionHistory.map((ch) => ({
                workOrderId: ch.workOrderId ? ch.workOrderId._id : null,
                workOrderNumber: ch.workOrderId ? ch.workOrderId.workOrderNumber : 'N/A',
                quantity: ch.quantity || 0,
                timestamp: ch.timestamp || null,
            })),
            // Add diameter-derived totals
            totalAdded: diameterData.totalAdded || 0,
            totalSubtracted: diameterData.totalSubtracted || 0,
        };
    });

    return sendResponse(res, new ApiResponse(200, response, 'Raw materials fetched successfully'));
});





const getRawMaterialConsumption_correct_response  = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    console.log("projectId", projectId);

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new ApiError(400, `Invalid project ID: ${projectId}`);
    }

    // Fetch RawMaterial data
    const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
        .populate({
            path: 'consumptionHistory.workOrderId',
            select: 'workOrderNumber',
        })
        .lean();

    console.log("rawMaterials", rawMaterials);

    if (!rawMaterials.length) {
        throw new ApiError(404, 'No raw material data found for the given project ID');
    }

    // Fetch Diameter data and aggregate added/subtracted quantities
    // const diameters = await Diameter.aggregate([
    //     { $match: { project: new mongoose.Types.ObjectId(projectId), isDeleted: false } },
    //     { $unwind: "$added" }, // Unwind the added array
    //     { $unwind: "$subtracted" }, // Unwind the subtracted array
    //     {
    //         $group: {
    //             _id: { diameter: "$value", type: "$type" },
    //             totalAdded: { $sum: "$added.quantity" }, // Sum all quantities in added array
    //             totalSubtracted: { $sum: "$subtracted.quantity" }, // Sum all quantities in subtracted array
    //         },
    //     },
    // ]);


    const diameters = await Diameter.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId), isDeleted: false } },
      
        // Calculate total added and subtracted per document
        {
          $addFields: {
            totalAdded: { $sum: "$added.quantity" },
            totalSubtracted: { $sum: "$subtracted.quantity" },
          },
        },
      
        // Group by diameter and type
        {
          $group: {
            _id: { diameter: "$value", type: "$type" },
            totalAdded: { $sum: "$totalAdded" },
            totalSubtracted: { $sum: "$totalSubtracted" },
          },
        },
      ]);


    console.log("diameters", diameters);

    // Prepare response with RawMaterials and a separate totals object
    const response = {
        rawMaterials: rawMaterials.map((rm) => ({
            _id: rm._id,
            project: rm.project,
            diameter: rm.diameter,
            type: rm.type,
            qty: rm.qty,
            convertedQty: rm.convertedQty,
            date: rm.date,
            createdAt: rm.createdAt,
            updatedAt: rm.updatedAt,
            consumptionHistory: rm.consumptionHistory.map((ch) => ({
                workOrderId: ch.workOrderId ? ch.workOrderId._id : null,
                workOrderNumber: ch.workOrderId ? ch.workOrderId.workOrderNumber : 'N/A',
                quantity: ch.quantity || 0,
                timestamp: ch.timestamp || null,
            })),
        })),
        totals: diameters.reduce((acc, d) => {
            acc[`${d._id.diameter}_${d._id.type}`] = {
                diameter: d._id.diameter,
                type: d._id.type,
                totalAdded: d.totalAdded || 0,
                totalSubtracted: d.totalSubtracted || 0,
            };
            return acc;
        }, {}),
    };

    return sendResponse(res, new ApiResponse(200, response, 'Raw materials fetched successfully'));
});






const addDiameter_18_09_2025 = asyncHandler(async (req, res) => {
    const { projectId, value } = req.body;
  
    const schema = Joi.object({
      projectId: Joi.string().required().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }),
      value: Joi.number().required().positive(),
    });
  
    const { error } = schema.validate({ projectId, value });
    if (error) {
      throw new ApiError(400, error.details[0].message);
    }
  
    // const existingDiameter = await Diameter.findOne({ project: projectId, value });
    // if (existingDiameter) {
    //   throw new ApiError(400, 'Diameter already exists for this project');
    // }
  
    const diameter = await Diameter.create({ project: projectId, value });
    return res.status(201).json(new ApiResponse(201, diameter, 'Diameter added successfully'));
  });


  const addDiameter_23_09_2025_WORKING = asyncHandler(async (req, res) => {
    const { projectId, value, type } = req.body;

    const schema = Joi.object({
        projectId: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
        value: Joi.number().required().positive(),
        type: Joi.string().required(), // New validation for Type
    });

    const { error } = schema.validate({ projectId, value, type });
    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    // const existingDiameter = await Diameter.findOne({ project: projectId, value });
    // if (existingDiameter) {
    //   throw new ApiError(400, 'Diameter already exists for this project');
    // }

    const diameter = await Diameter.create({ project: projectId, value, type });
    return res.status(201).json(new ApiResponse(201, diameter, 'Diameter added successfully'));
});




const addDiameter = asyncHandler(async (req, res) => {
    const { projectId, value } = req.body;

    const schema = Joi.object({
        projectId: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
        value: Joi.number().required().positive(),
    });

    const { error } = schema.validate({ projectId, value });
    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    const existingDiameter = await Diameter.findOne({ project: projectId, value });
    if (existingDiameter) {
      throw new ApiError(400, 'Diameter already exists for this project');
    }

    const diameter = await Diameter.create({ project: projectId, value });
    return res.status(201).json(new ApiResponse(201, diameter, 'Diameter added successfully'));
});


const deleteDiameter_22_09_2025 = asyncHandler(async (req, res) => {
    const { projectId, value } = req.body;

    const schema = Joi.object({
        projectId: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
        value: Joi.number().required().positive(),
    });

    const { error } = schema.validate({ projectId, value });
    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    const existingDiameter = await Diameter.findOne({ project: projectId, value, isDeleted: false });
    if (!existingDiameter) {
        throw new ApiError(404, 'Diameter not found for this project');
    }

    existingDiameter.isDeleted = true;
    await existingDiameter.save();

    return res.status(200).json(new ApiResponse(200, null, 'Diameter marked as deleted successfully'));
});

const deleteDiameter = asyncHandler(async (req, res) => {
    const { projectId, value, type } = req.body;

    // Validate input
    const schema = Joi.object({
        projectId: Joi.string().required().custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
        value: Joi.number().required().positive(),
        type: Joi.string().required(), // Add type to validation
    });

    const { error } = schema.validate({ projectId, value, type });
    if (error) {
        throw new ApiError(400, error.details[0].message);
    }

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the Diameter record
        const existingDiameter = await Diameter.findOne(
            { project: projectId, value, type, isDeleted: false },
            null,
            { session }
        );
        if (!existingDiameter) {
            throw new ApiError(404, `Diameter ${value} mm with type ${type} not found for this project`);
        }

        // Mark the Diameter as deleted
        existingDiameter.isDeleted = true;
        await existingDiameter.save({ session });

        // Mark related RawMaterial records as deleted
        await RawMaterial.updateMany(
            { project: projectId, diameter: value, type, isDeleted: false },
            { $set: { isDeleted: true } },
            { session }
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(new ApiResponse(200, null, 'Diameter and related raw materials marked as deleted successfully'));
    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        session.endSession();
        throw error instanceof ApiError ? error : new ApiError(500, 'Failed to delete diameter and related raw materials');
    }
});

  
  // Fetch diameters for a project
const getDiametersByProjectId = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    console.log("projectId",projectId);
  
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new ApiError(400, 'Invalid project ID');
    }
  
    const diameters = await Diameter.find({ project: projectId, isDeleted: false });
    return res.status(200).json(new ApiResponse(200, diameters, 'Diameters fetched successfully'));
  });

export { createIronProject, updateIronProject, getAllIronProjects, getIronProjectById, deleteIronProject, addRawMaterial, updateRawMaterial, deleteRawMaterial, getRawMaterialsByProjectId, getRawMaterialConsumption, addDiameter, getDiametersByProjectId,deleteDiameter};