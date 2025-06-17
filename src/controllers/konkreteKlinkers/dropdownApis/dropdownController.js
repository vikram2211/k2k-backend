import { WorkOrder } from "../../../models/konkreteKlinkers/workOrder.model.js";
import { JobOrder } from "../../../models/konkreteKlinkers/jobOrders.model.js";
import mongoose from "mongoose";
import { z } from 'zod';

// Zod schema for validating query parameters
const getProductByWorkOrderSchema = z.object({
    work_order_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid work order ID',
    }),
}).strict();

export const getProductByWorkOrder = async (req, res) => {
    try {
        // 1. Validate query parameters
        const validatedData = getProductByWorkOrderSchema.parse(req.query);
        const { work_order_id } = validatedData;

        // 2. Fetch WorkOrder with populated products
        const workOrder = await WorkOrder.findById(work_order_id)
            .populate({
                path: 'products.product_id',
                select: 'material_code description uom qty_in_bundle isDeleted',
                match: { isDeleted: false }, // Only include non-deleted products
            })
            //   .populate({
            //     path: 'products.plant_code',
            //     select: 'plant_code',
            //   })
            .lean(); // Use lean for performance

        // 3. Check if WorkOrder exists
        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found',
            });
        }
        console.log("workOrder",workOrder);

        // 4. Format the products array
        const formattedProducts = workOrder.products
            .filter((product) => product.product_id) // Exclude products where product_id didn't populate (e.g., deleted)
            .map((product) => ({
                product_id: product.product_id._id.toString(),
                material_code: product.product_id.material_code,
                description: product.product_id.description,
                uom: product.uom,
                po_quantity: product.po_quantity,
                quantity_in_no: product.qty_in_nos,
                original_sqmt: product.original_sqmt,
                plant_code: product.plant_code ? product.plant_code.plant_code : null,
                delivery_date: product.delivery_date || null,
            }));

        // 5. Return success response
        return res.status(200).json({
            success: true,
            message: 'Products retrieved successfully',
            data: formattedProducts,
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
        console.error('Error fetching products by work order:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};

export const getJobOrdersForDropdown = async (req, res, next) => {
    try {
      const jobOrders = await JobOrder.find(
        {},
        { job_order_id: 1, } // Select only job_order_id, exclude _id
      ).lean();
  
      res.status(200).json({
        success: true,
        data: jobOrders,
      });
    } catch (error) {
      next(error);
    }
  };