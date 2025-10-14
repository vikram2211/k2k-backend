import { falconInternalWorkOrder } from "../../models/falconFacade/falconInternalWorder.model.js";
import { falconProduction } from '../../models/falconFacade/falconProduction.model.js';
import { falconQCCheck } from "../../models/falconFacade/falconQcCheck.model.js";
import { falconPacking } from "../../models/falconFacade/falconPacking.model.js";
import { falocnDispatch } from "../../models/falconFacade/falconDispatch.model.js";
import { falconProduct } from "../../models/falconFacade/helpers/falconProduct.model.js";
import { falconSystem } from "../../models/falconFacade/helpers/falconSystem.model.js";
import { falconProductSystem } from "../../models/falconFacade/helpers/falconProductSystem.model.js";
import { falconProject } from '../../models/falconFacade/helpers/falconProject.model.js'
import { asyncHandler } from "../../utils/asyncHandler.js";
import { formatDateToIST } from '../../utils/formatDate.js';
import mongoose from 'mongoose';


const getProductionsByProcess_22_07_2025 = asyncHandler(async (req, res) => {
    try {
        // 1. Get the process name from query parameters
        const { process } = req.query;
        console.log("process", process);
        if (!process) {
            return res.status(400).json({
                success: false,
                message: 'Process name is required in query parameters (e.g., ?process=cutting)',
            });
        }

        // 2. Validate the process name against allowed values
        const validProcesses = ['cutting', 'machining', 'assembling', 'glass fixing / glazing']; //glass fixing / glazing
        const processName = process.toLowerCase();
        if (!validProcesses.includes(processName)) {
            return res.status(400).json({
                success: false,
                message: `Invalid process name. Allowed values are: ${validProcesses.join(', ')}`,
            });
        }
        console.log("processName", processName);

        // 3. Query falconProduction directly by process name
        const productions = await falconProduction.aggregate([
            // Step 1: Match documents by process_name
            {
                $match: {
                    process_name: processName
                }
            },
            // Step 2: Lookup job_order details from falconJobOrder
            // {
            //     $lookup: {
            //         from: 'falconjoborders', // Adjust to match your actual collection name
            //         localField: 'job_order',
            //         foreignField: '_id',
            //         as: 'jobOrderDetails'
            //     }
            // },
            // // Step 3: Unwind jobOrderDetails to simplify the structure
            // {
            //     $unwind: {
            //         path: '$jobOrderDetails',
            //         preserveNullAndEmptyArrays: true // In case job_order doesn't exist
            //     }
            // },
            // 1. Lookup job order details
            {
                $lookup: {
                    from: 'falconjoborders',
                    localField: 'job_order',
                    foreignField: '_id',
                    as: 'jobOrderDetails'
                }
            },
            {
                $unwind: {
                    path: '$jobOrderDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // 2. Lookup work order details using jobOrderDetails.work_order_number
            {
                $lookup: {
                    from: 'falconworkorders',
                    localField: 'jobOrderDetails.work_order_number',
                    foreignField: '_id',
                    as: 'workOrderDetails'
                }
            },
            {
                $unwind: {
                    path: '$workOrderDetails',
                    preserveNullAndEmptyArrays: true
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
                    // work_order_number: '$jobOrderDetails.work_order_number',
                    work_order_id: '$jobOrderDetails.work_order_number',  // This is the ObjectId of work order
                    work_order_number: '$workOrderDetails.work_order_number',
                    semifinished_id: 1,
                    // product: {
                    product_id: '$product.product_id',
                    name: '$productDetails.name', // Product name from falconProduct
                    po_quantity: '$product.po_quantity',
                    achieved_quantity: '$product.achieved_quantity',
                    rejected_quantity: '$product.rejected_quantity',
                    recycled_quantity: '$product.recycled_quantity',
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


const getProductionsByProcess = asyncHandler(async (req, res) => {
    try {
        // 1. Get the process name from query parameters
        const { process } = req.query;
        console.log("process", process);
        if (!process) {
            return res.status(400).json({
                success: false,
                message: 'Process name is required in query parameters (e.g., ?process=cutting)',
            });
        }

        // 2. Validate the process name against allowed values
        const validProcesses = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
        const processName = process.toLowerCase();
        if (!validProcesses.includes(processName)) {
            return res.status(400).json({
                success: false,
                message: `Invalid process name. Allowed values are: ${validProcesses.join(', ')}`,
            });
        }
        console.log("processName", processName);

        // 3. Query falconProduction with aggregation
        const productions = await falconProduction.aggregate([
            // Step 1: Match documents by process_name
            {
                $match: {
                    process_name: processName,
                    'product.product_id': { $exists: true, $ne: null } // Ensure product_id exists
                }
            },
            // Step : Lookup internal work order details
            {
                $lookup: {
                    from: 'falconinternalworkorders',
                    localField: 'internal_work_order',
                    foreignField: '_id',
                    as: 'internalWorkOrderDetails'
                }
            },
            {
                $unwind: {
                    path: '$internalWorkOrderDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Step 2: Lookup job order details
            {
                $lookup: {
                    from: 'falconjoborders',
                    localField: 'job_order',
                    foreignField: '_id',
                    as: 'jobOrderDetails'
                }
            },
            {
                $unwind: {
                    path: '$jobOrderDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Step 3: Lookup work order details
            {
                $lookup: {
                    from: 'falconworkorders',
                    localField: 'jobOrderDetails.work_order_number',
                    foreignField: '_id',
                    as: 'workOrderDetails'
                }
            },
            {
                $unwind: {
                    path: '$workOrderDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Step 4: Lookup product details
            {
                $lookup: {
                    from: 'falconproducts',
                    localField: 'product.product_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: {
                    path: '$productDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Step 5: Lookup created_by details
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'createdByDetails'
                }
            },
            {
                $unwind: {
                    path: '$createdByDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Step 6: Project the desired fields
            {
                $project: {
                    _id: 1,
                    job_order: '$jobOrderDetails.job_order_id',
                    work_order_id: '$jobOrderDetails.work_order_number',
                    work_order_number: '$workOrderDetails.work_order_number',
                    semifinished_id: 1,
                    product_id: '$product.product_id',
                    name: '$productDetails.name',
                    product: {
                        product_id: '$product.product_id',
                        code: '$product.code', // Include code
                        po_quantity: '$product.po_quantity',
                        achieved_quantity: '$product.achieved_quantity',
                        rejected_quantity: '$product.rejected_quantity',
                        recycled_quantity: '$product.recycled_quantity'
                    },
                    po_quantity: '$product.po_quantity',
                    achieved_quantity: '$product.achieved_quantity',
                    rejected_quantity: '$product.rejected_quantity',
                    recycled_quantity: '$product.recycled_quantity',
                    process_name: 1,
                    date: 1,
                    status: 1,
                    created_by: '$createdByDetails.username',
                    updated_by: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1,
                    int_work_order_id: '$internalWorkOrderDetails.int_work_order_id',
                }
            },
            // Step 7: Sort by createdAt in descending order to show latest data first
            {
                $sort: {
                    createdAt: -1
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

// const getProductionsByProcess_22_07_2025_11PM = asyncHandler(async (req, res) => {
//     try {
//       // 1. Get the process name from query parameters
//       const { process } = req.query;
//       if (!process) {
//         throw new ApiError(400, 'Process name is required in query parameters (e.g., ?process=cutting)');
//       }

//       // 2. Validate the process name
//       const processName = process.toLowerCase();
//       const validProcesses = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
//       if (!validProcesses.includes(processName)) {
//         throw new ApiError(400, `Invalid process name. Allowed values are: ${validProcesses.join(', ')}`);
//       }

//       // 3. Get all productions for the product (across all processes)
//       const productions = await falconProduction.aggregate([
//         {
//           $match: {
//             'product.product_id': { $exists: true, $ne: null },
//           },
//         },
//         {
//           $lookup: {
//             from: 'falconjoborders',
//             localField: 'job_order',
//             foreignField: '_id',
//             as: 'jobOrderDetails',
//           },
//         },
//         { $unwind: '$jobOrderDetails' },
//         {
//           $lookup: {
//             from: 'falconworkorders',
//             localField: 'jobOrderDetails.work_order_number',
//             foreignField: '_id',
//             as: 'workOrderDetails',
//           },
//         },
//         { $unwind: '$workOrderDetails' },
//         {
//           $lookup: {
//             from: 'falconproducts',
//             localField: 'product.product_id',
//             foreignField: '_id',
//             as: 'productDetails',
//           },
//         },
//         { $unwind: '$productDetails' },
//         {
//           $lookup: {
//             from: 'users',
//             localField: 'created_by',
//             foreignField: '_id',
//             as: 'createdByDetails',
//           },
//         },
//         { $unwind: '$createdByDetails' },
//         // Group by product to see all processes for each product
//         {
//           $group: {
//             _id: '$product.product_id',
//             productName: { $first: '$productDetails.name' },
//             workOrderNumber: { $first: '$workOrderDetails.work_order_number' },
//             processes: {
//               $push: {
//                 processId: '$_id',
//                 processName: '$process_name',
//                 status: '$status',
//                 availableQuantity: '$available_quantity',
//                 date: '$date',
//                 createdAt: '$createdAt'
//               }
//             },
//             currentProcess: { $first: '$process_name' } // The process we're currently viewing
//           }
//         },
//         // Filter to only show products that have the requested process
//         {
//           $match: {
//             'processes.processName': processName
//           }
//         },
//         // Sort processes in the correct workflow order
//         {
//           $addFields: {
//             sortedProcesses: {
//               $let: {
//                 vars: {
//                   processOrder: ['cutting', 'machining', 'assembling', 'glass fixing / glazing']
//                 },
//                 in: {
//                   $map: {
//                     input: '$$processOrder',
//                     as: 'proc',
//                     in: {
//                       $let: {
//                         vars: {
//                           matchedProcess: {
//                             $arrayElemAt: [
//                               {
//                                 $filter: {
//                                   input: '$processes',
//                                   as: 'p',
//                                   cond: { $eq: ['$$p.processName', '$$proc'] }
//                                 }
//                               },
//                               0
//                             ]
//                           }
//                         },
//                         in: {
//                           $ifNull: [
//                             '$$matchedProcess',
//                             {
//                               processName: '$$proc',
//                               status: 'Pending',
//                               availableQuantity: 0
//                             }
//                           ]
//                         }
//                       }
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         },
//         // Project the final output
//         {
//           $project: {
//             _id: 0,
//             productId: '$_id',
//             productName: 1,
//             workOrderNumber: 1,
//             currentProcess: 1,
//             processes: '$sortedProcesses',
//             // Show only relevant statuses for the current process view
//             filteredProcesses: {
//               $filter: {
//                 input: '$sortedProcesses',
//                 as: 'proc',
//                 cond: { $eq: ['$$proc.processName', processName] }
//               }
//             }
//           }
//         }
//       ]);

//       if (productions.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: `No production records found for process: ${process}`,
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         message: `Production records fetched successfully for process: ${process}`,
//         data: productions,
//       });
//     } catch (error) {
//       console.error('Error in getProductionsByProcess:', error);
//       throw error;
//     }
// });


// const startProduction11 = asyncHandler(async (req, res) => {
//     try {
//         const { id } = req.params; // Get production ID from URL
//         const { achieved_quantity } = req.body; // Optional: achieved_quantity from request body
//         console.log("achieved_quantity", achieved_quantity);
//         const userId = req.user?._id; // Assume user ID from authenticated user (e.g., JWT middleware)

//         // Validate inputs
//         if (!id) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Production ID is required',
//             });
//         }
//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'User not authenticated',
//             });
//         }
//         // Validate achieved_quantity if provided
//         if (achieved_quantity !== undefined) {
//             if (typeof achieved_quantity !== 'number' || achieved_quantity < 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Achieved quantity must be a non-negative number',
//                 });
//             }
//         }

//         // Find the production record
//         const production = await falconProduction.findById(id);
//         if (!production) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Production record not found',
//             });
//         }

//         // Validate achieved_quantity against po_quantity if provided
//         if (achieved_quantity !== undefined && achieved_quantity > production.product.po_quantity) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Achieved quantity (${achieved_quantity}) cannot exceed PO quantity (${production.product.po_quantity})`,
//             });
//         }

//         // Handle based on current status
//         let message = '';
//         if (production.status === 'Pending') {
//             // Start production
//             production.status = 'In Progress';
//             production.started_at = new Date();
//             production.updated_by = userId;
//             message = 'Production started successfully';
//         } else if (production.status === 'In Progress' || production.status === 'Pending QC') {
//             // Allow updating achieved_quantity
//             if (achieved_quantity === undefined) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Achieved quantity is required to update an In Progress production',
//                 });
//             }
//             message = 'Achieved quantity updated successfully';
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: `Production is in ${production.status} status and cannot be started or updated`,
//             });
//         }

//         // Update achieved_quantity if provided
//         if (achieved_quantity !== undefined) {
//             production.product.achieved_quantity = production.product.achieved_quantity + achieved_quantity;
//             production.updated_by = userId;
//         }

//         await production.save();

//         // Format response
//         return res.status(200).json({
//             success: true,
//             message,
//             data: {
//                 production_id: production._id,
//                 job_order: production.job_order,
//                 semifinished_id: production.semifinished_id,
//                 product: {
//                     product_id: production.product.product_id,
//                     po_quantity: production.product.po_quantity,
//                     achieved_quantity: production.product.achieved_quantity,
//                     rejected_quantity: production.product.rejected_quantity,
//                     recycled_quantity: production.product.recycled_quantity,
//                 },
//                 process_name: production.process_name,
//                 date: production.date.toISOString().split('T')[0],
//                 status: production.status,
//                 started_at: production.started_at ? production.started_at.toISOString() : null,
//                 updated_by: production.updated_by,
//                 created_at: production.createdAt.toISOString(),
//                 updated_at: production.updatedAt.toISOString(),
//             },
//         });
//     } catch (error) {
//         console.error('Error in startProduction:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error processing production: ' + error.message,
//         });
//     }
// });



// const startProduction22 = asyncHandler(async (req, res) => {
//     try {
//         console.log("came here in production");
//         const { id } = req.params; // Production ID from URL
//         const { achieved_quantity } = req.body; // Optional: achieved_quantity
//         const userId = req.user?._id; // Authenticated user ID

//         // Validate inputs
//         if (!id) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Production ID is required',
//             });
//         }
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid production ID format',
//             });
//         }
//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'User not authenticated',
//             });
//         }
//         if (achieved_quantity !== undefined && (typeof achieved_quantity !== 'number' || achieved_quantity < 0)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Achieved quantity must be a non-negative number',
//             });
//         }

//         // Find the production record
//         const production = await falconProduction.findById(id);
//         if (!production) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Production record not found',
//             });
//         }

//         // Define process order
//         const processOrder = ['cutting', 'machining', 'assembling', 'glass fixing/glazing'];
//         const currentProcess = production.process_name.toLowerCase();
//         console.log("currentProcess",currentProcess);
//         const currentProcessIndex = processOrder.indexOf(currentProcess);

//         // Validate process name
//         if (currentProcessIndex === -1) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Invalid process name: ${currentProcess}. Allowed values are: ${processOrder.join(', ')}`,
//             });
//         }

//         // Check if previous process has progress (if applicable)
//         let previousProcessAchievedQuantity = null;
//         if (currentProcessIndex > 0) {
//             const previousProcess = processOrder[currentProcessIndex - 1];
//             console.log("previousProcess",previousProcess);
//             console.log("job order", production.job_order);
//             console.log("semi finished", production.semifinished_id);

//             const previousProduction = await falconProduction.findOne({
//                 job_order: production.job_order,
//                 semifinished_id: production.semifinished_id,
//                 process_name: previousProcess,
//             });
//             console.log("previousProduction",previousProduction);

//             if (!previousProduction || previousProduction.product.achieved_quantity === 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Cannot start or update ${currentProcess} until ${previousProcess} has a non-zero achieved quantity.`,
//                 });
//             }
//             previousProcessAchievedQuantity = previousProduction.product.achieved_quantity;
//         }

//         // Validate achieved_quantity against previous process and po_quantity
//         if (achieved_quantity !== undefined) {
//             const newAchievedQuantity = production.product.achieved_quantity + achieved_quantity;
//             if (newAchievedQuantity > production.product.po_quantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Total achieved quantity (${newAchievedQuantity}) cannot exceed PO quantity (${production.product.po_quantity})`,
//                 });
//             }
//             if (previousProcessAchievedQuantity !== null && newAchievedQuantity > previousProcessAchievedQuantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Total achieved quantity (${newAchievedQuantity}) for ${currentProcess} cannot exceed achieved quantity (${previousProcessAchievedQuantity}) of ${processOrder[currentProcessIndex - 1]}`,
//                 });
//             }
//         }

//         // Handle based on current status
//         let message = '';
//         if (production.status === 'Pending') {
//             // Start production
//             production.status = 'In Progress';
//             production.started_at = new Date();
//             production.updated_by = userId;
//             message = 'Production started successfully';
//         } else if (production.status === 'In Progress' || production.status === 'Pending QC') {
//             // Allow updating achieved_quantity
//             if (achieved_quantity === undefined) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Achieved quantity is required to update an In Progress or Pending QC production',
//                 });
//             }
//             message = 'Achieved quantity updated successfully';
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: `Production is in ${production.status} status and cannot be started or updated`,
//             });
//         }

//         // Update achieved_quantity if provided
//         if (achieved_quantity !== undefined) {
//             production.product.achieved_quantity = production.product.achieved_quantity + achieved_quantity;
//             production.updated_by = userId;
//         }

//         await production.save();

//         // Format response
//         return res.status(200).json({
//             success: true,
//             message,
//             data: {
//                 production_id: production._id,
//                 job_order: production.job_order,
//                 semifinished_id: production.semifinished_id,
//                 product: {
//                     product_id: production.product.product_id,
//                     po_quantity: production.product.po_quantity,
//                     achieved_quantity: production.product.achieved_quantity,
//                 },
//                 process_name: production.process_name,
//                 date: production.date.toISOString().split('T')[0],
//                 status: production.status,
//                 started_at: production.started_at ? production.started_at.toISOString() : null,
//                 updated_by: production.updated_by,
//                 created_at: production.createdAt.toISOString(),
//                 updated_at: production.updatedAt.toISOString(),
//             },
//         });
//     } catch (error) {
//         console.error('Error in startProduction:', error);
//         return res.status(500).json({
//             success: false,
//             message: `Error processing production: ${error.message}`,
//         });
//     }
// });


// const startProduction33 = asyncHandler(async (req, res) => {
//     try {
//         console.log("came here in production");
//         const { id } = req.params; // Production ID from URL
//         const { achieved_quantity } = req.body; // Optional: achieved_quantity
//         console.log("achieved_quantity", achieved_quantity);
//         const userId = req.user?._id; // Authenticated user ID

//         // Validate inputs
//         if (!id) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Production ID is required',
//             });
//         }
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid production ID format',
//             });
//         }
//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'User not authenticated',
//             });
//         }
//         if (achieved_quantity !== undefined && (typeof achieved_quantity !== 'number' || achieved_quantity < 0)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Achieved quantity must be a non-negative number',
//             });
//         }

//         // Find the production record
//         const production = await falconProduction.findById(id);
//         if (!production) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Production record not found',
//             });
//         }

//         // Define process order
//         const processOrder = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
//         const currentProcess = production.process_name.toLowerCase();
//         console.log("currentProcess", currentProcess);
//         const currentProcessIndex = processOrder.indexOf(currentProcess);

//         // Validate process name
//         if (currentProcessIndex === -1) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Invalid process name: ${currentProcess}. Allowed values are: ${processOrder.join(', ')}`,
//             });
//         }

//         // Check if previous process has progress (if applicable and exists)
//         let previousProcessAchievedQuantity = null;
//         if (currentProcessIndex > 0) {
//             const previousProcess = processOrder[currentProcessIndex - 1];
//             // console.log("previousProcess", previousProcess);
//             // console.log("job order", production.job_order);
//             // console.log("semi finished", production.semifinished_id);

//             const previousProduction = await falconProduction.findOne({
//                 job_order: production.job_order,
//                 semifinished_id: production.semifinished_id,
//                 process_name: previousProcess,
//             });
//             // console.log("previousProduction", previousProduction);

//             // Only enforce progress check if previous process exists
//             if (previousProduction && previousProduction.product.achieved_quantity === 0) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Cannot start or update ${currentProcess} until ${previousProcess} has a non-zero achieved quantity.`,
//                 });
//             }
//             previousProcessAchievedQuantity = previousProduction ? previousProduction.product.achieved_quantity : null;
//         }

//         // Validate achieved_quantity against previous process (if it exists) and po_quantity
//         if (achieved_quantity !== undefined) {
//             console.log("production",production.product.achieved_quantity);
//             // const newAchievedQuantity = production.product.achieved_quantity + achieved_quantity;
//             const increment = achieved_quantity; // Treat input as increment
//             const newAchievedQuantity = production.product.achieved_quantity + increment;
//             console.log("newAchievedQuantity***",newAchievedQuantity);
//             if (newAchievedQuantity > production.product.po_quantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Total achieved quantity (${newAchievedQuantity}) cannot exceed PO quantity (${production.product.po_quantity})`,
//                 });
//             }
//             if (previousProcessAchievedQuantity !== null && newAchievedQuantity > previousProcessAchievedQuantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Total achieved quantity (${newAchievedQuantity}) for ${currentProcess} cannot exceed achieved quantity (${previousProcessAchievedQuantity}) of ${processOrder[currentProcessIndex - 1]}`,
//                 });
//             }
//         }

//         // Handle based on current status
//         let message = '';
//         // if (production.status === 'Pending') {
//         //     // Start production
//         //     production.status = 'In Progress';
//         //     production.started_at = new Date();
//         //     production.updated_by = userId;
//         //     message = 'Production started successfully';
//         // } else if (production.status === 'In Progress' || production.status === 'Pending QC') {
//         //     // Allow updating achieved_quantity
//         //     if (achieved_quantity === undefined) {
//         //         return res.status(400).json({
//         //             success: false,
//         //             message: 'Achieved quantity is required to update an In Progress or Pending QC production',
//         //         });
//         //     }
//         //     message = 'Achieved quantity updated successfully';
//         // } else {
//         //     return res.status(400).json({
//         //         success: false,
//         //         message: `Production is in ${production.status} status and cannot be started or updated`,
//         //     });
//         // }

//         if (production.status === 'Pending') {
//             if (achieved_quantity !== undefined) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Cannot update achieved quantity before starting the production.',
//                 });
//             }

//             production.status = 'In Progress';
//             production.started_at = new Date();
//             production.updated_by = userId;
//             message = 'Production started successfully';
//         } else if (production.status === 'In Progress' || production.status === 'Pending QC') {
//             if (achieved_quantity === undefined) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Achieved quantity is required to update an In Progress or Pending QC production',
//                 });
//             }

//             // Check limits
//             const newAchievedQuantity = production.product.achieved_quantity + achieved_quantity;
//             console.log("newAchievedQuantity",newAchievedQuantity);

//             if (newAchievedQuantity > production.product.po_quantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Total achieved quantity (${newAchievedQuantity}) cannot exceed PO quantity (${production.product.po_quantity})`,
//                 });
//             }
//             if (previousProcessAchievedQuantity !== null && newAchievedQuantity > previousProcessAchievedQuantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Total achieved quantity (${newAchievedQuantity}) for ${currentProcess} cannot exceed achieved quantity (${previousProcessAchievedQuantity}) of ${processOrder[currentProcessIndex - 1]}`,
//                 });
//             }

//             production.product.achieved_quantity = newAchievedQuantity;
//             production.updated_by = userId;
//             message = 'Achieved quantity updated successfully';
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: `Production is in ${production.status} status and cannot be started or updated`,
//             });
//         }


//         // Update achieved_quantity if provided
//         if (achieved_quantity !== undefined) {
//             production.product.achieved_quantity = production.product.achieved_quantity + achieved_quantity;
//             production.updated_by = userId;
//         }

//         await production.save();

//         // Format response
//         return res.status(200).json({
//             success: true,
//             message,
//             data: {
//                 production_id: production._id,
//                 job_order: production.job_order,
//                 semifinished_id: production.semifinished_id,
//                 product: {
//                     product_id: production.product.product_id,
//                     po_quantity: production.product.po_quantity,
//                     achieved_quantity: production.product.achieved_quantity,
//                 },
//                 process_name: production.process_name,
//                 date: production.date.toISOString().split('T')[0],
//                 status: production.status,
//                 started_at: production.started_at ? production.started_at.toISOString() : null,
//                 updated_by: production.updated_by,
//                 created_at: production.createdAt.toISOString(),
//                 updated_at: production.updatedAt.toISOString(),
//             },
//         });
//     } catch (error) {
//         console.error('Error in startProduction:', error);
//         return res.status(500).json({
//             success: false,
//             message: `Error processing production: ${error.message}`,
//         });
//     }
// });


const startProduction_07_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params; // Production ID
        const { achieved_quantity } = req.body; // Quantity to increment
        const userId = req.user?._id;

        // Input validation
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Production ID is required',
            });
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        if (
            achieved_quantity !== undefined &&
            (typeof achieved_quantity !== 'number' || achieved_quantity < 0)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Achieved quantity must be a non-negative number',
            });
        }

        // Fetch production record
        const production = await falconProduction.findById(id);
        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        const processOrder = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
        const currentProcess = production.process_name.toLowerCase();
        const currentProcessIndex = processOrder.indexOf(currentProcess);

        if (currentProcessIndex === -1) {
            return res.status(400).json({
                success: false,
                message: `Invalid process name: ${currentProcess}`,
            });
        }

        // Check previous process
        let previousProcessAchievedQuantity = null;
        if (currentProcessIndex > 0) {
            const previousProcess = processOrder[currentProcessIndex - 1];
            const previousProduction = await falconProduction.findOne({
                job_order: production.job_order,
                semifinished_id: production.semifinished_id,
                process_name: previousProcess,
            });

            if (previousProduction && previousProduction.product.achieved_quantity === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot start or update ${currentProcess} until ${previousProcess} has non-zero achieved quantity.`,
                });
            }

            previousProcessAchievedQuantity = previousProduction
                ? previousProduction.product.achieved_quantity
                : null;
        }

        // Handle "start" only
        if (production.status === 'Pending') {
            if (achieved_quantity !== undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot update achieved quantity before starting the production.',
                });
            }

            production.status = 'In Progress';
            production.started_at = new Date();
            production.updated_by = userId;

            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Production started successfully',
                data: {
                    production_id: production._id,
                    status: production.status,
                    started_at: production.started_at,
                },
            });
        }

        // Handle "update" quantity
        if (production.status === 'In Progress' || production.status === 'Pending QC') {
            if (achieved_quantity === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Achieved quantity is required for updating production',
                });
            }

            const currentAchieved = production.product.achieved_quantity;
            const newAchieved = currentAchieved + achieved_quantity;

            if (newAchieved > production.product.po_quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Achieved quantity (${newAchieved}) exceeds PO quantity (${production.product.po_quantity})`,
                });
            }

            if (
                previousProcessAchievedQuantity !== null &&
                newAchieved > previousProcessAchievedQuantity
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Achieved quantity (${newAchieved}) cannot exceed ${previousProcessAchievedQuantity} of previous process`,
                });
            }

            production.product.achieved_quantity = newAchieved;
            production.updated_by = userId;

            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Achieved quantity updated successfully',
                data: {
                    production_id: production._id,
                    achieved_quantity: newAchieved,
                    status: production.status,
                },
            });
        }

        return res.status(400).json({
            success: false,
            message: `Production is in ${production.status} status and cannot be started or updated`,
        });
    } catch (error) {
        console.error('Error in startProduction:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
        });
    }
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////









const startProduction_29_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params; // Production ID
        const { achieved_quantity } = req.body; // Quantity to increment
        const userId = req.user?._id;

        // Input validation
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Production ID is required',
            });
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        if (
            achieved_quantity !== undefined &&
            (typeof achieved_quantity !== 'number' || achieved_quantity < 0)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Achieved quantity must be a non-negative number',
            });
        }

        // Fetch production record
        const production = await falconProduction.findById(id);
        console.log("production", production);

        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        const currentProcess = production.process_name.toLowerCase();
        const currentIndex = production.process_sequence.current.index;

        if (currentIndex === undefined) {
            return res.status(400).json({
                success: false,
                message: `Invalid process sequence for ${currentProcess}.`,
            });
        }

        // Check previous process completion
        let previousProcessAchievedQuantity = null;
        if (currentIndex > 0 && production.process_sequence.previous) {
            const previousProduction = await falconProduction.findOne({
                job_order: production.job_order,
                semifinished_id: production.semifinished_id,
                'process_sequence.current.index': currentIndex - 1,
            });

            if (!previousProduction || previousProduction.product.achieved_quantity === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot start or update ${currentProcess} until the previous process (index ${currentIndex - 1}, ${previousProduction?.process_name || 'unknown'}) has non-zero achieved quantity.`,
                });
            }

            previousProcessAchievedQuantity = previousProduction
                ? previousProduction.product.achieved_quantity
                : null;
        }

        // Handle "start" only
        if (production.status === 'Pending') {
            if (achieved_quantity !== undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot update achieved quantity before starting the production.',
                });
            }

            production.status = 'In Progress';
            production.started_at = new Date();
            production.updated_by = userId;

            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Production started successfully',
                data: {
                    production_id: production._id,
                    status: production.status,
                    started_at: production.started_at,
                },
            });
        }

        // Handle "update" quantity
        if (production.status === 'In Progress' || production.status === 'Pending QC') {
            if (achieved_quantity === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Achieved quantity is required for updating production',
                });
            }

            const currentAchieved = production.product.achieved_quantity;
            const newAchieved = currentAchieved + achieved_quantity;

            if (newAchieved > production.product.po_quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Achieved quantity (${newAchieved}) exceeds PO quantity (${production.product.po_quantity})`,
                });
            }

            // Validate against previous process quantity
            if (currentIndex > 0 && production.process_sequence.previous && previousProcessAchievedQuantity !== null) {
                if (newAchieved > previousProcessAchievedQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Achieved quantity (${newAchieved}) cannot exceed ${previousProcessAchievedQuantity} of the previous process (index ${currentIndex - 1}, ${production.process_sequence.previous.name}).`,
                    });
                }
            }

            production.product.achieved_quantity = newAchieved;
            production.updated_by = userId;

            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Achieved quantity updated successfully',
                data: {
                    production_id: production._id,
                    achieved_quantity: newAchieved,
                    status: production.status,
                },
            });
        }

        return res.status(400).json({
            success: false,
            message: `Production is in ${production.status} status and cannot be started or updated`,
        });
    } catch (error) {
        console.error('Error in startProduction:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
        });
    }
});










const startProduction = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params; // Production ID
        const { achieved_quantity } = req.body; // Quantity to increment
        const userId = req.user?._id;

        // Input validation
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Production ID is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        if (achieved_quantity === undefined || typeof achieved_quantity !== 'number' || achieved_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Achieved quantity must be a non-negative number',
            });
        }

        // Fetch production record
        const production = await falconProduction.findById(id);
        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        const currentProcess = production.process_name.toLowerCase();
        const currentIndex = production.process_sequence.current.index;
        if (currentIndex === undefined) {
            return res.status(400).json({
                success: false,
                message: `Invalid process sequence for ${currentProcess}.`,
            });
        }

        // Check previous process completion - find the actual previous process that exists
        // IMPORTANT: User can select any processes in sequence (e.g., Machining → Assembling → Glass Fixing)
        // They don't have to start from Cutting. So we only validate if there IS an actual previous process.
        let previousProcessAchievedQuantity = null;
        let previousProduction = null;
        
        // Find all productions for this semi-finished product to check if there's a previous process
        const allProductionsForSemi = await falconProduction.find({
            job_order: production.job_order,
            semifinished_id: production.semifinished_id,
        }).sort({ 'process_sequence.current.index': 1 });

        // Find the IMMEDIATE previous process (the one directly before the current process)
        // We need the CLOSEST process before current, not just ANY process before it
        const previousProcesses = allProductionsForSemi.filter(p => 
            p.process_sequence.current.index < currentIndex && 
            p._id.toString() !== production._id.toString()
        );
        
        // Get the last one (highest index) = immediate previous
        previousProduction = previousProcesses.length > 0 
            ? previousProcesses[previousProcesses.length - 1] 
            : null;

        // Only validate if there IS a previous process
        if (previousProduction) {
            // Previous process exists - check if it has non-zero achieved quantity
            if (previousProduction.product.achieved_quantity === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot update ${currentProcess} until the previous process (${previousProduction.process_name}) has non-zero achieved quantity.`,
                });
            }
            previousProcessAchievedQuantity = previousProduction.product.achieved_quantity;
            console.log(`Previous process found: ${previousProduction.process_name} with quantity: ${previousProcessAchievedQuantity}`);
            
            // SEQUENTIAL RECYCLING VALIDATION
            // IMPORTANT DISTINCTION:
            // - RECYCLED items (recycled_quantity): Items that will be REPROCESSED - must flow sequentially
            // - REJECTED items (rejected_quantity): Items that are DISCARDED - no reprocessing needed
            // 
            // This validation ONLY applies to recycled_quantity, not rejected_quantity
            // INCREMENTAL FLOW: Items can flow through processes incrementally
            // Example: If Machining processes 5 items (10→5 recycled), those 5 can flow to Assembling
            // Rule: Current process's remaining recycled CANNOT be LESS than previous process's recycled
            if (production.product.recycled_quantity > 0) {
                const previousRecycledQty = previousProduction.product.recycled_quantity || 0;
                const currentRecycledQty = production.product.recycled_quantity;
                
                // Calculate what the recycled quantity would be after this update
                const recycledAfterUpdate = achieved_quantity >= currentRecycledQty 
                    ? 0 
                    : currentRecycledQty - achieved_quantity;
                
                // Current process cannot have LESS recycled than previous process
                // This ensures items flow sequentially: previous must process first
                if (recycledAfterUpdate < previousRecycledQty) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot update ${currentProcess} by ${achieved_quantity}. This would leave ${recycledAfterUpdate} recycled items, but previous process (${previousProduction.process_name}) still has ${previousRecycledQty} pending. You can update by at most ${currentRecycledQty - previousRecycledQty} to maintain sequential flow.`,
                    });
                }
                
                console.log(`Sequential recycling check passed: After update, ${currentProcess} will have ${recycledAfterUpdate} recycled (previous has ${previousRecycledQty}).`);
            }
            // Note: rejected_quantity is NOT checked here because rejected items are discarded, not reprocessed
        }

        // If production is "Pending", change status to "In Progress" and update quantity
        if (production.status === 'Pending') {
            production.status = 'In Progress';
            production.started_at = new Date();
            production.updated_by = userId;
        }

        // Update achieved quantity
        if (production.status === 'In Progress' || production.status === 'Pending QC') {
            const currentAchieved = production.product.achieved_quantity;
            const newAchieved = currentAchieved + achieved_quantity;

            if (newAchieved > production.product.po_quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Achieved quantity (${newAchieved}) exceeds PO quantity (${production.product.po_quantity})`,
                });
            }

            // Validate against previous process quantity (only if a previous process exists)
            if (previousProduction && previousProcessAchievedQuantity !== null) {
                if (newAchieved > previousProcessAchievedQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Achieved quantity (${newAchieved}) cannot exceed ${previousProcessAchievedQuantity} of the previous process (${previousProduction.process_name}).`,
                    });
                }
            } else if (!previousProduction) {
                // No previous process exists - this is the first selected process in the sequence
                console.log(`No previous process found - ${currentProcess} is the first process in this sequence. Update allowed.`);
            }

            production.product.achieved_quantity = newAchieved;
            production.updated_by = userId;
            
            // Update recycled quantities tracking
            // When items are recycled back to an earlier process, they create a "debt" that must be processed sequentially
            // As items flow through each process again, we reduce the recycled_quantity accordingly
            if (production.product.recycled_quantity > 0) {
                if (achieved_quantity >= production.product.recycled_quantity) {
                    // All recycled items for this process have been reprocessed
                    production.product.recycled_quantity = 0;
                    console.log(`Cleared all recycled quantity for ${production.process_name}`);
                } else {
                    // Partially processed recycled items
                    production.product.recycled_quantity -= achieved_quantity;
                    console.log(`Reducing recycled quantity for ${production.process_name}: ${production.product.recycled_quantity} remaining`);
                }
            }
            
            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Achieved quantity updated successfully',
                data: {
                    production_id: production._id,
                    achieved_quantity: newAchieved,
                    status: production.status,
                },
            });
        }

        return res.status(400).json({
            success: false,
            message: `Production is in ${production.status} status and cannot be updated`,
        });
    } catch (error) {
        console.error('Error in startProduction:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
        });
    }
});












///////////////////////////////////////////////////////////////////////////////////////////////////////////////////






const startProduction_22_07_2025 = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params; // Production ID
        const { achieved_quantity } = req.body; // Quantity to increment
        const userId = req.user?._id;

        // Input validation
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Production ID is required',
            });
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        if (
            achieved_quantity !== undefined &&
            (typeof achieved_quantity !== 'number' || achieved_quantity < 0)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Achieved quantity must be a non-negative number',
            });
        }

        // Fetch production record
        const production = await falconProduction.findById(id);
        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        const processOrder = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
        const currentProcess = production.process_name.toLowerCase();
        const currentProcessIndex = processOrder.indexOf(currentProcess);

        if (currentProcessIndex === -1) {
            return res.status(400).json({
                success: false,
                message: `Invalid process name: ${currentProcess}`,
            });
        }

        // Check previous process
        let previousProcessAchievedQuantity = null;
        if (currentProcessIndex > 0) {
            const previousProcess = processOrder[currentProcessIndex - 1];
            const previousProduction = await falconProduction.findOne({
                job_order: production.job_order,
                semifinished_id: production.semifinished_id,
                'product.code': production.product.code, // Match product code
                process_name: previousProcess,
            });

            if (previousProduction && previousProduction.product.achieved_quantity === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot start or update ${currentProcess} until ${previousProcess} has non-zero achieved quantity for product code ${production.product.code}.`,
                });
            }

            previousProcessAchievedQuantity = previousProduction
                ? previousProduction.product.achieved_quantity
                : null;
        }

        // Handle "start" only
        if (production.status === 'Pending') {
            if (achieved_quantity !== undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot update achieved quantity before starting the production.',
                });
            }

            production.status = 'In Progress';
            production.started_at = new Date();
            production.updated_by = userId;

            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Production started successfully',
                data: {
                    production_id: production._id,
                    status: production.status,
                    started_at: production.started_at,
                },
            });
        }

        // Handle "update" quantity
        if (production.status === 'In Progress' || production.status === 'Pending QC') {
            if (achieved_quantity === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Achieved quantity is required for updating production',
                });
            }

            const currentAchieved = production.product.achieved_quantity;
            const newAchieved = currentAchieved + achieved_quantity;

            if (newAchieved > production.product.po_quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Achieved quantity (${newAchieved}) exceeds PO quantity (${production.product.po_quantity})`,
                });
            }

            if (
                previousProcessAchievedQuantity !== null &&
                newAchieved > previousProcessAchievedQuantity
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Achieved quantity (${newAchieved}) cannot exceed ${previousProcessAchievedQuantity} of previous process for product code ${production.product.code}`,
                });
            }

            production.product.achieved_quantity = newAchieved;
            production.updated_by = userId;

            await production.save();

            return res.status(200).json({
                success: true,
                message: 'Achieved quantity updated successfully',
                data: {
                    production_id: production._id,
                    achieved_quantity: newAchieved,
                    status: production.status,
                },
            });
        }

        return res.status(400).json({
            success: false,
            message: `Production is in ${production.status} status and cannot be started or updated`,
        });
    } catch (error) {
        console.error('Error in startProduction:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
        });
    }
});

//   const startProduction_22_07_2025_11AM  = asyncHandler(async (req, res) => {
//     try {
//       const { id } = req.params; // Production ID
//       console.log("id", id);
//       const { achieved_quantity } = req.body; // Quantity to increment
//       const userId = req.user?._id;

//       // Input validation
//       if (!id || !mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({
//           success: false,
//           message: 'Valid Production ID is required',
//         });
//       }

//       if (!userId) {
//         return res.status(401).json({
//           success: false,
//           message: 'User not authenticated',
//         });
//       }

//       if (
//         achieved_quantity !== undefined &&
//         (typeof achieved_quantity !== 'number' || achieved_quantity < 0)
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: 'Achieved quantity must be a non-negative number',
//         });
//       }

//       // Fetch production record
//       const production = await falconProduction.findById(id);
//       console.log("production", production);
//       if (!production) {
//         return res.status(404).json({
//           success: false,
//           message: 'Production record not found',
//         });
//       }

//       // Verify semifinished_id consistency (debugging)
//       console.log("production.semifinished_id", production.semifinished_id);

//       const processOrder = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
//       const currentProcess = production.process_name.toLowerCase();
//       console.log("currentProcess", currentProcess);
//       const currentProcessIndex = processOrder.indexOf(currentProcess);

//       if (currentProcessIndex === -1) {
//         return res.status(400).json({
//           success: false,
//           message: `Invalid process name: ${currentProcess}`,
//         });
//       }

//       console.log("production.job_order", production.job_order);
//       console.log("production.product.product_id", production.product.product_id);
//       console.log("production.product.code", production.product.code);

//       // Fetch the internal work order to get the process list for this product
//       const internalWorkOrder = await falconInternalWorkOrder.findOne({
//         job_order_id: production.job_order.toString(),
//         'products.product': production.product.product_id.toString(),
//         'products.code': production.product.code,
//       });
//       console.log("internalWorkOrder", internalWorkOrder);

//       if (!internalWorkOrder) {
//         return res.status(404).json({
//           success: false,
//           message: `Internal work order not found for job order ${production.job_order} and product ${production.product.product_id} (code: ${production.product.code})`,
//         });
//       }

//       // Find the product in the internal work order
//       const productDetails = internalWorkOrder.products.find(
//         (p) => p.product.toString() === production.product.product_id.toString() && p.code === production.product.code
//       );
//       console.log("productDetails", productDetails);

//       if (!productDetails) {
//         return res.status(404).json({
//           success: false,
//           message: `Product ${production.product.product_id} (code: ${production.product.code}) not found in internal work order`,
//         });
//       }

//       // Get the process list for this product from semifinished_details
//       const processList = productDetails.semifinished_details
//         .find((sf) => sf.semifinished_id === production.semifinished_id)
//         ?.processes.map((p) => p.name.toLowerCase()) || [];

//       if (!processList.includes(currentProcess)) {
//         return res.status(400).json({
//           success: false,
//           message: `Process ${currentProcess} is not associated with semifinished_id ${production.semifinished_id} for product ${production.product.product_id} (code: ${production.product.code})`,
//         });
//       }

//       const currentProcessIndexInProduct = processList.indexOf(currentProcess);

//       // Check previous process in the product's process list
//       let previousProcessAchievedQuantity = null;
//       if (currentProcessIndexInProduct > 0) {
//         const previousProcess = processList[currentProcessIndexInProduct - 1];
//         const previousProduction = await falconProduction.findOne({
//           job_order: production.job_order,
//           semifinished_id: production.semifinished_id,
//           'product.product_id': production.product.product_id,
//           'product.code': production.product.code,
//           process_name: previousProcess,
//         });

//         if (previousProduction && previousProduction.product.achieved_quantity === 0) {
//           return res.status(400).json({
//             success: false,
//             message: `Cannot start or update ${currentProcess} until ${previousProcess} has non-zero achieved quantity for product ${production.product.product_id} (code: ${production.product.code})`,
//           });
//         }

//         previousProcessAchievedQuantity = previousProduction
//           ? previousProduction.product.achieved_quantity
//           : null;
//       }

//       // Handle "start" only
//       if (production.status === 'Pending') {
//         if (achieved_quantity !== undefined) {
//           return res.status(400).json({
//             success: false,
//             message: 'Cannot update achieved quantity before starting the production.',
//           });
//         }

//         production.status = 'In Progress';
//         production.started_at = new Date();
//         production.updated_by = userId;

//         await production.save();

//         return res.status(200).json({
//           success: true,
//           message: 'Production started successfully',
//           data: {
//             production_id: production._id,
//             status: production.status,
//             started_at: production.started_at,
//           },
//         });
//       }

//       // Handle "update" quantity
//       if (production.status === 'In Progress' || production.status === 'Pending QC') {
//         if (achieved_quantity === undefined) {
//           return res.status(400).json({
//             success: false,
//             message: 'Achieved quantity is required for updating production',
//           });
//         }

//         const currentAchieved = production.product.achieved_quantity;
//         const newAchieved = currentAchieved + achieved_quantity;

//         if (newAchieved > production.product.po_quantity) {
//           return res.status(400).json({
//             success: false,
//             message: `Achieved quantity (${newAchieved}) exceeds PO quantity (${production.product.po_quantity}) for product ${production.product.product_id} (code: ${production.product.code})`,
//           });
//         }

//         if (
//           previousProcessAchievedQuantity !== null &&
//           newAchieved > previousProcessAchievedQuantity
//         ) {
//           return res.status(400).json({
//             success: false,
//             message: `Achieved quantity (${newAchieved}) cannot exceed ${previousProcessAchievedQuantity} of previous process (${previousProcess}) for product ${production.product.product_id} (code: ${production.product.code})`,
//           });
//         }

//         production.product.achieved_quantity = newAchieved;
//         production.updated_by = userId;

//         await production.save();

//         return res.status(200).json({
//           success: true,
//           message: 'Achieved quantity updated successfully',
//           data: {
//             production_id: production._id,
//             achieved_quantity: newAchieved,
//             status: production.status,
//             semifinished_id: production.semifinished_id, // Added for verification
//           },
//         });
//       }

//       return res.status(400).json({
//         success: false,
//         message: `Production is in ${production.status} status and cannot be started or updated`,
//       });
//     } catch (error) {
//       console.error('Error in startProduction:', error);
//       return res.status(500).json({
//         success: false,
//         message: `Server error: ${error.message}`,
//       });
//     }
//   });





const productionQCCheck_08_08_2025 = asyncHandler(async (req, res) => {
    try {
        console.log("came here in qc");
        const { productionId } = req.params;
        const { rejected_quantity, process_name, remarks } = req.body;
        const userId = req.user?._id;

        // Validate inputs
        if (!productionId) {
            return res.status(400).json({
                success: false,
                message: 'Production ID is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        if (typeof rejected_quantity !== 'number' || rejected_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejected quantity must be a non-negative number',
            });
        }
        if (!process_name || typeof process_name !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Process name is required and must be a string',
            });
        }

        // Find the production record
        const production = await falconProduction.findById(productionId);
        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        // Check if production is in a valid state for QC
        if (production.status !== 'In Progress') {
            return res.status(400).json({
                success: false,
                message: `Production must be in In Progress status for QC check (current status: ${production.status})`,
            });
        }

        // Validate rejected_quantity against achieved_quantity
        if (rejected_quantity > production.product.achieved_quantity) {
            return res.status(400).json({
                success: false,
                message: `Rejected quantity (${rejected_quantity}) cannot exceed achieved quantity (${production.product.achieved_quantity})`,
            });
        }
        console.log("production", production);

        // Create a new QC Check record
        const qcCheck = new falconQCCheck({
            production: productionId,
            job_order: production.job_order,
            product_id: production.product.product_id,
            semifinished_id: production.semifinished_id,
            rejected_quantity,
            recycled_quantity: 0, // Not provided in Production module, default to 0
            process_name,
            from_process_name: production.process_name, // From which process the rejection is coming
            remarks,
            checked_by: userId,
            updated_by: userId,
        });

        await qcCheck.save();

        // Aggregate rejected and recycled quantities from all QC checks for this production
        const qcChecks = await falconQCCheck.find({ production: productionId });
        const totalRejected = qcChecks.reduce((sum, check) => sum + check.rejected_quantity, 0);
        const totalRecycled = qcChecks.reduce((sum, check) => sum + check.recycled_quantity, 0);

        // Update production record
        production.product.rejected_quantity = totalRejected;
        production.product.recycled_quantity = totalRecycled;
        production.qc_checked_by = userId;
        production.updated_by = userId;
        production.status = rejected_quantity > 0 ? 'Pending QC' : production.status;

        await production.save();

        // Format response
        return res.status(200).json({
            success: true,
            message: 'QC check completed successfully',
            data: {
                qc_check_id: qcCheck._id,
                production_id: production._id,
                job_order: production.job_order,
                semifinished_id: production.semifinished_id,
                product: {
                    product_id: production.product.product_id,
                    po_quantity: production.product.po_quantity,
                    achieved_quantity: production.product.achieved_quantity,
                    rejected_quantity: production.product.rejected_quantity,
                    recycled_quantity: production.product.recycled_quantity,
                },
                process_name,
                remarks,
                checked_by: userId,
                status: production.status,
                created_at: qcCheck.createdAt.toISOString(),
                updated_at: qcCheck.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error in production QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error performing QC check: ' + error.message,
        });
    }
});





const productionQCCheck1 = asyncHandler(async (req, res) => {
    try {
        console.log("came here in qc");
        const { productionId } = req.params;
        const { rejected_quantity, process_name, remarks } = req.body;
        const userId = req.user?._id;

        // Validate inputs
        if (!productionId) {
            return res.status(400).json({
                success: false,
                message: 'Production ID is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        if (typeof rejected_quantity !== 'number' || rejected_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejected quantity must be a non-negative number',
            });
        }
        // Allow process_name to be optional; use production's process_name for first process
        const effectiveProcessName = process_name || req.body.process_name_from_production || production.process_name;
        if (!effectiveProcessName || typeof effectiveProcessName !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Process name is required and must be a string',
            });
        }

        // Find the production record
        const production = await falconProduction.findById(productionId);
        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        // Check if production is in a valid state for QC
        if (production.status !== 'In Progress') {
            return res.status(400).json({
                success: false,
                message: `Production must be in In Progress status for QC check (current status: ${production.status})`,
            });
        }

        // Validate rejected_quantity against achieved_quantity
        if (rejected_quantity > production.product.achieved_quantity) {
            return res.status(400).json({
                success: false,
                message: `Rejected quantity (${rejected_quantity}) cannot exceed achieved quantity (${production.product.achieved_quantity})`,
            });
        }
        console.log("production", production);

        // Create a new QC Check record
        const qcCheck = new falconQCCheck({
            production: productionId,
            job_order: production.job_order,
            product_id: production.product.product_id,
            semifinished_id: production.semifinished_id,
            rejected_quantity,
            recycled_quantity: 0,
            process_name: effectiveProcessName, // To which process we're sending back
            from_process_name: production.process_name, // From which process the rejection is coming
            remarks,
            checked_by: userId,
            updated_by: userId,
        });

        await qcCheck.save();

        // Aggregate rejected and recycled quantities from all QC checks for this production
        const qcChecks = await falconQCCheck.find({ production: productionId });
        const totalRejected = qcChecks.reduce((sum, check) => sum + check.rejected_quantity, 0);
        const totalRecycled = qcChecks.reduce((sum, check) => sum + check.recycled_quantity, 0);

        // Update production record
        production.product.rejected_quantity = totalRejected;
        production.product.recycled_quantity = totalRecycled;
        production.qc_checked_by = userId;
        production.updated_by = userId;
        production.status = rejected_quantity > 0 ? 'Pending QC' : production.status;

        await production.save();

        return res.status(200).json({
            success: true,
            message: 'QC check completed successfully',
            data: {
                qc_check_id: qcCheck._id,
                production_id: production._id,
                job_order: production.job_order,
                semifinished_id: production.semifinished_id,
                product: {
                    product_id: production.product.product_id,
                    po_quantity: production.product.po_quantity,
                    achieved_quantity: production.product.achieved_quantity,
                    rejected_quantity: production.product.rejected_quantity,
                    recycled_quantity: production.product.recycled_quantity,
                },
                process_name: effectiveProcessName,
                remarks,
                checked_by: userId,
                status: production.status,
                created_at: qcCheck.createdAt.toISOString(),
                updated_at: qcCheck.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error in production QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error performing QC check: ' + error.message,
        });
    }
});

const productionQCCheck_09_09_2025 = asyncHandler(async (req, res) => {
    try {
        console.log("came here in qc");
        const { productionId } = req.params;
        const { rejected_quantity, process_name, remarks } = req.body;
        console.log("rejected_quantity",rejected_quantity);
        const userId = req.user?._id;

        // Validate inputs
        if (!productionId) {
            return res.status(400).json({
                success: false,
                message: 'Production ID is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        if (typeof rejected_quantity !== 'number' || rejected_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejected quantity must be a non-negative number',
            });
        }
        // Allow process_name to be optional; use production's process_name for first process
        const effectiveProcessName = process_name || req.body.process_name_from_production || req.body.process;
        if (!effectiveProcessName || typeof effectiveProcessName !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Process name is required and must be a string',
            });
        }

        // Find the production record
        const production = await falconProduction.findById(productionId);
        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        // Check if production is in a valid state for QC
        // if (production.status !== 'In Progress') {
        //     return res.status(400).json({
        //         success: false,
        //         message: `Production must be in In Progress status for QC check (current status: ${production.status})`,
        //     });
        // }

        // Validate rejected_quantity against achieved_quantity
        // console.log("rejected_quantity",rejected_quantity);
        // console.log("production.product.achieved_quantity",production.product.achieved_quantity);
        if (rejected_quantity > production.product.achieved_quantity) {
            return res.status(400).json({
                success: false,
                message: `Rejected quantity (${rejected_quantity}) cannot exceed achieved quantity (${production.product.achieved_quantity})`,
            });
        }

        // Subtract rejected_quantity from achieved_quantity
        production.product.achieved_quantity -= rejected_quantity;

        console.log("production after subtraction", production);


        // if (production.process_sequence.previous) {
        //     const previousProduction = await falconProduction.findOne({
        //         job_order: production.job_order,
        //         semifinished_id: production.semifinished_id,
        //         'process_sequence.current.name': production.process_sequence.previous.name,
        //     });

        //     if (previousProduction) {
        //         // Deduct rejected quantity from previous stage
        //         previousProduction.product.achieved_quantity -= rejected_quantity;
        //         // Ensure previous stage's achieved_quantity doesn't go below zero
        //         if (previousProduction.product.achieved_quantity < 0) {
        //             previousProduction.product.achieved_quantity = 0;
        //         }
        //         await previousProduction.save();
        //     }
        // }


        // Create a new QC Check record
       
       
       
        let currentProduction = production;
        while (currentProduction.process_sequence.previous) {
            const previousProduction = await falconProduction.findOne({
                job_order: currentProduction.job_order,
                semifinished_id: currentProduction.semifinished_id,
                'process_sequence.current.name': currentProduction.process_sequence.previous.name,
            });
            if (previousProduction) {
                // Deduct rejected quantity from previous stage
                previousProduction.product.achieved_quantity -= rejected_quantity;
                // Ensure previous stage's achieved_quantity doesn't go below zero
                if (previousProduction.product.achieved_quantity < 0) {
                    previousProduction.product.achieved_quantity = 0;
                }
                await previousProduction.save();
                currentProduction = previousProduction; // Move to the next previous process
            } else {
                break; // No more previous productions found
            }
        }
        
       
       
       
       
       
       
       
       
        const qcCheck = new falconQCCheck({
            production: productionId,
            job_order: production.job_order,
            product_id: production.product.product_id,
            semifinished_id: production.semifinished_id,
            rejected_quantity,
            recycled_quantity: 0,
            process_name: effectiveProcessName, // To which process we're sending back
            from_process_name: production.process_name, // From which process the rejection is coming
            remarks,
            checked_by: userId,
            updated_by: userId,
        });

        await qcCheck.save();

        // Aggregate rejected and recycled quantities from all QC checks for this production
        const qcChecks = await falconQCCheck.find({ production: productionId });
        console.log("qcChecks",qcChecks);
        const totalRejected = qcChecks.reduce((sum, check) => sum + check.rejected_quantity, 0);
        console.log("totalRejected",totalRejected);
        const totalRecycled = qcChecks.reduce((sum, check) => sum + check.recycled_quantity, 0);

        // Update production record with aggregated values
        production.product.rejected_quantity = totalRejected;
        production.product.recycled_quantity = totalRecycled;
        production.qc_checked_by = userId;
        production.updated_by = userId;
        production.status = rejected_quantity > 0 ? 'Pending QC' : production.status;

        await production.save();

        return res.status(200).json({
            success: true,
            message: 'QC check completed successfully',
            data: {
                qc_check_id: qcCheck._id,
                production_id: production._id,
                job_order: production.job_order,
                semifinished_id: production.semifinished_id,
                product: {
                    product_id: production.product.product_id,
                    po_quantity: production.product.po_quantity,
                    achieved_quantity: production.product.achieved_quantity,
                    rejected_quantity: production.product.rejected_quantity,
                    recycled_quantity: production.product.recycled_quantity,
                },
                process_name: effectiveProcessName,
                remarks,
                checked_by: userId,
                status: production.status,
                created_at: qcCheck.createdAt.toISOString(),
                updated_at: qcCheck.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error in production QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error performing QC check: ' + error.message,
        });
    }
});




const productionQCCheck = asyncHandler(async (req, res) => {
    try {
        console.log("came here in qc");
        const { productionId } = req.params;
        const { rejected_quantity, process_name, remarks, is_rejection } = req.body;
        console.log("rejected_quantity", rejected_quantity);
        console.log("is_rejection", is_rejection);
        const userId = req.user?._id;

        // Validate inputs
        if (!productionId) {
            return res.status(400).json({
                success: false,
                message: 'Production ID is required',
            });
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        if (typeof rejected_quantity !== 'number' || rejected_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejected quantity must be a non-negative number',
            });
        }

        // Allow process_name to be optional; use production's process_name for first process
        const effectiveProcessName = process_name || req.body.process_name_from_production || req.body.process;
        if (!effectiveProcessName || typeof effectiveProcessName !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Process name is required and must be a string',
            });
        }

        // Find the current production record
        const currentProduction = await falconProduction.findById(productionId);
        if (!currentProduction) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        // Validate rejected_quantity against achieved_quantity
        if (rejected_quantity > currentProduction.product.achieved_quantity) {
            return res.status(400).json({
                success: false,
                message: `Rejected quantity (${rejected_quantity}) cannot exceed achieved quantity (${currentProduction.product.achieved_quantity})`,
            });
        }

        // Subtract rejected_quantity from current production
        currentProduction.product.achieved_quantity -= rejected_quantity;
        if (currentProduction.product.achieved_quantity < 0) {
            currentProduction.product.achieved_quantity = 0;
        }

        // Fetch all productions for this semifinished_id, sorted by process sequence
        const allProductions = await falconProduction.find({
            job_order: currentProduction.job_order,
            semifinished_id: currentProduction.semifinished_id,
        }).sort({ 'process_sequence.current.index': 1 });

        let startIndex, endIndex;
        
        if (is_rejection) {
            // REJECTION PROCESS: Deduct from ALL processes for this semifinished product
            // When items are rejected, they affect the entire production chain - both previous and subsequent processes
            // Example: Reject 5 from Assembling → deduct from Machining, Assembling, AND Glass Fixing
            startIndex = 0; // Start from first process (usually Cutting)
            endIndex = allProductions.length - 1; // Go to LAST process (all processes affected)
            
            console.log(`REJECTION: Deducting ${rejected_quantity} from ALL processes (${allProductions.length} total)`);
            
            // Deduct from ALL processes (excluding current as already deducted)
            for (let i = startIndex; i <= endIndex; i++) {
                const productionToUpdate = allProductions[i];
                if (productionToUpdate._id.toString() !== currentProduction._id.toString()) {
                    console.log(`Updating process: ${productionToUpdate.process_name} (index ${i})`);
                    productionToUpdate.product.achieved_quantity -= rejected_quantity;
                    if (productionToUpdate.product.achieved_quantity < 0) {
                        productionToUpdate.product.achieved_quantity = 0;
                    }
                    // Note: rejected_quantity will be set from aggregated QC checks later
                    // This prevents double-counting and ensures all processes show the same cumulative rejected qty
                    await productionToUpdate.save();
                }
            }
            
        } else {
            // RECYCLE PROCESS: Deduct from selected process to current process
            console.log("=== RECYCLE PROCESS DEBUG ===");
            console.log("effectiveProcessName:", effectiveProcessName);
            console.log("currentProduction.process_name:", currentProduction.process_name);
            console.log("rejected_quantity:", rejected_quantity);
            console.log("allProductions count:", allProductions.length);
            allProductions.forEach((p, idx) => {
                console.log(`Production ${idx}: ${p.process_sequence.current.name} (${p.process_name})`);
            });
            
            // Find the index of the selected process
            const selectedProcessIndex = allProductions.findIndex(
                p => p.process_sequence.current.name === effectiveProcessName
            );
            console.log("selectedProcessIndex:", selectedProcessIndex);

            if (selectedProcessIndex === -1) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected process not found in sequence',
                });
            }
            
            const currentProcessIndex = allProductions.findIndex(
                p => p._id.toString() === currentProduction._id.toString()
            );
            console.log("currentProcessIndex:", currentProcessIndex);
            
            if (currentProcessIndex === -1) {
                return res.status(400).json({
                    success: false,
                    message: 'Current production not found in sequence',
                });
            }

            // Deduct recycled quantity from selected process to current process (excluding current as already deducted)
            console.log(`Updating productions from index ${selectedProcessIndex} to ${currentProcessIndex}`);
            for (let i = selectedProcessIndex; i <= currentProcessIndex; i++) {
                const productionToUpdate = allProductions[i];
                if (productionToUpdate._id.toString() !== currentProduction._id.toString()) {
                    console.log(`Updating production ${i}: ${productionToUpdate.process_name}`);
                    console.log(`Before - achieved: ${productionToUpdate.product.achieved_quantity}, recycled: ${productionToUpdate.product.recycled_quantity || 0}`);
                    
                    productionToUpdate.product.achieved_quantity -= rejected_quantity;
                    if (productionToUpdate.product.achieved_quantity < 0) {
                        productionToUpdate.product.achieved_quantity = 0;
                    }
                    // Track recycled quantity for all processes in between
                    productionToUpdate.product.recycled_quantity = (productionToUpdate.product.recycled_quantity || 0) + rejected_quantity;
                    
                    console.log(`After - achieved: ${productionToUpdate.product.achieved_quantity}, recycled: ${productionToUpdate.product.recycled_quantity}`);
                    await productionToUpdate.save();
                }
            }
            
            // Update recycled quantity for current production
            console.log(`Updating current production: ${currentProduction.process_name}`);
            console.log(`Before - achieved: ${currentProduction.product.achieved_quantity}, recycled: ${currentProduction.product.recycled_quantity || 0}`);
            currentProduction.product.recycled_quantity = (currentProduction.product.recycled_quantity || 0) + rejected_quantity;
            console.log(`After - achieved: ${currentProduction.product.achieved_quantity}, recycled: ${currentProduction.product.recycled_quantity}`);
            console.log("=== END RECYCLE PROCESS DEBUG ===");
        }

        // Create a new QC Check record
        const qcCheck = new falconQCCheck({
            production: productionId,
            job_order: currentProduction.job_order,
            product_id: currentProduction.product.product_id,
            semifinished_id: currentProduction.semifinished_id,
            rejected_quantity: is_rejection ? rejected_quantity : 0,
            recycled_quantity: is_rejection ? 0 : rejected_quantity,
            process_name: effectiveProcessName, // To which process we're sending back
            from_process_name: currentProduction.process_name, // From which process the rejection is coming
            is_rejection: is_rejection || false,
            remarks,
            checked_by: userId,
            updated_by: userId,
        });
        await qcCheck.save();

        // Aggregate rejected and recycled quantities from all QC checks for this production
        const qcChecks = await falconQCCheck.find({ production: productionId });
        console.log("qcChecks", qcChecks);
        const totalRejected = qcChecks.reduce((sum, check) => sum + (check.rejected_quantity || 0), 0);
        const totalRecycled = qcChecks.reduce((sum, check) => sum + (check.recycled_quantity || 0), 0);
        console.log("totalRejected", totalRejected);
        console.log("totalRecycled", totalRecycled);

        // For rejection: Aggregate rejected quantities across ALL related productions (same semifinished_id and job_order)
        if (is_rejection) {
            // Get all production IDs for this semifinished item
            const allProductionIds = allProductions.map(p => p._id);
            
            // Aggregate ALL QC checks across ALL related productions
            const allRelatedQcChecks = await falconQCCheck.find({
                production: { $in: allProductionIds },
                is_rejection: true
            });
            console.log("allRelatedQcChecks for rejection", allRelatedQcChecks);
            
            // Calculate total rejected quantity across ALL processes
            const totalRejectedAcrossAllProcesses = allRelatedQcChecks.reduce(
                (sum, check) => sum + (check.rejected_quantity || 0), 
                0
            );
            console.log("totalRejectedAcrossAllProcesses", totalRejectedAcrossAllProcesses);
            
            // Update rejected_quantity for ALL related productions to show the same cumulative value
            for (const production of allProductions) {
                production.product.rejected_quantity = totalRejectedAcrossAllProcesses;
                await production.save();
            }
            
            // Update current production with the same value
            currentProduction.product.rejected_quantity = totalRejectedAcrossAllProcesses;
        } else {
            // For recycle, update recycled_quantity from aggregated values (don't touch rejected_quantity)
            currentProduction.product.recycled_quantity = totalRecycled;
            // Don't update rejected_quantity for recycle operations
        }
        console.log("Before final save - currentProduction recycled_quantity:", currentProduction.product.recycled_quantity);
        currentProduction.qc_checked_by = userId;
        currentProduction.updated_by = userId;
        currentProduction.status = (rejected_quantity > 0 || is_rejection) ? 'Pending QC' : currentProduction.status;
        await currentProduction.save();
        console.log("After final save - currentProduction recycled_quantity:", currentProduction.product.recycled_quantity);

        return res.status(200).json({
            success: true,
            message: is_rejection ? 'Rejection completed successfully' : 'Recycle QC check completed successfully',
            data: {
                qc_check_id: qcCheck._id,
                production_id: currentProduction._id,
                job_order: currentProduction.job_order,
                semifinished_id: currentProduction.semifinished_id,
                product: {
                    product_id: currentProduction.product.product_id,
                    po_quantity: currentProduction.product.po_quantity,
                    achieved_quantity: currentProduction.product.achieved_quantity,
                    rejected_quantity: currentProduction.product.rejected_quantity,
                    recycled_quantity: currentProduction.product.recycled_quantity,
                },
                process_name: effectiveProcessName,
                is_rejection: is_rejection || false,
                remarks,
                checked_by: userId,
                status: currentProduction.status,
                created_at: qcCheck.createdAt.toISOString(),
                updated_at: qcCheck.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error in production QC check:', error);
        return res.status(500).json({
            success: false,
            message: 'Error performing QC check: ' + error.message,
        });
    }
});






// const getProductionDetailsById = asyncHandler(async (req, res) => {
//     try {

//     } catch (error) {
//         console.error('Error in production QC check:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error performing QC check: ' + error.message,
//         });
//     }
// })





// Utility to format dates as DD-MM-YYYY
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// Utility to format timestamp as YYYY-MM-DD hh:mm A
const formatTimestamp = (date) => {
    if (!date) return '';
    const d = new Date(date);
    // Adjust for IST (UTC +5:30)
    d.setHours(d.getHours() + 5, d.getMinutes() + 30);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    return `${year}-${month}-${day} ${hours}:${minutes} ${ampm}`;
};

const getProductionById_12_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { productionId } = req.params; // Get production ID from URL
        console.log("productionId", productionId);

        // Validate productionId
        if (!productionId || !mongoose.Types.ObjectId.isValid(productionId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Production ID is required',
            });
        }

        // Fetch production record with populated fields
        const production = await falconProduction.findById(productionId)
            .populate({
                path: 'job_order',
                model: 'falconJobOrder',
                populate: [
                    // {
                    //     path: 'project_id',
                    //     model: 'falconProject',
                    //     select: 'name',
                    // },
                    {
                        path: 'created_by',
                        model: 'User',
                        select: 'username',
                    },
                ],
            })
            .populate({
                path: 'product.product_id',
                model: 'falconProduct',
                select: 'name',
            })
            .populate({
                path: 'created_by',
                model: 'User',
                select: 'username',
            });
        console.log("production", production);

        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }

        // Fetch internal work order using job_order_id from falconJobOrder
        const jobOrder = production.job_order;
        const internalWorkOrder = await falconInternalWorkOrder.findOne({ job_order_id: jobOrder._id })
            .populate({
                path: 'products.product',
                model: 'falconProduct',
                select: 'name',
            })
            .populate({
                path: 'products.system',
                model: 'falconSystem',
                select: 'name',
            })
            .populate({
                path: 'products.product_system',
                model: 'falconProductSystem',
                select: 'name',
            });

        // console.log("internalWorkOrder", internalWorkOrder);

        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal Work Order not found for this Job Order',
            });
        }

        // Find the matching product in internalWorkOrder.products
        const matchingProduct = internalWorkOrder.products.find(p =>
            p.product._id.toString() === production.product.product_id._id.toString()
        );
        // console.log("matchingProduct", matchingProduct);

        if (!matchingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Matching product not found in Internal Work Order',
            });
        }

        // Fetch the latest QC check for this production
        const qcCheck = await falconQCCheck.findOne({ production: productionId })
            .sort({ createdAt: -1 }) // Get the most recent QC check
        // .populate({
        //     path: 'created_by',
        //     model: 'User',
        //     select: 'username',
        // });

        // Build the response
        const response = {
            success: true,
            message: 'Production detail fetched successfully',
            data: {
                workOrderDetails: {
                    workOrderNumber: jobOrder.work_order_number || '',
                    jobOrderNumber: jobOrder.job_order_id || '',
                    createdAt: formatDate(jobOrder.createdAt) || '',
                    createdBy: jobOrder.created_by?.username,
                    status: jobOrder.status || 'Pending',
                    // file: jobOrder.files?.[0] || 'N/A',
                    file: 'file',
                },
                productDetails: {
                    productName: production.product.product_id?.name,
                    system: matchingProduct.system?.name,
                    product_system: matchingProduct.product_system?.name,
                    project_name: jobOrder.project_id?.name,
                    date_from: formatDate(internalWorkOrder.date.from),
                    date_to: formatDate(internalWorkOrder.date.to),
                },
                semimfinished_details: {
                    semifinished_id: production.semifinished_id,
                    createdAt: formatDate(production.createdAt),
                    createdBy: production.created_by?.username,
                },
                semifinished_product_details: {
                    productName: production.product.product_id?.name,
                    uom: jobOrder.products.find(p =>
                        p.product.toString() === production.product.product_id._id.toString()
                    )?.uom || 'nos',
                    po_quantity: production.product.po_quantity || 1000,
                    acheived_qty: production.product.achieved_quantity || 80,
                    dispatched: 0, // Static
                    packed: 0, // Static
                },
                qc_check_details: qcCheck ? {
                    qc_number: `QC-${qcCheck._id}`, // Generate qc_number if not in schema
                    rejected_qty: qcCheck.rejected_quantity,
                    remarks: qcCheck.remarks,
                    created_by: qcCheck.created_by?.username,
                    timestamp: formatTimestamp(qcCheck.createdAt),
                    po_quantity: production.product.po_quantity || 1000,
                    acheived_qty: production.product.achieved_quantity || 50,
                    balance: (production.product.po_quantity) -
                        ((production.product.achieved_quantity)),
                } : {
                    // qc_number: 'QC101',
                    // rejected_qty: 80,
                    // remarks: 'remarks',
                    // created_by: 'admin',
                    // timestamp: '2025-06-15 10:30 AM',
                    // po_quantity: production.product.po_quantity || 1000,
                    // acheived_qty: production.product.achieved_quantity || 50,
                    // balance: (production.product.po_quantity || 1000) -
                    //     ((production.product.achieved_quantity || 50) + 80),
                },
            },
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching production by ID:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching production details: ' + error.message,
        });
    }
});



const getProductionById = asyncHandler(async (req, res) => {
    try {
        const { productionId } = req.params;

        // Validate productionId
        if (!productionId || !mongoose.Types.ObjectId.isValid(productionId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Production ID is required',
            });
        }

        // Fetch production record with populated fields
        const production = await falconProduction.findById(productionId)
            .populate({
                path: 'job_order',
                model: 'falconJobOrder',
                populate: [
                    {
                        path: 'work_order_number',
                        model: 'falconWorkOrder',
                        select: 'work_order_number project_id',
                        populate: {
                            path: 'project_id',
                            model: 'falconProject',
                            select: 'name',
                        },
                    },
                    {
                        path: 'created_by',
                        model: 'User',
                        select: 'username',
                    },
                ],
            })
            .populate({
                path: 'product.product_id',
                model: 'falconProduct',
                select: 'name',
            })
            .populate({
                path: 'created_by',
                model: 'User',
                select: 'username',
            });

        if (!production) {
            return res.status(404).json({
                success: false,
                message: 'Production record not found',
            });
        }
        console.log("production", production);

        // Fetch internal work order using job_order_id from falconJobOrder
        const jobOrder = production.job_order;
        const internalWorkOrder = await falconInternalWorkOrder.findOne({ job_order_id: jobOrder._id })
            .populate({
                path: 'products.product',
                model: 'falconProduct',
                select: 'name',
            })
            .populate({
                path: 'products.system',
                model: 'falconSystem',
                select: 'name',
            })
            .populate({
                path: 'products.product_system',
                model: 'falconProductSystem',
                select: 'name',
            });

        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal Work Order not found for this Job Order',
            });
        }

        // Find the matching product in internalWorkOrder.products
        const matchingProduct = internalWorkOrder.products.find(p =>
            p.product._id.toString() === production.product.product_id._id.toString()
        );

        if (!matchingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Matching product not found in Internal Work Order',
            });
        }
        // console.log("productId", production.product.product_id._id);
        // console.log("semi", production.semifinished_id);

        // Fetch packed quantity from falconPacking
        const packingRecords = await falconPacking.find({
            product: production.product.product_id._id,
            semi_finished_id: production.semifinished_id,
            delivery_stage: 'Packed',
        });
        // console.log("packingRecords", packingRecords);

        const packedQuantity = packingRecords.reduce((sum, record) => sum + (record.semi_finished_quantity || 0), 0);

        // Fetch dispatched quantity from falconDispatch
        const dispatchRecords = await falocnDispatch.find({
            'products.product_id': production.product.product_id,
            'products.semi_finished_id': production.semifinished_id,
        });
        // console.log("dispatchRecords", dispatchRecords);


        const dispatchedQuantity = dispatchRecords.reduce((sum, record) => {
            const matchingProducts = record.products.filter(p =>
                p.product_id.toString() === production.product.product_id._id.toString() &&
                p.semi_finished_id === production.semifinished_id
            );
            return sum + matchingProducts.reduce((qty, p) => qty + (p.dispatch_quantity || 0), 0);
        }, 0);

        // Fetch the latest QC check for this production
        // const qcCheck = await falconQCCheck.findOne({ production: productionId })
        //     .sort({ createdAt: -1 })


        const qcCheck = await falconQCCheck.find({ production: productionId });
        const sortedQCChecks = qcCheck.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        let cumulativeRejected = 0;
        let cumulativeRecycled = 0;
        const qcCheckDetails = sortedQCChecks.map((qc) => {
            cumulativeRejected += qc.rejected_quantity || 0;
            cumulativeRecycled += qc.recycled_quantity || 0;
            return {
                qc_number: `QC-${qc._id}`,
                rejected_qty: qc.rejected_quantity || 0,
                recycled_qty: qc.recycled_quantity || 0,
                acheived_qty: production.product.po_quantity - cumulativeRejected,
                remarks: qc.remarks || 'N/A',
                created_by: qc.checked_by?.username || 'admin',
                timestamp: formatTimestamp(qc.createdAt) || 'N/A',
                process_name: qc.process_name || 'N/A',
                from_process_name: qc.from_process_name || 'N/A',
            };
        });


        // .populate({
        //     path: 'created_by',
        //     model: 'User',
        //     select: 'username',
        // });
        // console.log("qcCheck", qcCheck);
        const totalRejected = qcCheck.reduce((sum, check) => sum + check.rejected_quantity, 0);
        const achievedTillNow = production.product.po_quantity - totalRejected;



        // Build the response
        const response = {
            success: true,
            message: 'Production detail fetched successfully',
            data: {
                workOrderDetails: {
                    workOrderId: jobOrder.work_order_number?._id || 'N/A',
                    workOrderNumber: jobOrder.work_order_number?.work_order_number || 'N/A',
                    jobOrderNumber: jobOrder.job_order_id || 'N/A',
                    createdAt: formatDate(jobOrder.createdAt) || 'N/A',
                    createdBy: jobOrder.created_by?.username || 'N/A',
                    status: jobOrder.status || 'Pending',
                    file: jobOrder.files?.[0] || 'file', // Fallback to 'file' as in original
                },
                productDetails: {
                    productName: production.product.product_id?.name || 'N/A',
                    system: matchingProduct.system?.name || 'N/A',
                    product_system: matchingProduct.product_system?.name || 'N/A',
                    project_name: jobOrder.work_order_number?.project_id?.name || 'N/A',
                    date_from: formatDate(internalWorkOrder.date?.from) || 'N/A',
                    date_to: formatDate(internalWorkOrder.date?.to) || 'N/A',
                },
                semimfinished_details: {
                    semifinished_id: production.semifinished_id || 'N/A',
                    createdAt: formatDate(production.createdAt) || 'N/A',
                    createdBy: production.created_by?.username || 'N/A',
                },
                semifinished_product_details: {
                    productName: production.product.product_id?.name || 'N/A',
                    uom: jobOrder.products.find(p =>
                        p.product.toString() === production.product.product_id._id.toString()
                    )?.uom || 'nos',
                    po_quantity: production.product.po_quantity || 0,
                    rejected_qty: production.product?.rejected_quantity || 0,
                    recycled_qty: production.product?.recycled_quantity || 0,
                    process: production.process_sequence.current?.name,
                    acheived_qty: production.product?.achieved_quantity || 0,
                    dispatched: dispatchedQuantity,
                    packed: packedQuantity,
                },
                // qc_check_details: qcCheck ? {
                //     qc_number: `QC-${qcCheck._id}` || 'N/A',
                //     rejected_qty: qcCheck.rejected_quantity || 0,
                //     remarks: qcCheck.remarks || 'N/A',
                //     created_by: qcCheck.created_by?.username || 'admin',
                //     timestamp: formatTimestamp(qcCheck.createdAt) || 'N/A',
                //     po_quantity: production.product.po_quantity || 0,
                //     acheived_qty: production.product.achieved_quantity || 0,
                //     balance: (production.product.po_quantity || 0) - (production.product.achieved_quantity || 0),
                // } : {},
                qc_check_details: qcCheck.length > 0
                    ? qcCheckDetails
                    : [],
            },
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching production by ID:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching production details: ' + error.message,
        });
    }
});


const getProductionProcesses = asyncHandler(async (req, res) => {
    const { productionId } = req.query;
    // console.log("productionId",productionId);

    // Validate input
    if (!productionId) {
        return res.status(400).json({
            success: false,
            message: 'productionId is required',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(productionId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid productionId',
        });
    }

    // Fetch the production record
    const production = await falconProduction.findById(productionId);
    if (!production) {
        return res.status(404).json({
            success: false,
            message: 'Production record not found',
        });
    }

    // Determine the previous process
    let previousProcess = null;
    const currentIndex = production.process_sequence.current.index;
    if (currentIndex > 0 && production.process_sequence.previous) {
        previousProcess = production.process_sequence.previous.name;
    }

    return res.status(200).json({
        success: true,
        data: {
            previousProcess,
        },
    });
});



const updateInvieQc = asyncHandler(async (req, res) => {
    const { productionId } = req.query;
    // 1. Validate input
    if (!productionId) {
        return res.status(400).json({
            success: false,
            message: "productionId is required",
        });
    }

    if (!mongoose.Types.ObjectId.isValid(productionId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid productionId",
        });
    }

    // 2. Find and update the record
    const updatedProduction = await falconProduction.findByIdAndUpdate(
        productionId,
        { invite_qc: true },
        { new: true } // return updated doc
    );

    if (!updatedProduction) {
        return res.status(404).json({
            success: false,
            message: "Production record not found",
        });
    }

    // 3. Send response
    return res.status(200).json({
        success: true,
        message: "Production record updated successfully",
        data: updatedProduction,
    });
});

const getProductionsWithInviteQC = asyncHandler(async (req, res) => {
    try {
        // 1. Get the process name from query parameters
        const { process } = req.query;
        console.log("process", process);
        if (!process) {
            return res.status(400).json({
                success: false,
                message: 'Process name is required in query parameters (e.g., ?process=cutting)',
            });
        }

        // 2. Validate the process name against allowed values
        const validProcesses = ['cutting', 'machining', 'assembling', 'glass fixing / glazing'];
        const processName = process.toLowerCase();
        if (!validProcesses.includes(processName)) {
            return res.status(400).json({
                success: false,
                message: `Invalid process name. Allowed values are: ${validProcesses.join(', ')}`,
            });
        }

        // 3. Query falconProduction with aggregation
        const productions = await falconProduction.aggregate([
            // Step 1: Match documents by process_name and invite_qc:true
            {
                $match: {
                    process_name: processName,
                    invite_qc: true,
                    'product.product_id': { $exists: true, $ne: null }
                }
            },
            // Step 2: Lookup job order details
            {
                $lookup: {
                    from: 'falconjoborders',
                    localField: 'job_order',
                    foreignField: '_id',
                    as: 'jobOrderDetails'
                }
            },
            { $unwind: { path: '$jobOrderDetails', preserveNullAndEmptyArrays: true } },

            // Step 3: Lookup work order details
            {
                $lookup: {
                    from: 'falconworkorders',
                    localField: 'jobOrderDetails.work_order_number',
                    foreignField: '_id',
                    as: 'workOrderDetails'
                }
            },
            { $unwind: { path: '$workOrderDetails', preserveNullAndEmptyArrays: true } },

            // Step 4: Lookup product details
            {
                $lookup: {
                    from: 'falconproducts',
                    localField: 'product.product_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },

            // Step 5: Lookup created_by details
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'createdByDetails'
                }
            },
            { $unwind: { path: '$createdByDetails', preserveNullAndEmptyArrays: true } },

            // Step 6: Project the desired fields
            {
                $project: {
                    _id: 1,
                    job_order: '$jobOrderDetails.job_order_id',
                    work_order_id: '$jobOrderDetails.work_order_number',
                    work_order_number: '$workOrderDetails.work_order_number',
                    semifinished_id: 1,
                    product_id: '$product.product_id',
                    name: '$productDetails.name',
                    product: {
                        product_id: '$product.product_id',
                        code: '$product.code',
                        po_quantity: '$product.po_quantity',
                        achieved_quantity: '$product.achieved_quantity',
                        rejected_quantity: '$product.rejected_quantity',
                        recycled_quantity: '$product.recycled_quantity'
                    },
                    po_quantity: '$product.po_quantity',
                    achieved_quantity: '$product.achieved_quantity',
                    rejected_quantity: '$product.rejected_quantity',
                    recycled_quantity: '$product.recycled_quantity',
                    
                    process_name: 1,
                    invite_qc: 1, // include invite_qc flag
                    date: 1,
                    status: 1,
                    created_by: '$createdByDetails.username',
                    updated_by: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

        // 4. Check if any productions were found
        if (productions.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No invited QC production records found for process: ${process}`,
            });
        }

        // 5. Return the filtered productions
        return res.status(200).json({
            success: true,
            message: `Production records with invite_qc:true fetched successfully for process: ${process}`,
            data: formatDateToIST(productions),
        });
    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching invited QC production records: ${error.message}`,
        });
    }
});


const getPreviousProcessesRelatedToSemiFinishedId_09_09_2025 = asyncHandler(async (req, res) => {
    try {
        const { semifinished_id } = req.query;
        console.log("semifinished_id",semifinished_id);
        // Query your database to find all previous processes for this semifinished_id
        const productions = await falconProduction.find({
          semifinished_id,
        }).sort({ 'process_sequence.current.index': 1 }); // Sort by process sequence index
      
        // Extract the process names (excluding the current process)
        const previousProcesses = productions
          .filter(p => p.process_sequence.current.name !== req.query.current_process)
          .map(p => p.process_sequence.current.name);
        
      
        res.json({ previousProcesses });
    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching invited QC production records: ${error.message}`,
        });
    }
});

const getPreviousProcessesRelatedToSemiFinishedId = asyncHandler(async (req, res) => {
    try {
        const { semifinished_id, current_process } = req.query;
        console.log("semifinished_id:", semifinished_id);
        console.log("current_process:", current_process);

        // Query your database to find all productions for this semifinished_id
        const productions = await falconProduction.find({
            semifinished_id,
        }).sort({ 'process_sequence.current.index': 1 }); // Sort by process sequence index

        // Find the index of the current process
        const currentProcessIndex = productions.findIndex(
            p => p.process_sequence.current.name === current_process
        );

        if (currentProcessIndex === -1) {
            return res.status(400).json({
                success: false,
                message: 'Current process not found in the sequence',
            });
        }

        // Extract only the previous processes (those before the current process)
        const previousProcesses = productions
            .slice(0, currentProcessIndex) // Get all processes before the current one
            .map(p => p.process_sequence.current.name);

        res.json({ previousProcesses });
    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching previous processes: ${error.message}`,
        });
    }
});


export {
    getProductionsByProcess, startProduction, productionQCCheck, getProductionById, getProductionProcesses,updateInvieQc, getProductionsWithInviteQC,getPreviousProcessesRelatedToSemiFinishedId
}

// {
//     "success": true,
//     "message": "Internal work order fetched successfully",
//     "data": {
// "workOrderDetails": {
//     "workOrderNumber": "WO-003",
//         "jobOrderNumber": "JO-002",
//             "createdAt": "09-06-2025",
//                 "createdBy": "admin",
//                     "status": "Pending"
//     "file": {
//         "file_name": "download (22).jpg",
//             "file_url": "https://kods-k2k-bucket.s3.ap-south-1.amazonaws.com/falcon-job-orders/1749458918927-download__22_.jpg",
//                 "uploaded_at": "2025-06-09T08:48:39.065Z",
//                     "_id": "68469fe7a7d5edcaca3d3bf2"
//     }
// },
// "productDetails": {
//     "productName": "Product ABC",
//         "system": "System 1"
//     "product_system": "Product system 1",
//         "project_name": "Project ABC",
//             "date_from": 16 - 06 - 2025,
//                 "date_to": 23 - 06 - 2025
// },
// "semimfinished_details":
// {
//     "semifinished_id": "JO-100-1-(1/1)",
//         "createdAt": 09 - 06 - 2025,
//             "createdBy": "admin",
// },

// "semifinished_product_details":
// {
//     "productName": "Product ABC",
//         "uom": "nos"(from job orders),
//             "po_quantity": 1000(from falcon productions),
//                 "acheived_qty:80(from falcon productions),
//     "dispatched": 0(static),
//         "packed": 0(static)
// },

// "qc_check_details": {
//     "qc_number": "QC101",
//         "rejected_qty": 80,
//             "remarks:"remarks",
//     "created_by": "admin",
//         "timestamp": 2025 - 06 - 15 10: 30 AM,
//             "po_quantity": 1000(from falcon productions),
//                 "acheived_qty": 50(from falcon productions),
//                     "balance": 870
// }
//     }