import { asyncHandler } from '../../utils/asyncHandler.js';
import { falconQCCheck } from '../../models/falconFacade/falconQcCheck.model.js';
import { falconInternalWorkOrder } from '../../models/falconFacade/falconInternalWorder.model.js';
import { falconJobOrder } from '../../models/falconFacade/falconJobOrder.model.js';
import { falconWorkOrder } from '../../models/falconFacade/falconWorkOrder.model.js';
import { falconProduct } from '../../models/falconFacade/helpers/falconProduct.model.js';
import { User } from '../../models/user.model.js';
import { falconClient } from '../../models/falconFacade/helpers/falconClient.model.js';
import { falconProject } from '../../models/falconFacade/helpers/falconProject.model.js';
import mongoose from 'mongoose';

const standaloneQCCheck = asyncHandler(async (req, res) => {
    try {
        const { job_order, product_id, semifinished_id, rejected_quantity, recycled_quantity, remarks } = req.body;
        console.log("product_id", product_id);
        const userId = req.user?._id; // Assume user ID from authenticated user (e.g., JWT middleware)

        // Validate inputs
        if (!job_order || !mongoose.Types.ObjectId.isValid(job_order)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Job Order ID is required',
            });
        }
        if (!product_id || !mongoose.Types.ObjectId.isValid(product_id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Product ID is required',
            });
        }
        if (!semifinished_id || typeof semifinished_id !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Semi-finished ID is required and must be a string',
            });
        }
        if (typeof rejected_quantity !== 'number' || rejected_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejected quantity must be a non-negative number',
            });
        }
        if (typeof recycled_quantity !== 'number' || recycled_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Recycled quantity must be a non-negative number',
            });
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        // Create new QC check record
        const qcCheck = new falconQCCheck({
            production: null, // Not linked to a production record
            job_order,
            product_id,
            semifinished_id,
            rejected_quantity,
            recycled_quantity,
            process_name: null, // Not applicable for standalone QC check
            remarks,
            checked_by: userId,
            updated_by: userId,
        });

        await qcCheck.save();

        // Format response
        return res.status(201).json({
            success: true,
            message: 'Standalone QC check created successfully',
            data: {
                qc_check_id: qcCheck._id,
                job_order: qcCheck.job_order,
                product: qcCheck.product_id,
                semifinished_id: qcCheck.semifinished_id,
                rejected_quantity: qcCheck.rejected_quantity,
                recycled_quantity: qcCheck.recycled_quantity,
                remarks: qcCheck.remarks,
                checked_by: qcCheck.checked_by,
                updated_by: qcCheck.updated_by,
                created_at: qcCheck.createdAt.toISOString(),
                updated_at: qcCheck.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error in standalone QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating QC check: ' + error.message,
        });
    }
});

const getAllQCChecks = asyncHandler(async (req, res) => {
    try {
        const qcChecks = await falconQCCheck
            .find({})
            .populate({
                path: 'job_order',
                select: 'job_order_id work_order_number',
                populate: {
                    path: 'work_order_number',
                    select: 'work_order_number',
                },
            })
            .populate({
                path: 'product_id',
                select: 'name',
            })
            .populate({
                path: 'checked_by',
                select: 'username',
            })
            .lean();

        const formattedData = qcChecks.map((qc) => ({
            qcCheckId: qc._id,
            jobOrderId: qc.job_order?.job_order_id || 'N/A',
            workOrderNumber: qc.job_order?.work_order_number?.work_order_number || 'N/A',
            productName: qc.product_id?.name || 'N/A',
            semifinishedId: qc.semifinished_id,
            rejectedQuantity: qc.rejected_quantity,
            recycledQuantity: qc.recycled_quantity,
            remarks: qc.remarks || '',
            checkedBy: qc.checked_by?.username || 'N/A',
            createdAt: qc.createdAt,
            updatedAt: qc.updatedAt,
        }));

        return res.status(200).json({
            success: true,
            message: 'QC checks fetched successfully',
            data: formattedData,
        });
    } catch (error) {
        console.error('Error fetching QC checks:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});

const getQCCheckDetailsById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid QC Check ID',
        });
    }

    const qcCheck = await falconQCCheck.findById(id)
        .populate({ path: 'job_order', populate: { path: 'work_order_number prod_issued_approved_by prod_recieved_by created_by' } })
        .populate('product_id')
        .populate('checked_by');

    if (!qcCheck) {
        return res.status(404).json({
            success: false,
            message: 'QC Check not founddddd',
        });
    }

    const jobOrder = qcCheck.job_order;
    const workOrder = jobOrder?.work_order_number;
    const product = qcCheck.product_id;
    const checkedBy = qcCheck.checked_by;
    const approvedBy = jobOrder?.prod_issued_approved_by;
    const receivedBy = jobOrder?.prod_recieved_by;

    const client = await falconClient.findById(workOrder?.client_id);
    const project = await falconProject.findById(workOrder?.project_id);

    const response = {
        statusCode: 200,
        success: true,
        message: 'Job order fetched successfully',
        data: {
            clientProjectDetails: {
                clientName: client?.name,
                clientId: client?._id,
                address: client?.address,
                projectName: project?.name,
                projectId: project?._id,
            },
            workOrderDetails: {
                workOrderId: workOrder?._id,
                workOrderNumber: workOrder?.work_order_number,
                productionRequestDate: jobOrder?.prod_requset_date?.toISOString().split('T')[0].split('-').reverse().join('-'),
                productionRequirementDate: jobOrder?.prod_requirement_date?.toISOString().split('T')[0].split('-').reverse().join('-'),
                approvedBy: approvedBy?.username,
                approvedById: approvedBy?._id,
                receivedBy: receivedBy?.username,
                receivedById: receivedBy?._id,
                remarks: workOrder?.remarks,
                workOrderDate: workOrder?.date?.toISOString().split('T')[0].split('-').reverse().join('-'),
                file: jobOrder?.files || [],
                createdAt: jobOrder?.createdAt?.toISOString().split('T')[0].split('-').reverse().join('-'),
                createdBy: jobOrder?.created_by?.username,
            },
            jobOrderDetails: {
                jobOrderId: jobOrder?._id,
                jobOrderNumber: jobOrder?.job_order_id,
                createdAt: jobOrder?.createdAt?.toISOString().split('T')[0].split('-').reverse().join('-'),
                createdBy: jobOrder?.created_by?.username,
                status: jobOrder?.status,
            },
            qcCheckDetails: [
                {
                    jobOrderId: jobOrder?._id,
                    jobOrderNumber: jobOrder?.job_order_id,
                    workOrderId: workOrder?._id,
                    workOrderNumber: workOrder?.work_order_number,
                    productId: product?._id,
                    productName: product?.name,
                    semifinishedId: qcCheck.semifinished_id,
                    rejectedQuantity: qcCheck.rejected_quantity,
                    recycledQuantity: qcCheck.recycled_quantity,
                    remarks: qcCheck.remarks,
                },
            ],
        },
    };

    return res.status(200).json(response);
});


const getSemifinishedIds = asyncHandler(async (req, res) => {
    try {
        const { jobOrderId, productId } = req.query;

        if (!jobOrderId || !productId) {
            return res.status(400).json({
                success: false,
                message: "Both jobOrderId and productId are required",
            });
        }

        const internalWO = await falconInternalWorkOrder.findOne({
            job_order_id: jobOrderId,
            "products.product": productId
        }).lean();

        if (!internalWO) {
            return res.status(404).json({
                success: false,
                message: "Internal Work Order not found",
            });
        }

        // Find the specific product entry
        const matchedProduct = internalWO.products.find(
            (prod) => prod.product.toString() === productId
        );

        if (!matchedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found in internal work order",
            });
        }

        // Extract semifinished_ids
        const semifinishedIds = matchedProduct.semifinished_details.map(
            (semi) => semi.semifinished_id
        );

        return res.status(200).json({
            success: true,
            message: "Semifinished IDs fetched successfully",
            semifinishedIds,
        });

    } catch (error) {
        console.error('Error in standalone QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating QC check: ' + error.message,
        });
    }
})
const updateFalconQc = asyncHandler(async (req, res) => {
    try {
        // console.log("came here");
        const { id } = req.params;
        // console.log("id", id);
        const { rejected_quantity, recycled_quantity, remarks } = req.body;
        const userId = req.user?._id;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid QC Check ID',
            });
        }

        // Build update object dynamically
        const updateFields = {};
        if (typeof rejected_quantity === 'number') {
            if (rejected_quantity < 0) {
                return res.status(400).json({ success: false, message: 'Rejected quantity must be non-negative' });
            }
            updateFields.rejected_quantity = rejected_quantity;
        }
        if (typeof recycled_quantity === 'number') {
            if (recycled_quantity < 0) {
                return res.status(400).json({ success: false, message: 'Recycled quantity must be non-negative' });
            }
            updateFields.recycled_quantity = recycled_quantity;
        }
        if (typeof remarks === 'string') {
            updateFields.remarks = remarks;
        }

        // Ensure at least one field is being updated
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update',
            });
        }

        // Add updated_by
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        updateFields.updated_by = userId;

        // Perform update
        const updatedCheck = await falconQCCheck.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true }
        );

        if (!updatedCheck) {
            return res.status(404).json({ success: false, message: 'QC Check not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'QC Check updated successfully',
            data: updatedCheck,
        });

    } catch (error) {
        console.error('Error in standalone QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating QC check: ' + error.message,
        });
    }
})

export { standaloneQCCheck, getSemifinishedIds, getAllQCChecks, getQCCheckDetailsById, updateFalconQc };