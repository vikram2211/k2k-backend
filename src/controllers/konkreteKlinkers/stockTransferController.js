import { BufferTransfer } from '../../models/konkreteKlinkers/bufferTransfer.model.js'
import { WorkOrder } from '../../models/konkreteKlinkers/workOrder.model.js';
import { Product } from '../../models/konkreteKlinkers/product.model.js';
import { DailyProduction } from '../../models/konkreteKlinkers/dailyProductionPlanning.js';
import { User } from '../../models/user.model.js';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import mongoose from 'mongoose';

const transferStockSchema = z.object({
    from_buffer_stock_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid from_buffer_stock_id',
    }),
    to_work_order_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid to_work_order_id',
    }),
    product_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid product_id',
    }),
    quantity_transferred: z.number().positive({ message: 'Quantity must be positive' })
});


export const transferStock = async (req, res) => {
    try {
        // Validate request body with Zod
        const validatedData = transferStockSchema.parse(req.body);

        // Check if referenced documents exist
        const [fromWorkOrder, toWorkOrder, product] = await Promise.all([
            WorkOrder.findById(validatedData.from_buffer_stock_id),
            WorkOrder.findById(validatedData.to_work_order_id),
            Product.findById(validatedData.product_id),
        ]);

        if (!fromWorkOrder) {
            return res.status(400).json({
                success: false,
                errors: [{ field: 'from_buffer_stock_id', message: 'Source work order not found' }],
            });
        }
        if (!toWorkOrder) {
            return res.status(400).json({
                success: false,
                errors: [{ field: 'to_work_order_id', message: 'Destination work order not found' }],
            });
        }
        if (!product) {
            return res.status(400).json({
                success: false,
                errors: [{ field: 'product_id', message: 'Product not found' }],
            });
        }


        // Create new BufferTransfer
        const bufferTransfer = new BufferTransfer({
            from_buffer_stock_id: validatedData.from_buffer_stock_id,
            to_work_order_id: validatedData.to_work_order_id,
            product_id: validatedData.product_id,
            quantity_transferred: validatedData.quantity_transferred,
            transferred_by: req.user._id,
            transfer_date: new Date(),
        });

        // Save the transfer
        await bufferTransfer.save();

        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Stock transferred successfully between work orders',
            data: bufferTransfer,
        });
    } catch (error) {
        // Cleanup: Delete temp files on error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        // Handle different error types
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        if (error.name === 'ValidationError') {
            const formattedErrors = Object.values(error.errors).map((err) => ({
                field: err.path,
                message: err.message,
            }));
            return res.status(400).json({
                success: false,
                errors: formattedErrors,
            });
        }

        console.error('Error transferring stock:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
};


export const getAllTransfers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [transfers, total] = await Promise.all([
            BufferTransfer.find()
                .populate('from_buffer_stock_id', 'name') // Adjust fields as needed
                .populate('to_work_order_id', 'name')
                .populate('product_id', 'name')
                .populate('transferred_by', 'username')
                .skip(skip)
                .limit(limit)
                .lean(),
            BufferTransfer.countDocuments(),
        ]);

        return res.status(200).json({
            success: true,
            message: 'Buffer transfers retrieved successfully',
            data: transfers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        // Cleanup: Delete temp files on error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        console.error('Error fetching buffer transfers:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
};

// Zod schemas for validation
const idSchema = z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid ID',
});

export const getTransferById = async (req, res) => {
    try {
        // Validate ID
        const validatedId = idSchema.parse(req.params.id);

        const transfer = await BufferTransfer.findById(validatedId)
            .populate('from_buffer_stock_id', 'name')
            .populate('to_work_order_id', 'name')
            .populate('product_id', 'name')
            .populate('transferred_by', 'username')
            .lean();

        if (!transfer) {
            return res.status(404).json({
                success: false,
                errors: [{ field: 'id', message: 'Buffer transfer not found' }],
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Buffer transfer retrieved successfully',
            data: transfer,
        });
    } catch (error) {
        // Cleanup: Delete temp files on error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        console.error('Error fetching buffer transfer:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
};

const updateTransferSchema = z.object({
    quantity_transferred: z.number().positive({ message: 'Quantity must be positive' }).optional(),
    status: z.enum(['Completed', 'Reversed'], { message: 'Invalid status' }).optional(),
});

export const updateTransfer = async (req, res) => {
    try {
        // Validate ID and request body
        const validatedId = idSchema.parse(req.params.id);
        const validatedData = updateTransferSchema.parse(req.body);

        const transfer = await BufferTransfer.findById(validatedId);
        if (!transfer) {
            return res.status(404).json({
                success: false,
                errors: [{ field: 'id', message: 'Buffer transfer not found' }],
            });
        }

        // Update fields
        Object.assign(transfer, validatedData);
        await transfer.save();

        // Populate for response
        const updatedTransfer = await BufferTransfer.findById(validatedId)
            .populate('from_buffer_stock_id', 'name')
            .populate('to_work_order_id', 'name')
            .populate('product_id', 'name')
            .populate('transferred_by', 'username')
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Buffer transfer updated successfully',
            data: updatedTransfer,
        });
    } catch (error) {
        // Cleanup: Delete temp files on error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        if (error.name === 'ValidationError') {
            const formattedErrors = Object.values(error.errors).map((err) => ({
                field: err.path,
                message: err.message,
            }));
            return res.status(400).json({
                success: false,
                errors: formattedErrors,
            });
        }

        console.error('Error updating buffer transfer:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
};

const deleteMultipleSchema = z.object({
    ids: z
        .array(z.string().refine((val) => mongoose.isValidObjectId(val), { message: 'Invalid ID' }))
        .nonempty({ message: 'At least one ID is required' }),
});

export const deleteTransfers = async (req, res) => {
    try {
        let ids = req.body.ids;

        // If a single ID is provided as a param (for single delete)
        //   if (req.params.id) {
        //     ids = [req.params.id];
        //   } 

        // Validate IDs
        const validatedData = ids
            ? deleteMultipleSchema.parse({ ids })
            : idSchema.parse(req.params.id); // Fallback for single ID

        const result = await BufferTransfer.deleteMany({
            _id: { $in: validatedData.ids || [validatedData] },
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                errors: [{ field: 'ids', message: 'No buffer transfers found to delete' }],
            });
        }

        return res.status(200).json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} buffer transfer(s)`,
            data: { deletedCount: result.deletedCount },
        });
    } catch (error) {
        // Cleanup: Delete temp files on error
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                errors: error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                })),
            });
        }

        console.error('Error deleting buffer transfers:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
};

////////SHOW WORK ORDERS RELATED TO ONLY PRODUCT SELECTED AND WHICH ARE NOT DISPATCH YET - (STOCK TRANSFER (ONLY ACTUAL WO))

export const getWorkOrdersByProduct = async (req, res) => {
    try {
        // Extract query parameters
        const { prId: productId, isBuffer } = req.query;

        // Validate productId
        if (!productId || !mongoose.isValidObjectId(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Product ID is required',
            });
        }

        // Build match conditions for WorkOrder
        const matchConditions = {
            'products.product_id': new mongoose.Types.ObjectId(productId),
        };

        // Add buffer_stock filter if isBuffer is provided
        if (isBuffer !== undefined) {
            const bufferStock = isBuffer === 'true' || isBuffer === true;
            matchConditions.buffer_stock = bufferStock;
        }

        // Aggregation pipeline
        const workOrders = await WorkOrder.aggregate([
            // Step 1: Match work orders with the given productId and optional buffer_stock
            {
                $match: matchConditions,
            },
            // Step 2: Lookup Packing collection to find matching packing records
            {
                $lookup: {
                    from: 'packings', // Collection name in MongoDB (lowercase, pluralized by Mongoose)
                    let: { workOrderId: '$_id', productId: new mongoose.Types.ObjectId(productId) },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$work_order', '$$workOrderId'] }, // Match work_order to WorkOrder._id
                                        { $eq: ['$product', '$$productId'] }, // Match product to productId
                                        { $eq: ['$delivery_stage', 'Packed'] }, // Match delivery_stage to 'Packed'
                                    ],
                                },
                            },
                        },
                    ],
                    as: 'packingRecords',
                },
            },
            // Step 3: Filter work orders that have at least one matching packing record
            {
                $match: {
                    'packingRecords.0': { $exists: true }, // Ensure packingRecords is not empty
                },
            },
            // Step 4: Project only the desired fields
            {
                $project: {
                    work_order_number: 1,
                    date: 1,
                    buffer_stock: 1,
                    products: 1,
                    status: 1,
                    // Optionally include packingRecords if needed in the response
                    // packingRecords: 1,
                },
            },
        ]);

        // Check if work orders were found
        if (!workOrders || workOrders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No work orders found with the given product ID and packed delivery stage',
            });
        }

        // Send response
        return res.status(200).json({
            success: true,
            data: workOrders,
        });

    } catch (error) {
        console.error('Error fetching work orders:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};


// export const getWorkOrderProductQuantity = async (req, res) => {
//     try {
//         // Extract query parameters
//         const { wrId: workOrderId, prId: productId } = req.query;

//         // Validate inputs
//         if (!workOrderId || !mongoose.isValidObjectId(workOrderId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Valid Work Order ID is required',
//             });
//         }

//         if (!productId || !mongoose.isValidObjectId(productId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Valid Product ID is required',
//             });
//         }

//         // Check if WorkOrder exists with the given _id and productId in products array
//         const checkProductAvailable = await WorkOrder.findOne({
//             _id: new mongoose.Types.ObjectId(workOrderId),
//             'products.product_id': new mongoose.Types.ObjectId(productId),
//         }).lean();

//         if (!checkProductAvailable) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Selected Product is not present in selected Work Order',
//             });
//         }

//         // Aggregate achieved_quantity from DailyProduction
//         const dailyProductionData = await DailyProduction.aggregate([
//             // Match DailyProduction records with the given work_order and product_id
//             {
//                 $match: {
//                     work_order: new mongoose.Types.ObjectId(workOrderId),
//                     'products.product_id': new mongoose.Types.ObjectId(productId),
//                 },
//             },
//             // Unwind the products array to process each product entry
//             {
//                 $unwind: '$products',
//             },
//             // Filter to only include products matching the productId
//             {
//                 $match: {
//                     'products.product_id': new mongoose.Types.ObjectId(productId),
//                 },
//             },
//             // Group to sum achieved_quantity
//             {
//                 $group: {
//                     _id: null,
//                     totalAchievedQuantity: { $sum: '$products.achieved_quantity' },
//                 },
//             },
//             // Project to shape the output
//             {
//                 $project: {
//                     _id: 0,
//                     totalAchievedQuantity: 1,
//                 },
//             },
//         ]);

//         // Extract total achieved quantity (default to 0 if no records found)
//         const totalAchievedQuantity = dailyProductionData.length > 0 ? dailyProductionData[0].totalAchievedQuantity : 0;

//         // Send response
//         return res.status(200).json({
//             success: true,
//             message: 'Achieved quantity retrieved successfully',
//             data: {
//                 workOrderId,
//                 productId,
//                 totalAchievedQuantity,
//             },
//         });

//     } catch (error) {
//         console.error('Error fetching work order product quantity:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Internal Server Error',
//         });
//     }
// };


export const getWorkOrderProductQuantity = async (req, res) => {
    try {
        // Extract query parameters
        const { wrId: workOrderId, prId: productId, isBuffer } = req.query;

        // Validate inputs
        if (!workOrderId || !mongoose.isValidObjectId(workOrderId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Work Order ID is required',
            });
        }

        if (!productId || !mongoose.isValidObjectId(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid Product ID is required',
            });
        }

        // Build match conditions for WorkOrder
        const matchConditions = {
            _id: new mongoose.Types.ObjectId(workOrderId),
            'products.product_id': new mongoose.Types.ObjectId(productId),
        };

        // Add buffer_stock filter if isBuffer is provided
        if (isBuffer !== undefined) {
            const bufferStock = isBuffer === 'true' || isBuffer === true;
            matchConditions.buffer_stock = bufferStock;
        }

        // Check if WorkOrder exists with the given conditions
        const checkProductAvailable = await WorkOrder.findOne(matchConditions).lean();

        if (!checkProductAvailable) {
            return res.status(400).json({
                success: false,
                message: 'Selected Product is not present in selected Work Order or buffer stock condition not met',
            });
        }

        // Aggregate achieved_quantity from DailyProduction
        const dailyProductionData = await DailyProduction.aggregate([
            // Match DailyProduction records with the given work_order and product_id
            {
                $match: {
                    work_order: new mongoose.Types.ObjectId(workOrderId),
                    'products.product_id': new mongoose.Types.ObjectId(productId),
                },
            },
            // Unwind the products array to process each product entry
            {
                $unwind: '$products',
            },
            // Filter to only include products matching the productId
            { 
                $match: {
                    'products.product_id': new mongoose.Types.ObjectId(productId),
                },
            },
            // Group to sum achieved_quantity
            {
                $group: {
                    _id: null,
                    totalAchievedQuantity: { $sum: '$products.achieved_quantity' },
                },
            },
            // Project to shape the output
            {
                $project: {
                    _id: 0,
                    totalAchievedQuantity: 1,
                },
            },
        ]);

        // Extract total achieved quantity (default to 0 if no records found)
        const totalAchievedQuantity = dailyProductionData.length > 0 ? dailyProductionData[0].totalAchievedQuantity : 0;

        // Send response
        return res.status(200).json({
            success: true,
            message: 'Achieved quantity retrieved successfully',
            data: {
                workOrderId,
                productId,
                totalAchievedQuantity,
            },
        });

    } catch (error) {
        console.error('Error fetching work order product quantity:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};