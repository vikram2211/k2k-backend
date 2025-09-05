import { z } from 'zod';
import { QCCheck } from '../../models/konkreteKlinkers/qcCheck.model.js';
import { JobOrder } from '../../models/konkreteKlinkers/jobOrders.model.js';
import { DailyProduction } from '../../models/konkreteKlinkers/dailyProductionPlanning.js';
import mongoose from 'mongoose';

// Helper for MongoDB ObjectId validation
const objectIdSchema_24_08_2025 = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// Zod schema for QC Check
const qcCheckZodSchema_24_08_2025 = z.object({
  // work_order: objectIdSchema,
  // job_order: objectIdSchema,
  // product_id: objectIdSchema,
  rejected_quantity: z.number().min(0, "Rejected quantity cannot be negative").default(0),
  recycled_quantity: z.number().min(0, "Recycled quantity cannot be negative").default(0),
  remarks: z.string().trim().optional(),
  // updated_by: objectIdSchema.optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
}).refine(
  (data) => data.recycled_quantity <= data.rejected_quantity,
  "Recycled quantity cannot exceed rejected quantity"
);

export const addQcCheck1 = async (req, res) => {
  try {
    // 1. Validate request data using Zod
    const validatedData = qcCheckZodSchema.parse(req.body);

    // 2. Add created_by from authenticated user
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }
    // console.log("id",req.user._id);
    validatedData.created_by = req.user._id;
    validatedData.updated_by = req.user._id;

    // 3. Create and save the QC Check
    const qcCheck = new QCCheck(validatedData);
    await qcCheck.save();

    // 4. Return success response
    res.status(201).json({
      success: true,
      data: qcCheck
    });

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors: formattedErrors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate key error",
        field: Object.keys(error.keyPattern)[0],
      });
    }

    // Handle other errors
    console.error("Error creating QC Check:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

export const addQcCheck_24_08_2025 = async (req, res) => {
  try {
    // 1. Validate request data using Zod
    const validatedData = qcCheckZodSchema.parse(req.body);
    console.log("validatedData", validatedData);

    // 2. Add created_by and updated_by from authenticated user
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }
    validatedData.created_by = req.user._id;
    validatedData.updated_by = req.user._id;

    // 3. Validate product_id against JobOrder
    const jobOrder = await JobOrder.findById(validatedData.job_order)
      .select('products')
      .lean();

    if (!jobOrder) {
      return res.status(404).json({
        success: false,
        message: `Job order ${validatedData.job_order} not found`,
      });
    }

    const isValidProduct = jobOrder.products.some(
      (p) => p.product && p.product.toString() === validatedData.product_id.toString()
    );

    if (!isValidProduct) {
      return res.status(400).json({
        success: false,
        message: `Product ${validatedData.product_id} is not associated with job order ${validatedData.job_order}`,
      });
    }

    // 4. Create and save the QC Check
    const qcCheck = new QCCheck(validatedData);
    await qcCheck.save();

    // 5. Update or create DailyProduction with rejected_quantity and recycled_quantity
    let warnings = [];
    const dailyProductions = await DailyProduction.find({
      work_order: validatedData.work_order,
      job_order: validatedData.job_order,
    });
    console.log("dailyProductions", dailyProductions);

    let updated = false;

    for (let dailyProduction of dailyProductions) {
      const productIndex = dailyProduction.products.findIndex(
        (p) => p.product_id.toString() === validatedData.product_id.toString()
      );
      console.log("productIndex for document", dailyProduction._id, productIndex);

      if (productIndex !== -1) {
        // Update rejected_quantity and recycled_quantity for the product
        dailyProduction.products[productIndex].rejected_quantity =
          (dailyProduction.products[productIndex].rejected_quantity || 0) +
          (validatedData.rejected_quantity || 0);
        dailyProduction.products[productIndex].recycled_quantity =
          (dailyProduction.products[productIndex].recycled_quantity || 0) +
          (validatedData.recycled_quantity || 0);
        dailyProduction.updated_by = req.user._id;
        console.log("Updating DailyProduction", dailyProduction._id);
        await dailyProduction.save();
        updated = true;
        break; // Exit loop after updating the first matching document
      }
    }

    if (!updated) {
      // No matching product found in existing DailyProduction documents
      if (dailyProductions.length === 0) {
        // Create new DailyProduction document
        const newDailyProduction = new DailyProduction({
          work_order: validatedData.work_order,
          job_order: validatedData.job_order,
          products: [
            {
              product_id: validatedData.product_id,
              achieved_quantity: 0,
              rejected_quantity: validatedData.rejected_quantity || 0,
              recycled_quantity: validatedData.recycled_quantity || 0,
            },
          ],
          date: new Date().setUTCHours(0, 0, 0, 0),
          created_by: req.user._id,
          updated_by: req.user._id,
          status: 'Pending',
        });
        await newDailyProduction.save();
        console.log("Created new DailyProduction", newDailyProduction);
      } else {
        // Add product to the first DailyProduction document
        const dailyProduction = dailyProductions[0];
        dailyProduction.products.push({
          product_id: validatedData.product_id,
          achieved_quantity: 0,
          rejected_quantity: validatedData.rejected_quantity || 0,
          recycled_quantity: validatedData.recycled_quantity || 0,
        });
        dailyProduction.updated_by = req.user._id;
        console.log("Added product to DailyProduction", dailyProduction._id);
        await dailyProduction.save();
      }
    }

    // 6. Return success response with optional warnings
    res.status(201).json({
      success: true,
      message: warnings.length > 0 ? "QC Check added with warnings" : "QC Check added successfully",
      data: qcCheck,
      warnings: warnings.length > 0 ? warnings : undefined,
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

    // Handle Mongoose validation errors
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

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate key error",
        field: Object.keys(error.keyPattern)[0],
      });
    }

    // Handle other errors
    console.error("Error creating QC Check:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const qcCheckZodSchema = z.object({
  work_order: objectIdSchema,
  job_order: objectIdSchema,
  production_id: objectIdSchema,
  product_id: objectIdSchema,
  rejected_quantity: z.number().min(0, "Rejected quantity cannot be negative").default(0),
  recycled_quantity: z.number().min(0, "Recycled quantity cannot be negative").default(0),
  remarks: z.string().trim().optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
}).refine(
  (data) => data.recycled_quantity <= data.rejected_quantity,
  {
    message: "Recycled quantity cannot exceed rejected quantity",
    path: ["recycled_quantity"],
  }
);

export const addQcCheck_04_09_2025 = async (req, res) => {
  try {
    // 1. Validate request
    const validatedData = qcCheckZodSchema.parse(req.body);

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }
    validatedData.created_by = req.user._id;
    validatedData.updated_by = req.user._id;

    // 2. Ensure production_id is provided
    if (!validatedData.production_id) {
      return res.status(400).json({
        success: false,
        message: "production_id is required to add QC Check",
      });
    }

    // 3. Find the DailyProduction record
    const dailyProduction = await DailyProduction.findById(validatedData.production_id);
    if (!dailyProduction) {
      return res.status(404).json({
        success: false,
        message: `DailyProduction ${validatedData.production_id} not found`,
      });
    }

    // 4. Ensure the product exists in that production
    const productIndex = dailyProduction.products.findIndex(
      (p) => p.product_id.toString() === validatedData.product_id.toString()
    );

    if (productIndex === -1) {
      return res.status(400).json({
        success: false,
        message: `Product ${validatedData.product_id} not found in production ${validatedData.production_id}`,
      });
    }

    // 5. Update rejected & recycled qty
    // achieved_quantity = total production (good + rejected + recycled)
    // When adding rejected/recycled, we need to ensure they don't exceed achieved_quantity
    dailyProduction.products[productIndex].rejected_quantity += validatedData.rejected_quantity;
    dailyProduction.products[productIndex].recycled_quantity += validatedData.recycled_quantity;
    
    // Ensure rejected + recycled don't exceed achieved_quantity
    const totalRejectedRecycled = dailyProduction.products[productIndex].rejected_quantity + 
                                 dailyProduction.products[productIndex].recycled_quantity;
    if (totalRejectedRecycled > dailyProduction.products[productIndex].achieved_quantity) {
      return res.status(400).json({
        success: false,
        message: `Total rejected (${dailyProduction.products[productIndex].rejected_quantity}) + recycled (${dailyProduction.products[productIndex].recycled_quantity}) quantities cannot exceed achieved quantity (${dailyProduction.products[productIndex].achieved_quantity})`
      });
    }

    dailyProduction.updated_by = req.user._id;
    await dailyProduction.save();

    // 6. Save QC check
    const qcCheck = new QCCheck(validatedData);
    await qcCheck.save();

    return res.status(201).json({
      success: true,
      message: "QC Check added successfully",
      data: qcCheck,
    });
  } catch (error) {
    console.error("Error adding QC Check:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};







// export const addQcCheck = async (req, res) => {
//   try {
//     // 1. Validate request
//     const validatedData = qcCheckZodSchema.parse(req.body);
//     if (!req.user?._id) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized: User not authenticated",
//       });
//     }
//     validatedData.created_by = req.user._id;
//     validatedData.updated_by = req.user._id;

//     // 2. Ensure production_id is provided
//     if (!validatedData.production_id) {
//       return res.status(400).json({
//         success: false,
//         message: "production_id is required to add QC Check",
//       });
//     }

//     // 3. Find the DailyProduction record
//     const dailyProduction = await DailyProduction.findById(validatedData.production_id);
//     if (!dailyProduction) {
//       return res.status(404).json({
//         success: false,
//         message: `DailyProduction ${validatedData.production_id} not found`,
//       });
//     }

//     // 4. Ensure the product exists in that production
//     const productIndex = dailyProduction.products.findIndex(
//       (p) => p.product_id.toString() === validatedData.product_id.toString()
//     );
//     if (productIndex === -1) {
//       return res.status(400).json({
//         success: false,
//         message: `Product ${validatedData.product_id} not found in production ${validatedData.production_id}`,
//       });
//     }
//     if (dailyProduction.status === "Pending QC") {
//       dailyProduction.status = "Pending";
//       dailyProduction.started_at = null;
//       dailyProduction.stopped_at = null;
//     }

//     // 5. Update rejected & recycled qty
//     // achieved_quantity = total production (good + rejected + recycled)
//     // When adding rejected/recycled, we need to ensure they don't exceed achieved_quantity
//     dailyProduction.products[productIndex].rejected_quantity += validatedData.rejected_quantity || 0;
//     dailyProduction.products[productIndex].recycled_quantity += validatedData.recycled_quantity || 0;
    
//     // Ensure rejected + recycled don't exceed achieved_quantity
//     const totalRejectedRecycled = dailyProduction.products[productIndex].rejected_quantity + 
//                                  dailyProduction.products[productIndex].recycled_quantity;
//     if (totalRejectedRecycled > dailyProduction.products[productIndex].achieved_quantity) {
//       return res.status(400).json({
//         success: false,
//         message: `Total rejected (${dailyProduction.products[productIndex].rejected_quantity}) + recycled (${dailyProduction.products[productIndex].recycled_quantity}) quantities cannot exceed achieved quantity (${dailyProduction.products[productIndex].achieved_quantity})`
//       });
//     }

//     dailyProduction.updated_by = req.user._id;
//     await dailyProduction.save();

//     // 6. Save QC check
//     const qcCheck = new QCCheck(validatedData);
//     await qcCheck.save();

//     return res.status(201).json({
//       success: true,
//       message: "QC Check added successfully",
//       data: qcCheck,
//     });
//   } catch (error) {
//     console.error("Error adding QC Check:", error);
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map((err) => ({
//           field: err.path.join("."),
//           message: err.message,
//         })),
//       });
//     }
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };





export const addQcCheck = async (req, res) => {
  try {
    // 1. Validate request
    const validatedData = qcCheckZodSchema.parse(req.body);
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }
    validatedData.created_by = req.user._id;
    validatedData.updated_by = req.user._id;

    // 2. Ensure production_id is provided
    if (!validatedData.production_id) {
      return res.status(400).json({
        success: false,
        message: "production_id is required to add QC Check",
      });
    }

    // 3. Find the DailyProduction record
    const dailyProduction = await DailyProduction.findById(validatedData.production_id);
    if (!dailyProduction) {
      return res.status(404).json({
        success: false,
        message: `DailyProduction ${validatedData.production_id} not found`,
      });
    }

    // 4. Ensure the product exists in that production
    const productIndex = dailyProduction.products.findIndex(
      (p) => p.product_id.toString() === validatedData.product_id.toString()
    );
    if (productIndex === -1) {
      return res.status(400).json({
        success: false,
        message: `Product ${validatedData.product_id} not found in production ${validatedData.production_id}`,
      });
    }
    if (dailyProduction.status === "Pending QC") {
      dailyProduction.status = "Pending";
      dailyProduction.started_at = null;
      dailyProduction.stopped_at = null;
    }

    // 5. Update rejected & recycled qty + adjust achieved qty
    dailyProduction.products[productIndex].rejected_quantity += validatedData.rejected_quantity || 0;
    dailyProduction.products[productIndex].recycled_quantity += validatedData.recycled_quantity || 0;

    // Calculate total quantity to deduct from achieved_quantity
    const totalDeduct = (validatedData.rejected_quantity || 0) + (validatedData.recycled_quantity || 0);

    // Deduct the total quantity from achieved_quantity
    dailyProduction.products[productIndex].achieved_quantity -= totalDeduct;

    if (dailyProduction.products[productIndex].achieved_quantity < 0) {
      dailyProduction.products[productIndex].achieved_quantity = 0; // safety
    }

    dailyProduction.updated_by = req.user._id;
    await dailyProduction.save();

    // 6. Save QC check
    const qcCheck = new QCCheck(validatedData);
    await qcCheck.save();

    return res.status(201).json({
      success: true,
      message: "QC Check added successfully",
      data: qcCheck,
    });
  } catch (error) {
    console.error("Error adding QC Check:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};










//FOR UPDATING DAILY PRODUCTION DATA BELLOW API WILL DO IF WE ARE ADDING REJECTED AND RECYCLED QUANTITY ---- >>>>>>
export const updateQCStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { job_order, product_id, rejected_quantity, recycled_quantity, status } = req.body;
    const userId = req.user._id;

    const dailyProduction = await DailyProduction.findOne({ job_order }).session(session);
    if (!dailyProduction) {
      return res.status(404).json({
        success: false,
        message: 'Daily production not found.',
      });
    }

    dailyProduction.products = dailyProduction.products.map((p) =>
      p.product_id.equals(product_id)
        ? {
          ...p.toObject(),
          rejected_quantity: rejected_quantity || p.rejected_quantity,
          recycled_quantity: recycled_quantity || p.recycled_quantity,
        }
        : p
    );
    dailyProduction.status = status || dailyProduction.status;
    dailyProduction.qc_checked_by = userId;
    dailyProduction.updated_by = userId;

    await dailyProduction.save({ session });

    // Update Inventory
    const inventory = await Inventory.findOne({
      work_order: dailyProduction.work_order,
      product: product_id,
    }).session(session);
    if (inventory) {
      const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
      inventory.produced_quantity = product.achieved_quantity - (product.rejected_quantity || 0);
      inventory.updated_by = userId;
      await inventory.save({ session });
    }

    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: 'QC status updated successfully.',
      data: dailyProduction,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const getQcCheckDetails = async (req, res) => {
  try {
    let qcCheckData = await QCCheck.find()
      .select('work_order job_order product_id rejected_quantity recycled_quantity remarks created_by createdAt')
      .populate('work_order', 'work_order_number') // Populate work_order_number
      .populate('job_order', 'job_order_id') // Populate work_order_number
      .populate('product_id', 'description')
      .populate('created_by', 'username')
      .lean();
    // console.log("qcCheckData",qcCheckData);

    if (!qcCheckData || qcCheckData.length === 0) {
      return res.status(400).json({ success: true, message: "No Qc data found.", data: [] });
    }

    // Transform data to include work_order_number directly
    const transformedData = qcCheckData.map((qc) => ({
      _id: qc._id,
      work_order: qc.work_order?._id || null, // Keep work_order ObjectId
      work_order_number: qc.work_order?.work_order_number || 'N/A', // Add work_order_number
      job_order: qc.job_order?._id || null,
      job_order_number: qc.job_order?.job_order_id || 'N/A', // Add work_order_number
      product_id: qc.product_id,
      rejected_quantity: qc.rejected_quantity,
      recycled_quantity: qc.recycled_quantity,
      remarks: qc.remarks,
      created_by: qc.created_by,
      createdAt: qc.createdAt,
    }));

    return res.status(200).json({ success: true, message: "Qc data found.", data: transformedData });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error });
  }
};

export const getQcCheckById = async (req, res) => {
  try {
    const qcId = req.params.id;
    console.log("qcId", qcId);

    // Find QC data by ID
    const findQcDataById = await QCCheck.findById(qcId).select(
      'work_order job_order product_id rejected_quantity recycled_quantity remarks created_by createdAt'
    )
      .populate('work_order', 'work_order_number')
      .populate('job_order', '_id job_order_id') // Populate work_order_number
      .populate('product_id', 'description material_code')
      .populate('created_by', 'username')
      .lean();

    // Check if data exists
    if (!findQcDataById) {
      return res.status(404).json({
        success: false,
        message: 'QC data not found',
      });
    }
    const transformedData = {
      ...findQcDataById,
      job_order: findQcDataById.job_order
        ? {
          _id: findQcDataById.job_order._id,
          job_order_id: findQcDataById.job_order.job_order_id,
        }
        : null,
    };
    return res.status(200).json({
      success: true,
      message: 'QC data found',
      data: transformedData,
      // data: findQcDataById,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid QC ID',
      });
    }
    console.error('Error fetching QC Check by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const updateQcCheckZodSchema_25_08_2025 = z.object({
  work_order: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid work_order ID',
  }).optional(),
  job_order: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid job_order ID',
  }).optional(),
  product_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid product_id',
  }).optional(),
  rejected_quantity: z.number().min(0, 'Rejected quantity must be non-negative').optional(),
  recycled_quantity: z.number().min(0, 'Recycled quantity must be non-negative').optional(),
  remarks: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
}).strict();

// export const updateQcCheck = async (req, res) => {
//   try {
//     // 1. Validate QC check ID
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid QC check ID',
//       });
//     }

//     // 2. Validate request data using Zod
//     const validatedData = updateQcCheckZodSchema.parse(req.body);

//     // 3. Check for authenticated user
//     if (!req.user?.id) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized: User not authenticated',
//       });
//     }

//     // 4. Add updated_by from authenticated user
//     validatedData.updated_by = req.user._id;

//     // 5. Find and update the QC Check
//     const qcCheck = await QCCheck.findByIdAndUpdate(
//       id,
//       { $set: validatedData },
//       { new: true, runValidators: true } // Return updated document, run schema validators
//     )
//       .populate('work_order', 'work_order_number')
//       .populate('product_id', 'description')
//       .lean();

//     // 6. Check if QC check exists
//     if (!qcCheck) {
//       return res.status(404).json({
//         success: false,
//         message: 'QC check not found',
//       });
//     }

//     // 7. Transform response to match getQcCheckDetails format
//     const transformedData = {
//       work_order: qcCheck.work_order?._id || null,
//       work_order_number: qcCheck.work_order?.work_order_number || 'N/A',
//       job_order: qcCheck.job_order,
//       product_id: qcCheck.product_id?._id || null,
//       product_description: qcCheck.product_id?.description || 'N/A',
//       rejected_quantity: qcCheck.rejected_quantity,
//       recycled_quantity: qcCheck.recycled_quantity,
//       remarks: qcCheck.remarks,
//       created_by: qcCheck.created_by,
//       createdAt: qcCheck.createdAt,
//       updated_by: qcCheck.updated_by,
//       updatedAt: qcCheck.updatedAt,
//       status: qcCheck.status,
//     };

//     // 8. Return success response
//     return res.status(200).json({
//       success: true,
//       message: 'QC check updated successfully',
//       data: transformedData,
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

//     // Handle Mongoose validation errors
//     if (error.name === 'ValidationError') {
//       const formattedErrors = Object.values(error.errors).map((err) => ({
//         field: err.path,
//         message: err.message,
//       }));
//       return res.status(400).json({
//         success: false,
//         errors: formattedErrors,
//       });
//     }

//     // Handle duplicate key errors
//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: 'Duplicate key error',
//         field: Object.keys(error.keyPattern)[0],
//       });
//     }

//     // Handle other errors
//     console.error('Error updating QC Check:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };




export const updateQcCheck_25_08_2025 = async (req, res) => {
  try {
    // 1. Validate QC check ID
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QC check ID',
      });
    }

    // 2. Validate request data
    const validatedData = updateQcCheckZodSchema.parse(req.body);

    // 3. Authenticated user
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated',
      });
    }

    validatedData.updated_by = req.user._id;

    // 4. Fetch old QCCheck for delta calculation
    const oldQcCheck = await QCCheck.findById(id).lean();
    if (!oldQcCheck) {
      return res.status(404).json({
        success: false,
        message: 'QC check not found',
      });
    }

    // 5. Update QCCheck
    const qcCheck = await QCCheck.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true, runValidators: true }
    )
      .populate('work_order', 'work_order_number')
      .populate('product_id', 'description')
      .lean();

    // 6. Update DailyProduction
    if (
      validatedData.rejected_quantity !== undefined ||
      validatedData.recycled_quantity !== undefined
    ) {
      const dailyProduction = await DailyProduction.findOne({
        work_order: oldQcCheck.work_order,
        job_order: oldQcCheck.job_order,
      });

      if (dailyProduction) {
        const product = dailyProduction.products.find(p =>
          p.product_id.toString() === oldQcCheck.product_id.toString()
        );

        if (product) {
          const deltaRejected =
            (validatedData.rejected_quantity ?? oldQcCheck.rejected_quantity) -
            oldQcCheck.rejected_quantity;

          const deltaRecycled =
            (validatedData.recycled_quantity ?? oldQcCheck.recycled_quantity) -
            oldQcCheck.recycled_quantity;

          product.rejected_quantity =
            (product.rejected_quantity || 0) + deltaRejected;

          product.recycled_quantity =
            (product.recycled_quantity || 0) + deltaRecycled;

          dailyProduction.updated_by = req.user._id;
          await dailyProduction.save();
        }
      }
    }

    // 7. Format response
    const transformedData = {
      work_order: qcCheck.work_order?._id || null,
      work_order_number: qcCheck.work_order?.work_order_number || 'N/A',
      job_order: qcCheck.job_order,
      product_id: qcCheck.product_id?._id || null,
      product_description: qcCheck.product_id?.description || 'N/A',
      rejected_quantity: qcCheck.rejected_quantity,
      recycled_quantity: qcCheck.recycled_quantity,
      remarks: qcCheck.remarks,
      created_by: qcCheck.created_by,
      createdAt: qcCheck.createdAt,
      updated_by: qcCheck.updated_by,
      updatedAt: qcCheck.updatedAt,
      status: qcCheck.status,
    };

    return res.status(200).json({
      success: true,
      message: 'QC check updated successfully',
      data: transformedData,
    });

  } catch (error) {
    // Zod validation
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // Mongoose validation
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

    // Duplicate key
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate key error',
        field: Object.keys(error.keyPattern)[0],
      });
    }

    console.error('Error updating QC Check:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};





export const updateQcCheckZodSchema = z.object({
  rejected_quantity: z.number().min(0, 'Rejected quantity must be non-negative').optional(),
  recycled_quantity: z.number().min(0, 'Recycled quantity must be non-negative').optional(),
  remarks: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
}).strict().refine(
  (data) =>
    data.rejected_quantity === undefined ||
    data.recycled_quantity === undefined ||
    data.recycled_quantity <= data.rejected_quantity,
  {
    message: "Recycled quantity cannot exceed rejected quantity",
    path: ["recycled_quantity"],
  }
);




export const updateQcCheck_04_09_2025 = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid QC check ID' });
    }

    const validatedData = updateQcCheckZodSchema.parse(req.body);

    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    validatedData.updated_by = req.user._id;

    // fetch old QC check
    const oldQcCheck = await QCCheck.findById(id);
    if (!oldQcCheck) {
      return res.status(404).json({ success: false, message: 'QC check not found' });
    }

    // update QCCheck
    const qcCheck = await QCCheck.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true, runValidators: true }
    ).populate('work_order', 'work_order_number')
     .populate('product_id', 'description');

    // update related DailyProduction
    if (validatedData.rejected_quantity !== undefined || validatedData.recycled_quantity !== undefined) {
      const dailyProduction = await DailyProduction.findById(oldQcCheck.production_id);
      if (dailyProduction) {
        const product = dailyProduction.products.find(
          p => p.product_id.toString() === oldQcCheck.product_id.toString()
        );
        if (product) {
          // rollback old rejected/recycled quantities
          product.rejected_quantity -= oldQcCheck.rejected_quantity;
          product.recycled_quantity -= oldQcCheck.recycled_quantity;

          // apply new rejected/recycled quantities
          product.rejected_quantity += validatedData.rejected_quantity ?? oldQcCheck.rejected_quantity;
          product.recycled_quantity += validatedData.recycled_quantity ?? oldQcCheck.recycled_quantity;
          
          // Ensure rejected + recycled don't exceed achieved_quantity
          const totalRejectedRecycled = product.rejected_quantity + product.recycled_quantity;
          if (totalRejectedRecycled > product.achieved_quantity) {
            return res.status(400).json({
              success: false,
              message: `Total rejected (${product.rejected_quantity}) + recycled (${product.recycled_quantity}) quantities cannot exceed achieved quantity (${product.achieved_quantity})`
            });
          }

          dailyProduction.updated_by = req.user._id;
          await dailyProduction.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'QC check updated successfully',
      data: qcCheck
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
      });
    }
    console.error('Error updating QC Check:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};


// export const updateQcCheck = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ success: false, message: 'Invalid QC check ID' });
//     }
//     const validatedData = updateQcCheckZodSchema.parse(req.body);
//     if (!req.user?._id) {
//       return res.status(401).json({ success: false, message: 'Unauthorized' });
//     }
//     validatedData.updated_by = req.user._id;

//     // Fetch old QC check
//     const oldQcCheck = await QCCheck.findById(id);
//     if (!oldQcCheck) {
//       return res.status(404).json({ success: false, message: 'QC check not found' });
//     }

//     // Update QCCheck
//     const qcCheck = await QCCheck.findByIdAndUpdate(
//       id,
//       { $set: validatedData },
//       { new: true, runValidators: true }
//     ).populate('work_order', 'work_order_number')
//      .populate('product_id', 'description');

//     // Update related DailyProduction
//     if (validatedData.rejected_quantity !== undefined || validatedData.recycled_quantity !== undefined) {
//       const dailyProduction = await DailyProduction.findById(oldQcCheck.production_id);
//       if (dailyProduction) {

//          // Check if the production status is "Pending QC"
//          if (dailyProduction.status === "Pending QC") {
//           dailyProduction.status = "Pending";
//           dailyProduction.started_at = null;
//           dailyProduction.stopped_at = null;
//         }

//         const product = dailyProduction.products.find(
//           p => p.product_id.toString() === oldQcCheck.product_id.toString()
//         );
//         if (product) {
//           // Rollback old rejected/recycled values
//           product.rejected_quantity -= (oldQcCheck.rejected_quantity || 0);
//           product.recycled_quantity -= (oldQcCheck.recycled_quantity || 0);

//           // Apply new rejected/recycled values
//           product.rejected_quantity += (validatedData.rejected_quantity ?? oldQcCheck.rejected_quantity) || 0;
//           product.recycled_quantity += (validatedData.recycled_quantity ?? oldQcCheck.recycled_quantity) || 0;
          
//           // Ensure rejected + recycled don't exceed achieved_quantity
//           const totalRejectedRecycled = product.rejected_quantity + product.recycled_quantity;
//           if (totalRejectedRecycled > product.achieved_quantity) {
//             return res.status(400).json({
//               success: false,
//               message: `Total rejected (${product.rejected_quantity}) + recycled (${product.recycled_quantity}) quantities cannot exceed achieved quantity (${product.achieved_quantity})`
//             });
//           }

//           dailyProduction.updated_by = req.user._id;
//           await dailyProduction.save();
//         }
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'QC check updated successfully',
//       data: qcCheck
//     });
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
//       });
//     }
//     console.error('Error updating QC Check:', error);
//     return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
//   }
// };








export const updateQcCheck = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid QC check ID' });
    }
    const validatedData = updateQcCheckZodSchema.parse(req.body);
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    validatedData.updated_by = req.user._id;

    // Fetch old QC check
    const oldQcCheck = await QCCheck.findById(id);
    if (!oldQcCheck) {
      return res.status(404).json({ success: false, message: 'QC check not found' });
    }

    // Update QCCheck
    const qcCheck = await QCCheck.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true, runValidators: true }
    ).populate('work_order', 'work_order_number')
     .populate('product_id', 'description');

    // Update related DailyProduction
    if (validatedData.rejected_quantity !== undefined || validatedData.recycled_quantity !== undefined) {
      const dailyProduction = await DailyProduction.findById(oldQcCheck.production_id);
      if (dailyProduction) {

         // Check if the production status is "Pending QC"
         if (dailyProduction.status === "Pending QC") {
          dailyProduction.status = "Pending";
          dailyProduction.started_at = null;
          dailyProduction.stopped_at = null;
        }

        const product = dailyProduction.products.find(
          p => p.product_id.toString() === oldQcCheck.product_id.toString()
        );
        if (product) {
          // Rollback old values
          product.rejected_quantity -= (oldQcCheck.rejected_quantity || 0);
          product.recycled_quantity -= (oldQcCheck.recycled_quantity || 0);
          product.achieved_quantity += (oldQcCheck.rejected_quantity || 0) + (oldQcCheck.recycled_quantity || 0);

          // Apply new values
          product.rejected_quantity += (validatedData.rejected_quantity ?? oldQcCheck.rejected_quantity) || 0;
          product.recycled_quantity += (validatedData.recycled_quantity ?? oldQcCheck.recycled_quantity) || 0;

          // Deduct both rejected and recycled quantities from achieved_quantity
          const totalDeduct = ((validatedData.rejected_quantity ?? oldQcCheck.rejected_quantity) || 0) +
                              ((validatedData.recycled_quantity ?? oldQcCheck.recycled_quantity) || 0);
          product.achieved_quantity -= totalDeduct;

          if (product.achieved_quantity < 0) product.achieved_quantity = 0;

          dailyProduction.updated_by = req.user._id;
          await dailyProduction.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'QC check updated successfully',
      data: qcCheck
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
      });
    }
    console.error('Error updating QC Check:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};







// Zod schema for deletion
const deleteQcCheckZodSchema = z.object({
  ids: z.array(
    z.string().refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid QC check ID',
    })
  ).min(1, 'At least one ID is required'),
}).strict();

export const deleteQcCheck = async (req, res) => {
  try {
    // 1. Check for authenticated user
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated',
      });
    }

    // 2. Validate request body
    const validatedData = deleteQcCheckZodSchema.parse(req.body);
    const idsToDelete = validatedData.ids;
    console.log("idsToDelete", idsToDelete);

    // 3. Delete QC checks
    const result = await QCCheck.deleteMany({
      _id: { $in: idsToDelete.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    // 4. Check if any documents were deleted
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No QC checks found for the provided IDs',
      });
    }

    // 5. Return success response
    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} QC check(s) deleted successfully`,
      data: { deletedCount: result.deletedCount },
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
    console.error('Error deleting QC Check(s):', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getProductByJobOrderZodSchema = z.object({
  id: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid job order ID',
  }),
}).strict();


export const getProductByJobOrder1 = async (req, res) => {
  try {
    // 1. Validate query parameter
    const validatedQuery = getProductByJobOrderZodSchema.parse(req.query);
    const joId = validatedQuery.id;

    // 2. Find job order and populate work_order and products
    const jobOrder = await JobOrder.findById(joId)
      .select('work_order products')
      .populate({
        path: 'work_order',
        select: 'work_order_number',
      })
      .populate({
        path: 'products.product',
        select: 'description material_code',
        match: { isDeleted: false }, // Only include non-deleted products
      })
      .lean();

    // 3. Check if job order exists
    if (!jobOrder) {
      return res.status(404).json({
        success: false,
        message: 'Job order not found',
      });
    }

    // 4. Extract work order details
    const workOrder = jobOrder.work_order
      ? {
        _id: jobOrder.work_order._id,
        work_order_number: jobOrder.work_order.work_order_number || 'N/A',
      }
      : null;

    // 5. Extract products and filter out null entries
    const products = jobOrder.products
      .filter((item) => item.product) // Exclude entries where product is null
      .map((item) => ({
        _id: item.product._id,
        description: item.product.description,
        material_code: item.product.material_code || 'N/A', // Include material_code, fallback to 'N/A' if not present
      }));

    // 6. Return success response
    return res.status(200).json({
      success: true,
      message: products.length > 0 || workOrder ? 'Work order and products found for job order' : 'No products found for job order',
      data: {
        work_order: workOrder,
        products: products,
      },
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
    console.error('Error fetching work order and products for job order:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

export const getProductByJobOrder_24_08_2025 = async (req, res) => {
  try {
    // 1. Validate query parameter
    const validatedQuery = getProductByJobOrderZodSchema.parse(req.query);
    const joId = validatedQuery.id;

    // 2. Find active QC checks for the job order
    const qcChecks = await QCCheck.find({
      job_order: joId,
      status: 'Active',
    })
      .select('product_id')
      .lean();

    // Extract product IDs with active QC checks
    const qcProductIds = qcChecks.map((qc) => qc.product_id.toString());

    // 3. Find job order and populate work_order and products
    const jobOrder = await JobOrder.findById(joId)
      .select('work_order products')
      .populate({
        path: 'work_order',
        select: 'work_order_number',
      })
      .populate({
        path: 'products.product',
        select: 'description material_code',
        match: { isDeleted: false }, // Only include non-deleted products
      })
      .lean();
    console.log("jobOrder", jobOrder);

    // 4. Check if job order exists
    if (!jobOrder) {
      return res.status(404).json({
        success: false,
        message: 'Job order not found',
      });
    }

    // 5. Extract work order details
    const workOrder = jobOrder.work_order
      ? {
        _id: jobOrder.work_order._id,
        work_order_number: jobOrder.work_order.work_order_number || 'N/A',
      }
      : null;

    // 6. Extract products, filter out null entries and products with active QC checks
    const products = jobOrder.products
      .filter((item) => item.product && !qcProductIds.includes(item.product._id.toString())) // Exclude null products and those with active QC checks
      .map((item) => ({
        _id: item.product._id,
        description: item.product.description,
        material_code: item.product.material_code || 'N/A', // Include material_code, fallback to 'N/A' if not present
        scheduled_date: item.scheduled_date
      }));

    // 7. Return success response
    return res.status(200).json({
      success: true,
      message:
        products.length > 0 || workOrder
          ? 'Work order and products found for job order'
          : 'No eligible products found for job order (all products may have active QC checks or no products exist)',
      data: {
        work_order: workOrder,
        products: products,
      },
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
    console.error('Error fetching work order and products for job order:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};


export const getProductByJobOrder = async (req, res) => {
  try {
    // 1. Validate query parameter
    const validatedQuery = getProductByJobOrderZodSchema.parse(req.query);
    const joId = validatedQuery.id;

    // 2. Find active QC checks for the job order
    const qcChecks = await QCCheck.find({
      job_order: joId,
      status: "Active",
    })
      .select("product_id")
      .lean();

    const qcProductIds = qcChecks.map((qc) => qc.product_id.toString());

    // 3. Fetch all DailyProduction records for this job order
    const dailyProductions = await DailyProduction.find({ job_order: joId })
      .populate({
        path: "work_order",
        select: "work_order_number",
      })
      .populate({
        path: "products.product_id",
        select: "description material_code",
        match: { isDeleted: false },
      })
      .lean();
    console.log("dailyProductions", dailyProductions);

    if (!dailyProductions || dailyProductions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No DailyProduction records found for this job order",
      });
    }

    // 4. Work order details (same for all DailyProductions of this job order)
    const workOrder = dailyProductions[0].work_order
      ? {
        _id: dailyProductions[0].work_order._id,
        work_order_number:
          dailyProductions[0].work_order.work_order_number || "N/A",
      }
      : null;

    // 5. Flatten products across all DailyProductions
    const products = dailyProductions.flatMap((dp) =>
      dp.products
        // .filter(
        //   (item) =>
        //     item.product_id &&
        //     !qcProductIds.includes(item.product_id._id.toString())
        // )
        .map((item) => ({
          _id: item.product_id._id,
          prod_id: dp._id,
          description: item.product_id.description,
          material_code: item.product_id.material_code || "N/A",
          scheduled_date: dp.date, // take date from DailyProduction
        }))
    );

    // 6. Response
    return res.status(200).json({
      success: true,
      message:
        products.length > 0 || workOrder
          ? "Work order and products found for job order"
          : "No eligible products found for job order (all products may have active QC checks or no products exist)",
      data: {
        work_order: workOrder,
        products: products,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching work order and products for job order:",
      error
    );
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

