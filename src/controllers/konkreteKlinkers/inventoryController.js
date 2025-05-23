import mongoose from 'mongoose';
import { z } from 'zod';
import { Inventory } from '../../models/konkreteKlinkers/inventory.model.js';
import { Product } from '../../models/konkreteKlinkers/product.model.js';
import { Client } from '../../models/konkreteKlinkers/helpers/client.model.js';
import { Project } from '../../models/konkreteKlinkers/helpers/project.model.js';
import { WorkOrder } from '../../models/konkreteKlinkers/workOrder.model.js';

// Zod schema for query validation
const getInventoryByProductZodSchema = z.object({
  plant_id: z.string().optional(), // Optional plant filter
});

// export const getCombinedInventoryByProduct = async (req, res) => {
//   try {
//     // 1. Validate query parameters
//     // const validatedQuery = getInventoryByProductZodSchema.parse(req.query);
//     // const { plant_id } = validatedQuery;

//     // 2. Build match stage for aggregation
//     const matchStage = {};

//     // 3. Aggregation pipeline
//     const inventoryData = await Inventory.aggregate([
//       // Lookup to join with Product collection
//       {
//         $lookup: {
//           from: 'products', // Collection name in MongoDB (lowercase, plural)
//           localField: 'product',
//           foreignField: '_id',
//           as: 'productDetails',
//         },
//       },
//       // Unwind productDetails to work with single product objects
//       {
//         $unwind: '$productDetails',
//       },
//       // Filter for non-deleted and active products, and optional plant_id
//       {
//         $match: {
//           'productDetails.isDeleted': false,
//           'productDetails.status': 'Active',
//         //   ...(plant_id && { 'productDetails.plant': new mongoose.Types.ObjectId(plant_id) }),
//         },
//       },
//       // Group by product to combine quantities across work orders
//       {
//         $group: {
//           _id: '$productDetails._id', // Group by product ID
//           material_code: { $first: '$productDetails.material_code' },
//           description: { $first: '$productDetails.description' },
//           total_produced_quantity: { $sum: '$produced_quantity' }, // Sum produced quantities
//           // total_packed_quantity: { $sum: '$packed_quantity' }, // Sum packed quantities
//           // total_dispatched_quantity: { $sum: '$dispatched_quantity' }, // Sum dispatched quantities
//           // total_available_stock: { $sum: '$available_stock' }, // Sum available stock
//           work_orders: { $addToSet: '$work_order' }, // Collect unique work order IDs
//         },
//       },
//       // Project to shape the output
//       {
//         $project: {
//           _id: 0, // Exclude MongoDB _id
//           product_id: '$_id',
//           material_code: 1,
//           description: 1,
//           total_produced_quantity: 1,
//           total_packed_quantity: 1,
//           total_dispatched_quantity: 1,
//           total_available_stock: 1,
//           work_order_count: { $size: '$work_orders' }, // Count unique work orders
//         },
//       },
//       // Sort by material_code for consistent output
//       {
//         $sort: {
//           material_code: 1,
//         },
//       },
//     ]);

//     // 4. Check if any data was found
//     if (!inventoryData.length) {
//       return res.status(404).json({
//         success: false,
//         message: 'No inventory data found for active products',
//       });
//     }

//     // 5. Return success response
//     return res.status(200).json({
//       success: true,
//       message: 'Combined inventory data retrieved successfully',
//       data: inventoryData,
//     });
//   } catch (error) {
//     // Handle Zod validation errors
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map((err) => ({
//           field: err.path.join('.'),
//           message: err.message,
//         })),
//       });
//     }

//     // Handle other errors
//     console.error('Error fetching combined inventory data:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };



export const getCombinedInventoryByProduct = async (req, res) => {
  try {


    // 3. Aggregation pipeline
    const inventoryData = await Inventory.aggregate([
      // Lookup to join with Product collection
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      // Unwind productDetails to work with single product objects
      {
        $unwind: '$productDetails',
      },
      // Filter for non-deleted and active products, and optional plant_id
      {
        $match: {
          'productDetails.isDeleted': false,
          'productDetails.status': 'Active',
        },
      },
      // Lookup to join with WorkOrder collection to get po_quantity
      {
        $lookup: {
          from: 'workorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      // Unwind workOrderDetails to access products array
      {
        $unwind: '$workOrderDetails',
      },
      // Unwind workOrderDetails.products to match product_id with product
      {
        $unwind: '$workOrderDetails.products',
      },
      // Match where work order product_id matches inventory product
      {
        $match: {
          $expr: { $eq: ['$workOrderDetails.products.product_id', '$product'] },
        },
      },
      // Group by product to combine quantities across work orders
      {
        $group: {
          _id: '$productDetails._id', // Group by product ID
          material_code: { $first: '$productDetails.material_code' },
          description: { $first: '$productDetails.description' },
          status: { $first: '$productDetails.status' },
          uom: { $first: '$workOrderDetails.products.uom' },
          total_produced_quantity: { $sum: '$produced_quantity' },
          total_packed_quantity: { $sum: '$packed_quantity' },
          total_dispatched_quantity: { $sum: '$dispatched_quantity' },
          total_available_stock: { $sum: '$available_stock' },
          total_po_quantity: { $sum: '$workOrderDetails.products.po_quantity' },
          work_orders: { $addToSet: '$work_order' },
        },
      },
      // Project to shape the output and calculate balance_quantity
      {
        $project: {
          _id: 0,
          product_id: '$_id',
          material_code: 1,
          description: 1,
          uom: 1,
          total_produced_quantity: 1,
          total_po_quantity: 1,
          balance_quantity: { $subtract: ['$total_po_quantity', '$total_produced_quantity'] },
          work_order_count: { $size: '$work_orders' },
          status: 1,
        },
      },
      // Sort by material_code for consistent output
      {
        $sort: {
          material_code: 1,
        },
      },
    ]);

    // 4. Check if any data was found
    if (!inventoryData.length) {
      return res.status(404).json({
        success: false,
        message: 'No inventory data found for active products',
      });
    }

    // 5. Return success response
    return res.status(200).json({
      success: true,
      message: 'Combined inventory data retrieved successfully',
      data: inventoryData,
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // Handle other errors
    console.error('Error fetching combined inventory data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getInventoryByProductIdZodSchema = z.object({
  product_id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
});

export const getInventoryByProductId = async (req, res) => {
  try {
    const validatedQuery = getInventoryByProductIdZodSchema.parse(req.query);
    const { product_id } = validatedQuery;

    const product = await Product.findOne({
      _id: product_id,
      isDeleted: false,
      status: 'Active',
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or is inactive/deleted',
      });
    }

    // 3. Aggregation pipeline
    const inventoryData = await Inventory.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(product_id),
        },
      },
      // Lookup to join with Product collection
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      // Unwind productDetails to work with single product object
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: false,
        },
      },
      // Filter for non-deleted and active products
      {
        $match: {
          'productDetails.isDeleted': false,
          'productDetails.status': 'Active',
        },
      },
      // Lookup to join with WorkOrder collection
      {
        $lookup: {
          from: 'workorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      // Unwind workOrderDetails
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Unwind workOrderDetails.products to match product_id
      {
        $unwind: {
          path: '$workOrderDetails.products',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Match where work order product_id matches inventory product
      {
        $match: {
          $expr: { $eq: ['$workOrderDetails.products.product_id', '$product'] },
        },
      },
      // Lookup to join with Client collection
      {
        $lookup: {
          from: 'clients',
          localField: 'workOrderDetails.client_id',
          foreignField: '_id',
          as: 'clientDetails',
        },
      },
      // Unwind clientDetails (optional, as client_id may be null for buffer_stock)
      {
        $unwind: {
          path: '$clientDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup to join with Project collection
      {
        $lookup: {
          from: 'projects',
          localField: 'workOrderDetails.project_id',
          foreignField: '_id',
          as: 'projectDetails',
        },
      },
      // Unwind projectDetails (optional, as project_id may be null for buffer_stock)
      {
        $unwind: {
          path: '$projectDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Group by product and work_order to preserve per-work-order details
      {
        $group: {
          _id: {
            product_id: '$productDetails._id',
            work_order_id: '$work_order',
          },
          product_id: { $first: '$productDetails._id' },
          material_code: { $first: '$productDetails.material_code' },
          description: { $first: '$productDetails.description' },
          uom: { $first: '$workOrderDetails.products.uom' },
          work_order: {
            $first: {
              $cond: [
                { $ne: ['$workOrderDetails', null] },
                {
                  _id: '$workOrderDetails._id',
                  work_order_number: '$workOrderDetails.work_order_number',
                  created_at: '$workOrderDetails.createdAt',
                  created_by: '$workOrderDetails.created_by',
                  status: '$workOrderDetails.status',
                },
                null,
              ],
            },
          },
          po_quantity: { $first: '$workOrderDetails.products.po_quantity' },
          client: {
            $first: {
              $cond: [
                { $ne: ['$clientDetails', null] },
                {
                  _id: '$clientDetails._id',
                  name: '$clientDetails.name',
                  address: '$clientDetails.address',
                },
                null,
              ],
            },
          },
          project: {
            $first: {
              $cond: [
                { $ne: ['$projectDetails', null] },
                {
                  _id: '$projectDetails._id',
                  name: '$projectDetails.name',
                  address: '$projectDetails.address',
                },
                null,
              ],
            },
          },
          produced_quantity: { $sum: '$produced_quantity' },
          packed_quantity: { $sum: '$packed_quantity' },
          dispatched_quantity: { $sum: '$dispatched_quantity' },
          available_stock: { $sum: '$available_stock' },
        },
      },
      // Group by product to collect all work order details
      {
        $group: {
          _id: '$_id.product_id',
          product_details: {
            $push: {
              $cond: [
                { $ne: ['$_id.work_order_id', null] },
                {
                  work_order: '$work_order',
                  client: '$client',
                  project: '$project',
                  product_id: '$product_id',
                  material_code: '$material_code',
                  description: '$description',
                  uom: '$uom',
                  po_quantity: '$po_quantity',
                  produced_quantity: '$produced_quantity',
                  packed_quantity: '$packed_quantity',
                  dispatched_quantity: '$dispatched_quantity',
                  available_stock: '$available_stock',
                  balance_quantity: {
                    $subtract: [{ $ifNull: ['$po_quantity', 0] }, '$produced_quantity'],
                  },
                },
                '$$REMOVE',
              ],
            },
          },
        },
      },
      // Project to shape the final output
      {
        $project: {
          _id: 0,
          product_details: 1,
        },
      },
    ]);

    // 4. Check if any data was found
    if (!inventoryData.length) {
      // Return product details with empty product_details if no inventory records exist
      return res.status(200).json({
        success: true,
        message: 'No inventory records found for the product, but product exists',
        data: {
          product_details: [],
        },
      });
    }

    // 5. Return success response
    return res.status(200).json({
      success: true,
      message: 'Inventory data for product retrieved successfully',
      data: inventoryData[0], // Return the first (and only) product
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // Handle other errors
    console.error('Error fetching inventory data by product ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};