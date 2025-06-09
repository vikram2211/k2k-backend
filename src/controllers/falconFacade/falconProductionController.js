import { falconInternalWorkOrder } from "../../models/falconFacade/falconInternalWorder.model.js";
import { falconProduction } from '../../models/falconFacade/falconProduction.model.js';
import { asyncHandler } from "../../utils/asyncHandler.js";
import { formatDateToIST } from '../../utils/formatDate.js'


const getProductionsByProcess = asyncHandler(async (req, res) => {
    try {
        // 1. Get the process name from query parameters
        const { process } = req.query;
        // console.log("process", process);
        if (!process) {
            return res.status(400).json({
                success: false,
                message: 'Process name is required in query parameters (e.g., ?process=cutting)',
            });
        }

        // 2. Validate the process name against allowed values
        const validProcesses = ['cutting', 'machining', 'assembling', 'glass fixing/glazing'];
        const processName = process.toLowerCase();
        if (!validProcesses.includes(processName)) {
            return res.status(400).json({
                success: false,
                message: `Invalid process name. Allowed values are: ${validProcesses.join(', ')}`,
            });
        }

        // 3. Query falconProduction directly by process name
        const productions = await falconProduction.aggregate([
            // Step 1: Match documents by process_name
            {
                $match: {
                    process_name: processName
                }
            },
            // Step 2: Lookup job_order details from falconJobOrder
            {
                $lookup: {
                    from: 'falconjoborders', // Adjust to match your actual collection name
                    localField: 'job_order',
                    foreignField: '_id',
                    as: 'jobOrderDetails'
                }
            },
            // Step 3: Unwind jobOrderDetails to simplify the structure
            {
                $unwind: {
                    path: '$jobOrderDetails',
                    preserveNullAndEmptyArrays: true // In case job_order doesn't exist
                }
            },
            // Step 4: Lookup product details from falconProduct
            {
                $lookup: {
                    from: 'falconproducts', // Adjust to match your actual collection name
                    localField: 'product.product_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            // Step 5: Unwind productDetails
            {
                $unwind: {
                    path: '$productDetails',
                    preserveNullAndEmptyArrays: true // In case product_id doesn't exist
                }
            },
            // Step 6: Lookup created_by details from users
            {
                $lookup: {
                    from: 'users', // Adjust to match your actual collection name
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'createdByDetails'
                }
            },
            // Step 7: Unwind createdByDetails
            {
                $unwind: {
                    path: '$createdByDetails',
                    preserveNullAndEmptyArrays: true // In case created_by doesn't exist
                }
            },
            // Step 8: Project the desired fields
            {
                $project: {
                    _id: 1,
                    job_order: '$jobOrderDetails.job_order_id', // e.g., "JO-001"
                    work_order_number: '$jobOrderDetails.work_order_number',
                    semifinished_id: 1,
                    // product: {
                    product_id: '$product.product_id',
                    name: '$productDetails.name', // Product name from falconProduct
                    po_quantity: '$product.po_quantity',
                    achieved_quantity: '$product.achieved_quantity',
                    // rejected_quantity: '$product.rejected_quantity',
                    // recycled_quantity: '$product.recycled_quantity'
                    // },
                    process_name: 1,
                    date: 1,
                    status: 1,
                    created_by: '$createdByDetails.username', // Username from users
                    updated_by: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1
                }
            }
        ]);

        // 4. Check if any productions were found
        if (productions.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No production records found for process: ${process}`,
            });
        }

        // 5. Return the filtered productions
        return res.status(200).json({
            success: true,
            message: `Production records fetched successfully for process: ${process}`,
            data: formatDateToIST(productions),
        });
    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching production records: ${error.message}`,
        });
    }
});



export {
    getProductionsByProcess
}