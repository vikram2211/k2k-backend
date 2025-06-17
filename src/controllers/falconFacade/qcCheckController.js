const asyncHandler = require('express-async-handler');
const { falconQCCheck } = require('./path/to/your/qcCheckModel'); // Adjust path to your model

const standaloneQCCheck = asyncHandler(async (req, res) => {
    try {
        const { job_order, product_id, semifinished_id, rejected_quantity, recycled_quantity, remarks } = req.body;
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
            product: { product_id },
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
                product: {
                    product_id: qcCheck.product.product_id,
                },
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

module.exports = { standaloneQCCheck };