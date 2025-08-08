import { falconInternalWorkOrder } from "../../models/falconFacade/falconInternalWorder.model.js";
import { falconProduction } from '../../models/falconFacade/falconProduction.model.js';
import { falconQCCheck } from "../../models/falconFacade/falconQcCheck.model.js";
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
                        rejected_quantity: '$product.rejected_quantity'
                    },
                    po_quantity: '$product.po_quantity',
                    achieved_quantity: '$product.achieved_quantity',
                    rejected_quantity: '$product.rejected_quantity',
                    process_name: 1,
                    date: 1,
                    status: 1,
                    created_by: '$createdByDetails.username',
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



const startProduction_22_07_2025= asyncHandler(async (req, res) => {
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





const productionQCCheck = asyncHandler(async (req, res) => {
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
            process_name: effectiveProcessName,
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

const getProductionById = asyncHandler(async (req, res) => {
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
                    createdBy: jobOrder.created_by?.username || 'admin',
                    status: jobOrder.status || 'Pending',
                    // file: jobOrder.files?.[0] || 'N/A',
                    file: 'file',
                },
                productDetails: {
                    productName: production.product.product_id?.name || 'Product ABC',
                    system: matchingProduct.system?.name || 'System 1',
                    product_system: matchingProduct.product_system?.name || 'Product system 1',
                    project_name: jobOrder.project_id?.name || 'Project ABC',
                    date_from: formatDate(internalWorkOrder.date.from) || '16-06-2025',
                    date_to: formatDate(internalWorkOrder.date.to) || '23-06-2025',
                },
                semimfinished_details: {
                    semifinished_id: production.semifinished_id || 'JO-100-1-(1/1)',
                    createdAt: formatDate(production.createdAt) || '09-06-2025',
                    createdBy: production.created_by?.username || 'admin',
                },
                semifinished_product_details: {
                    productName: production.product.product_id?.name || 'Product ABC',
                    uom: jobOrder.products.find(p =>
                        p.product.toString() === production.product.product_id._id.toString()
                    )?.uom || 'nos',
                    po_quantity: production.product.po_quantity || 1000,
                    acheived_qty: production.product.achieved_quantity || 80,
                    dispatched: 0, // Static
                    packed: 0, // Static
                },
                qc_check_details: qcCheck ? {
                    qc_number: `QC-${qcCheck._id}` || 'QC101', // Generate qc_number if not in schema
                    rejected_qty: qcCheck.rejected_quantity || 80,
                    remarks: qcCheck.remarks || 'remarks',
                    created_by: qcCheck.created_by?.username || 'admin',
                    timestamp: formatTimestamp(qcCheck.createdAt) || '2025-06-15 10:30 AM',
                    po_quantity: production.product.po_quantity || 1000,
                    acheived_qty: production.product.achieved_quantity || 50,
                    balance: (production.product.po_quantity) -
                        ((production.product.achieved_quantity) + (qcCheck?.rejected_quantity)),
                } : {
                    qc_number: 'QC101',
                    rejected_qty: 80,
                    remarks: 'remarks',
                    created_by: 'admin',
                    timestamp: '2025-06-15 10:30 AM',
                    po_quantity: production.product.po_quantity || 1000,
                    acheived_qty: production.product.achieved_quantity || 50,
                    balance: (production.product.po_quantity || 1000) -
                        ((production.product.achieved_quantity || 50) + 80),
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




export {
    getProductionsByProcess, startProduction, productionQCCheck, getProductionById, getProductionProcesses
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