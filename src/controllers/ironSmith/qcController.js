// '@/api/ironSmith/production.ts' or a new file like '@/api/ironSmith/qc.ts'
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ironQCCheck } from '../../models/ironSmith/qcCheck.model.js'; // Adjust the import path based on your project structure
import { ironDailyProduction } from '../../models/ironSmith/dailyProductionPlanning.js'; // Adjust the import path based on your project structure
import { ApiResponse } from "../../utils/ApiResponse.js";
import mongoose from 'mongoose';

const createQCCheck1 = asyncHandler(async (req, res) => {
    // Extract data from request body
    const { work_order, job_order, shape_id, object_id, rejected_quantity, recycled_quantity, remarks } = req.body;

    // Validate required fields
    if (!work_order || !job_order || !shape_id || !object_id || rejected_quantity === undefined) {
        return res.status(400).json(new ApiResponse(400, null, 'Missing required fields: work_order, job_order, shape_id, object_id, and rejected_quantity are mandatory.'));
    }

    // Validate that IDs are valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(work_order) || !mongoose.Types.ObjectId.isValid(job_order) ||
        !mongoose.Types.ObjectId.isValid(shape_id) || !mongoose.Types.ObjectId.isValid(object_id)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid ObjectId format for work_order, job_order, shape_id, or object_id.'));
    }

    // Validate quantities
    if (rejected_quantity < 0 || (recycled_quantity !== undefined && recycled_quantity < 0)) {
        return res.status(400).json(new ApiResponse(400, null, 'Quantities cannot be negative.'));
    }

    const dailyProduction = await ironDailyProduction.findOne({ 'products.object_id': object_id });
    if (dailyProduction && rejected_quantity > dailyProduction.achievedTillNow) {
        return res.status(400).json(new ApiResponse(400, null, 'Rejected quantity cannot exceed achieved quantity.'));
    }

    try {
        // Create new QC check record
        const qcCheck = await ironQCCheck.create({
            work_order,
            job_order,
            shape_id,
            object_id,
            rejected_quantity,
            recycled_quantity: recycled_quantity || 0, // Default to 0 if not provided
            remarks: remarks || '', // Default to empty string if not provided
            created_by: req.user?._id, // Assuming req.user is set by authentication middleware
            status: 'Active',
        });

        // Populate references for response (optional)
        const populatedQCCheck = await ironQCCheck
            .findById(qcCheck._id)
            .populate('work_order', 'workOrderNumber')
            .populate('job_order', 'job_order_number')
            .populate('shape_id', 'shape_code name')
            .populate('created_by', 'username email')
            .lean();

        return res.status(201).json(
            new ApiResponse(201, populatedQCCheck, 'QC check record created successfully.')
        );
    } catch (error) {
        console.error('Error creating QC check:', error);
        return res.status(500).json(new ApiResponse(500, null, 'Internal Server Error', error.message));
    }
});

const createQCCheck2 = asyncHandler(async (req, res) => {
    // Extract data from request body
    const { work_order, job_order, shape_id, object_id, rejected_quantity, recycled_quantity, remarks } = req.body;
  
    // Validate required fields
    if (!work_order || !job_order || !shape_id || !object_id || rejected_quantity === undefined) {
      return res.status(400).json(new ApiResponse(400, null, 'Missing required fields: work_order, job_order, shape_id, object_id, and rejected_quantity are mandatory.'));
    }
  
    // Validate that IDs are valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(work_order) || !mongoose.Types.ObjectId.isValid(job_order) ||
        !mongoose.Types.ObjectId.isValid(shape_id) || !mongoose.Types.ObjectId.isValid(object_id)) {
      return res.status(400).json(new ApiResponse(400, null, 'Invalid ObjectId format for work_order, job_order, shape_id, or object_id.'));
    }
  
    // Validate quantities
    if (rejected_quantity < 0 || (recycled_quantity !== undefined && recycled_quantity < 0)) {
      return res.status(400).json(new ApiResponse(400, null, 'Quantities cannot be negative.'));
    }
  
    const dailyProduction = await ironDailyProduction.findOne({ 'products.object_id': object_id });
    if (dailyProduction && rejected_quantity > dailyProduction.achievedTillNow) {
      return res.status(400).json(new ApiResponse(400, null, 'Rejected quantity cannot exceed achieved quantity.'));
    }
  
    try {
      // Check if a QC check already exists for the shape_id and object_id
      let qcCheck = await ironQCCheck.findOne({ shape_id, object_id, status: 'Active' });
  
      if (qcCheck) {
        // Increment existing record
        qcCheck.rejected_quantity += rejected_quantity;
        if (recycled_quantity !== undefined) {
          qcCheck.recycled_quantity += recycled_quantity;
        }
        qcCheck.remarks = remarks || qcCheck.remarks; // Update remarks if provided
        qcCheck.updated_by = req.user?._id; // Update with current user
        await qcCheck.save();
      } else {
        // Create new QC check record
        qcCheck = await ironQCCheck.create({
          work_order,
          job_order,
          shape_id,
          object_id,
          rejected_quantity,
          recycled_quantity: recycled_quantity || 0,
          remarks: remarks || '',
          created_by: req.user?._id,
          status: 'Active',
        });
      }
  
      // Update ironDailyProduction with new rejected and recycled quantities
      if (dailyProduction) {
        const productIndex = dailyProduction.products.findIndex(p => p.object_id.toString() === object_id.toString());
        if (productIndex !== -1) {
          dailyProduction.products[productIndex].rejected_quantity += rejected_quantity;
          if (recycled_quantity !== undefined) {
            dailyProduction.products[productIndex].recycled_quantity += recycled_quantity;
          }
          dailyProduction.updated_by = req.user?._id;
          dailyProduction.production_logs.push({
            action: 'QCCheck',
            user: req.user?._id,
            rejected_quantity: rejected_quantity,
            description: remarks || 'QC check performed',
          });
          await dailyProduction.save();
        }
      }
  
      // Populate references for response
      const populatedQCCheck = await ironQCCheck
        .findById(qcCheck._id)
        .populate('work_order', 'workOrderNumber')
        .populate('job_order', 'job_order_number')
        .populate('shape_id', 'shape_code name')
        .populate('created_by', 'username email')
        .lean();
  
      return res.status(201).json(
        new ApiResponse(201, populatedQCCheck, 'QC check record updated or created successfully.')
      );
    } catch (error) {
      console.error('Error creating/updating QC check:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Internal Server Error', error.message));
    }
  });
  const createQCCheck = asyncHandler(async (req, res) => {
    // Extract data from request body
    const { work_order, job_order, shape_id, object_id, rejected_quantity, recycled_quantity, remarks } = req.body;
  
    // Validate required fields
    if (!work_order || !job_order || !shape_id || !object_id || rejected_quantity === undefined) {
      return res.status(400).json(new ApiResponse(400, null, 'Missing required fields: work_order, job_order, shape_id, object_id, and rejected_quantity are mandatory.'));
    }
  
    // Validate that IDs are valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(work_order) || !mongoose.Types.ObjectId.isValid(job_order) ||
        !mongoose.Types.ObjectId.isValid(shape_id) || !mongoose.Types.ObjectId.isValid(object_id)) {
      return res.status(400).json(new ApiResponse(400, null, 'Invalid ObjectId format for work_order, job_order, shape_id, or object_id.'));
    }
  
    // Validate quantities
    if (rejected_quantity < 0 || (recycled_quantity !== undefined && recycled_quantity < 0)) {
      return res.status(400).json(new ApiResponse(400, null, 'Quantities cannot be negative.'));
    }
  
    const dailyProduction = await ironDailyProduction.findOne({ 'products.object_id': object_id });
    if (dailyProduction && rejected_quantity > dailyProduction.achievedTillNow) {
      return res.status(400).json(new ApiResponse(400, null, 'Rejected quantity cannot exceed achieved quantity.'));
    }
  
    try {
      // Check if a QC check already exists for the shape_id and object_id
      let qcCheck = await ironQCCheck.findOne({ shape_id, object_id, status: 'Active' });
  
      if (qcCheck) {
        // Increment existing record
        const previousRejectedQuantity = qcCheck.rejected_quantity;
        qcCheck.rejected_quantity += rejected_quantity;
        if (recycled_quantity !== undefined) {
          qcCheck.recycled_quantity += recycled_quantity;
        }
        qcCheck.remarks = remarks || qcCheck.remarks; // Update remarks if provided
        qcCheck.updated_by = req.user?._id; // Update with current user
        await qcCheck.save();
      } else {
        // Create new QC check record
        qcCheck = await ironQCCheck.create({
          work_order,
          job_order,
          shape_id,
          object_id,
          rejected_quantity,
          recycled_quantity: recycled_quantity || 0,
          remarks: remarks || '',
          created_by: req.user?._id,
          status: 'Active',
        });
      }
  
      // Update ironDailyProduction with new rejected and recycled quantities, and deduct from achieved_quantity
      if (dailyProduction) {
        const productIndex = dailyProduction.products.findIndex(p => p.object_id.toString() === object_id.toString());
        if (productIndex !== -1) {
          const incrementRejected = qcCheck.rejected_quantity - (qcCheck.rejected_quantity - rejected_quantity); // Incremental rejected quantity
          if (dailyProduction.products[productIndex].achieved_quantity - incrementRejected < 0) {
            return res.status(400).json(new ApiResponse(400, null, 'Rejected quantity would result in negative achieved quantity.'));
          }
          dailyProduction.products[productIndex].rejected_quantity = qcCheck.rejected_quantity;
          if (recycled_quantity !== undefined) {
            dailyProduction.products[productIndex].recycled_quantity += recycled_quantity;
          }
          dailyProduction.products[productIndex].achieved_quantity -= incrementRejected; // Deduct the incremental rejected quantity
          dailyProduction.updated_by = req.user?._id;
          dailyProduction.production_logs.push({
            action: 'QCCheck',
            user: req.user?._id,
            rejected_quantity: qcCheck.rejected_quantity,
            description: remarks || 'QC check performed',
          });
          await dailyProduction.save();
        }
      }
  
      // Populate references for response
      const populatedQCCheck = await ironQCCheck
        .findById(qcCheck._id)
        .populate('work_order', 'workOrderNumber')
        .populate('job_order', 'job_order_number')
        .populate('shape_id', 'shape_code name')
        .populate('created_by', 'username email')
        .lean();
  
      return res.status(201).json(
        new ApiResponse(201, populatedQCCheck, 'QC check record updated or created successfully.')
      );
    } catch (error) {
      console.error('Error creating/updating QC check:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Internal Server Error', error.message));
    }
  });


const getAllQCChecks = asyncHandler(async (req, res) => {
    try {
        // Extract pagination parameters from query
        // const page = parseInt(req.query.page) || 1;
        // const limit = parseInt(req.query.limit) || 10;
        // const skip = (page - 1) * limit;

        // Fetch QC checks with populated fields
        const qcChecks = await ironQCCheck
            .find({ status: 'Active' })
            .select('work_order job_order shape_id object_id rejected_quantity recycled_quantity remarks created_by createdAt')
            .populate('work_order', 'workOrderNumber')
            .populate('job_order', 'job_order_number')
            .populate('shape_id', 'shape_code')
            .populate('created_by', 'username')
            // .skip(skip)
            // .limit(limit)
            .lean();

        // Get total count for pagination
        const totalRecords = await ironQCCheck.countDocuments({ status: 'Active' });
        console.log("qcChecks",qcChecks);

        // Format response data
        const formattedQCChecks = qcChecks.map(qc => ({
            _id:qc._id?.toString() || 'N/A',
            workOrderNumber: qc.work_order?.workOrderNumber || 'N/A',
            jobOrderNumber: qc.job_order?.job_order_number || 'N/A',
            shapeCode: qc.shape_id?.shape_code || 'N/A',
            objectId: qc.object_id?.toString() || 'N/A', // Add object_id
            rejectedQuantity: qc.rejected_quantity,
            recycledQuantity: qc.recycled_quantity || 0,
            remarks: qc.remarks || '',
            createdBy: qc.created_by?.username || 'Unknown',
            createdAt: qc.createdAt
        }));

        // Prepare pagination metadata
        // const pagination = {
        //     currentPage: page,
        //     totalPages: Math.ceil(totalRecords / limit),
        //     totalRecords,
        //     limit
        // };

        return res.status(200).json(
            new ApiResponse(
                200,
                  formattedQCChecks,
                'QC checks retrieved successfully.'
            )
        );
    } catch (error) {
        console.error('Error fetching QC checks:', error);
        return res.status(500).json(
            new ApiResponse(500, null, 'Internal Server Error', error.message)
        );
    }
});


const getQCCheckById = asyncHandler(async (req, res) => {
    // Extract QC check ID from request parameters
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json(
            new ApiResponse(400, null, 'Invalid QC check ID format.')
        );
    }

    try {
        // Fetch QC check with populated fields
        const qcCheck = await ironQCCheck
            .findById(id)
            .populate({
                path: 'work_order',
                select: 'workOrderNumber clientId projectId status created_by',
                populate: [
                    {
                        path: 'clientId',
                        select: 'name address',
                        model: 'ironClient'
                    },
                    {
                        path: 'projectId',
                        select: 'name',
                        model: 'ironProject'
                    },
                    {
                        path: 'created_by',
                        select: 'username role',
                        model: 'User'
                    }
                ]
            })
            .populate({
                path: 'job_order',
                select: 'job_order_number'
            })
            .populate({
                path: 'shape_id',
                select: 'shape_code description'
            })
            .lean();

        // Check if QC check exists
        if (!qcCheck) {
            return res.status(404).json(
                new ApiResponse(404, null, 'QC check not found.')
            );
        }

        // Format response data as per the requested structure
        const formattedResponse = {
            clientProjectDetails: {
                clientName: qcCheck.work_order?.clientId?.name || 'N/A',
                clientId: qcCheck.work_order?.clientId?._id?.toString() || 'N/A',
                projectName: qcCheck.work_order?.projectId?.name || 'N/A',
                projectId: qcCheck.work_order?.projectId?._id?.toString() || 'N/A',
                address: qcCheck.work_order?.clientId?.address || 'N/A'
            },
            workOrderDetails: {
                workOrderNumber: qcCheck.work_order?.workOrderNumber || 'N/A',
                workOrderId: qcCheck.work_order?._id?.toString() || 'N/A',
                jobOrderNumber: qcCheck.job_order?.job_order_number || 'N/A',
                jobOrderId: qcCheck.job_order?._id?.toString() || 'N/A',
                createdAt: qcCheck.createdAt?.toISOString() || 'N/A',
                createdBy: `${qcCheck.work_order?.created_by?.username || 'N/A'}`,
                createdById: qcCheck.work_order?.created_by?._id?.toString() || 'N/A',
                status: qcCheck.work_order?.status || 'N/A'
            },
            productDetails: {
                shapeCode: qcCheck.shape_id?.shape_code || 'N/A',
                shapeId: qcCheck.shape_id?._id?.toString() || 'N/A',
                objectId: qcCheck.object_id?.toString() || 'N/A',
                description: qcCheck.shape_id?.description || 'N/A',
                recycledQuantity: qcCheck.recycled_quantity || 0,
                rejectedQuantity: qcCheck.rejected_quantity || 0,
                remarks: qcCheck.remarks || ''
            },
            qcCheckId: qcCheck._id?.toString() || 'N/A'
        };

        return res.status(200).json(
            new ApiResponse(
                200,
                formattedResponse,
                'QC check retrieved successfully.'
            )
        );
    } catch (error) {
        console.error('Error fetching QC check:', error);
        return res.status(500).json(
            new ApiResponse(500, null, 'Internal Server Error', error.message)
        );
    }
});

const updateQCCheck1 = asyncHandler(async (req, res) => {
    // Extract QC check ID from request parameters
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json(
            new ApiResponse(400, null, 'Invalid QC check ID format.')
        );
    }

    // Extract fields to update from request body
    const { work_order, job_order, shape_id, object_id, rejected_quantity, recycled_quantity, remarks, status } = req.body;

    // Create update object with only provided fields
    const updateData = {};
    if (work_order) {
        if (!mongoose.Types.ObjectId.isValid(work_order)) {
            return res.status(400).json(
                new ApiResponse(400, null, 'Invalid work_order ID format.')
            );
        }
        updateData.work_order = work_order;
    }
    if (job_order) {
        if (!mongoose.Types.ObjectId.isValid(job_order)) {
            return res.status(400).json(
                new ApiResponse(400, null, 'Invalid job_order ID format.')
            );
        }
        updateData.job_order = job_order;
    }
    if (shape_id) {
        if (!mongoose.Types.ObjectId.isValid(shape_id)) {
            return res.status(400).json(
                new ApiResponse(400, null, 'Invalid shape_id format.')
            );
        }
        updateData.shape_id = shape_id;
    }
    if (object_id) {
        if (!mongoose.Types.ObjectId.isValid(object_id)) {
            return res.status(400).json(
                new ApiResponse(400, null, 'Invalid object_id format.')
            );
        }
        updateData.object_id = object_id;
    }

    if (rejected_quantity !== undefined) {
        const dailyProduction = await ironDailyProduction.findOne({ 'products.object_id': updateData.object_id });
        if (dailyProduction && rejected_quantity > dailyProduction.achievedTillNow) {
            return res.status(400).json(new ApiResponse(400, null, 'Rejected quantity cannot exceed achieved quantity.'));
        }
        updateData.rejected_quantity = rejected_quantity;
    }
    if (rejected_quantity !== undefined) {
        if (typeof rejected_quantity !== 'number' || rejected_quantity < 0) {
            return res.status(400).json(
                new ApiResponse(400, null, 'rejected_quantity must be a non-negative number.')
            );
        }
        updateData.rejected_quantity = rejected_quantity;
    }
    if (recycled_quantity !== undefined) {
        if (typeof recycled_quantity !== 'number' || recycled_quantity < 0) {
            return res.status(400).json(
                new ApiResponse(400, null, 'recycled_quantity must be a non-negative number.')
            );
        }
        updateData.recycled_quantity = recycled_quantity;
    }
    if (remarks !== undefined) {
        updateData.remarks = remarks ? remarks.trim() : '';
    }
    if (status) {
        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json(
                new ApiResponse(400, null, 'Status must be either Active or Inactive.')
            );
        }
        updateData.status = status;
    }
    if (req.user?._id) {
        updateData.updated_by = req.user._id; // Track who updated the record
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json(
            new ApiResponse(400, null, 'No valid fields provided for update.')
        );
    }

    try {
        // Update QC check
        const updatedQCCheck = await ironQCCheck
            .findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            )
            .populate({
                path: 'work_order',
                select: 'workOrderNumber clientId projectId status created_by',
                populate: [
                    {
                        path: 'clientId',
                        select: 'name address',
                        model: 'ironClient'
                    },
                    {
                        path: 'projectId',
                        select: 'name',
                        model: 'ironProject'
                    },
                    {
                        path: 'created_by',
                        select: 'username role',
                        model: 'User'
                    }
                ]
            })
            .populate({
                path: 'job_order',
                select: 'job_order_number'
            })
            .populate({
                path: 'shape_id',
                select: 'shape_code description'
            })
            .lean();

        // Check if QC check exists
        if (!updatedQCCheck) {
            return res.status(404).json(
                new ApiResponse(404, null, 'QC check not found.')
            );
        }

        // Format response data as per the requested structure
        const formattedResponse = {
            clientProjectDetails: {
                clientName: updatedQCCheck.work_order?.clientId?.name || 'N/A',
                clientId: updatedQCCheck.work_order?.clientId?._id?.toString() || 'N/A',
                projectName: updatedQCCheck.work_order?.projectId?.name || 'N/A',
                projectId: updatedQCCheck.work_order?.projectId?._id?.toString() || 'N/A',
                address: updatedQCCheck.work_order?.clientId?.address || 'N/A'
            },
            workOrderDetails: {
                workOrderNumber: updatedQCCheck.work_order?.workOrderNumber || 'N/A',
                workOrderId: updatedQCCheck.work_order?._id?.toString() || 'N/A',
                jobOrderNumber: updatedQCCheck.job_order?.job_order_number || 'N/A',
                jobOrderId: updatedQCCheck.job_order?._id?.toString() || 'N/A',
                createdAt: updatedQCCheck.createdAt?.toISOString() || 'N/A',
                createdBy: `${updatedQCCheck.work_order?.created_by?.username || 'Unknown'} (${updatedQCCheck.work_order?.created_by?.role || 'N/A'})`,
                createdById: updatedQCCheck.work_order?.created_by?._id?.toString() || 'N/A',
                status: updatedQCCheck.work_order?.status || 'N/A'
            },
            productDetails: {
                shapeCode: updatedQCCheck.shape_id?.shape_code || 'N/A',
                shapeId: updatedQCCheck.shape_id?._id?.toString() || 'N/A',
                objectId: updatedQCCheck.object_id?.toString() || 'N/A',
                description: updatedQCCheck.shape_id?.description || 'N/A',
                recycledQuantity: updatedQCCheck.recycled_quantity || 0,
                rejectedQuantity: updatedQCCheck.rejected_quantity || 0,
                remarks: updatedQCCheck.remarks || ''
            },
            qcCheckId: updatedQCCheck._id?.toString() || 'N/A'
        };

        return res.status(200).json(
            new ApiResponse(
                200,
                formattedResponse,
                'QC check updated successfully.'
            )
        );
    } catch (error) {
        console.error('Error updating QC check:', error);
        return res.status(500).json(
            new ApiResponse(500, null, 'Internal Server Error', error.message)
        );
    }
});

const updateQCCheck = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejected_quantity, recycled_quantity, remarks } = req.body;
  
    // Validate input
    if (rejected_quantity !== undefined && (isNaN(rejected_quantity) || rejected_quantity < 0)) {
      return res.status(400).json(new ApiResponse(400, null, 'Rejected quantity must be a non-negative number.'));
    }
    if (recycled_quantity !== undefined && (isNaN(recycled_quantity) || recycled_quantity < 0)) {
      return res.status(400).json(new ApiResponse(400, null, 'Recycled quantity must be a non-negative number.'));
    }
  
    try {
      // Find the existing QC check
      const qcCheck = await ironQCCheck.findById(id);
      if (!qcCheck) {
        return res.status(404).json(new ApiResponse(404, null, 'QC check not found.'));
      }
  
      // Store previous values for comparison
      const prevRejectedQuantity = qcCheck.rejected_quantity;
      const prevRecycledQuantity = qcCheck.recycled_quantity;
  
      // Update QC check fields
      if (rejected_quantity !== undefined) qcCheck.rejected_quantity = rejected_quantity;
      if (recycled_quantity !== undefined) qcCheck.recycled_quantity = recycled_quantity;
      if (remarks !== undefined) qcCheck.remarks = remarks;
      qcCheck.updated_by = req.user?._id;
      await qcCheck.save();
  
      // Update ironDailyProduction
      const dailyProduction = await ironDailyProduction.findOne({ 'products.object_id': qcCheck.object_id });
      if (dailyProduction) {
        const productIndex = dailyProduction.products.findIndex(p => p.object_id.toString() === qcCheck.object_id.toString());
        if (productIndex !== -1) {
          // Calculate incremental changes
          const incrementRejected = (rejected_quantity !== undefined ? rejected_quantity : prevRejectedQuantity) - prevRejectedQuantity;
          const incrementRecycled = (recycled_quantity !== undefined ? recycled_quantity : prevRecycledQuantity) - prevRecycledQuantity;
  
          // Update production record
          dailyProduction.products[productIndex].rejected_quantity = qcCheck.rejected_quantity;
          dailyProduction.products[productIndex].recycled_quantity = qcCheck.recycled_quantity;
          dailyProduction.products[productIndex].achieved_quantity -= incrementRejected; // Deduct incremental rejected qty
          if (dailyProduction.products[productIndex].achieved_quantity < 0) {
            return res.status(400).json(new ApiResponse(400, null, 'Update would result in negative achieved quantity.'));
          }
  
          dailyProduction.updated_by = req.user?._id;
          dailyProduction.production_logs.push({
            action: 'QCCheckUpdate',
            user: req.user?._id,
            rejected_quantity: qcCheck.rejected_quantity,
            recycled_quantity: qcCheck.recycled_quantity,
            description: remarks || 'QC check updated',
          });
          await dailyProduction.save();
        }
      }
  
      // Populate response
      const populatedQCCheck = await ironQCCheck
        .findById(qcCheck._id)
        .populate('work_order', 'workOrderNumber')
        .populate('job_order', 'job_order_number')
        .populate('shape_id', 'shape_code name')
        .populate('created_by', 'username email')
        .lean();
  
      return res.status(200).json(
        new ApiResponse(200, populatedQCCheck, 'QC check updated successfully.')
      );
    } catch (error) {
      console.error('Error updating QC check:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Internal Server Error', error.message));
    }
  });

const deleteQCCheck = asyncHandler(async (req, res) => {
    let ids = req.body.ids;

    // 1. Validate input
    if (!ids) {
        return res.status(400).json(new ApiResponse(400, null, 'No IDs provided'));
    }

    // 2. Convert single ID to array if needed
    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    // 3. Check for empty array
    if (ids.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'IDs array cannot be empty'));
    }

    // 4. Validate MongoDB ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
    }

    try {
        // 5. Permanent deletion of QC checks
        const result = await ironQCCheck.deleteMany({ _id: { $in: ids } });

        if (result.deletedCount === 0) {
            return res.status(404).json(new ApiResponse(404, null, 'No QC checks found to delete'));
        }

        return res.status(200).json(new ApiResponse(200, {
            deletedCount: result.deletedCount,
            deletedIds: ids
        }, `${result.deletedCount} QC check(s) deleted successfully`));
    } catch (error) {
        console.error('Error deleting QC checks:', error);
        return res.status(500).json(new ApiResponse(500, null, `Error deleting QC checks: ${error.message}`));
    }
});


export { createQCCheck, getAllQCChecks, getQCCheckById, updateQCCheck, deleteQCCheck };