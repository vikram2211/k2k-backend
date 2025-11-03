// controllers/workOrderController.js
import { WorkOrder } from '../../models/konkreteKlinkers/workOrder.model.js';
import { JobOrder } from '../../models/konkreteKlinkers/jobOrders.model.js';
import { Project } from '../../models/konkreteKlinkers/helpers/project.model.js';
import { Product } from '../../models/konkreteKlinkers/product.model.js';
import { Dispatch } from '../../models/konkreteKlinkers/dispatch.model.js';
import { QCCheck } from '../../models/konkreteKlinkers/qcCheck.model.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { putObject } from '../../../util/putObject.js';
import { getObject } from '../../../util/getObject.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import mongoose from 'mongoose';
import winston from 'winston';
import { ApiError } from '../../utils/ApiError.js';
import { Inventory } from '../../models/konkreteKlinkers/inventory.model.js';
import { DailyProduction } from '../../models/konkreteKlinkers/dailyProductionPlanning.js';
import { Packing } from '../../models/konkreteKlinkers/packing.model.js';

// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.json(),
//   transports: [new winston.transports.File({ filename: 'logs/app.log' })],
// });

// Define Zod schema for validation
// const createWorkOrderSchema = z
//   .object({
//     client_id: z
//       .string()
//       .regex(/^[0-9a-fA-F]{24}$/, "Invalid Client ID")
//       .optional(), // Make optional initially
//     project_id: z
//       .string()
//       .regex(/^[0-9a-fA-F]{24}$/, "Invalid Project ID")
//       .optional(), // Make optional initially
//     work_order_number: z.string().min(1, "Work Order Number is required"),
//     date: z.date().optional(),
//     buffer_stock: z.boolean().optional(),
//     products: z
//       .array(
//         z.object({
//           product_id: z
//             .string()
//             .regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID"),
//           uom: z.string().min(1, "Unit of Measurement is required"),
//           po_quantity: z.number().min(1, "PO Quantity must be at least 1"),
//           original_sqmt: z.number().min(1, "PO Quantity must be at least 1"),
//           plant_code: z.string().min(1, "Plant Code is required"),
//           delivery_date: z.date().optional(),
//         })
//       )
//       .min(1, "At least one product is required"),
//     files: z
//       .array(
//         z.object({
//           file_name: z.string().min(1, "File Name is required"),
//           file_url: z.string().url("Invalid File URL"),
//         })
//       )
//       .min(1, "At least one file is required"),
//     status: z
//       .enum(["Pending", "In Progress", "Completed", "Cancelled"])
//       .optional(),
//     created_by: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID"),
//     updated_by: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID"),
//     job_orders: z
//       .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid JobOrder ID"))
//       .optional(),
//   })
//   .refine(
//     (data) => {
//       // If buffer_stock is false, client_id and project_id are required
//       if (!data.buffer_stock) {
//         return !!data.client_id && !!data.project_id && !!data.date;
//       }
//       return true; // If buffer_stock is true, no need for client_id/project_id
//     },
//     {
//       message: "Client ID and Project ID and Date are required unless buffer stock is selected",
//       path: ["client_id", "project_id", "date"], // Point to both fields in error
//     }
//   );




const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};




const createWorkOrderSchema = z.object({
  client_id: z.string().refine((val) => !val || mongoose.isValidObjectId(val), {
    message: 'Invalid client ID',
  }).optional(),
  project_id: z.string().refine((val) => !val || mongoose.isValidObjectId(val), {
    message: 'Invalid project ID',
  }).optional(),
  work_order_number: z.string().min(1, 'Work order number is required'),
  date: z.date().optional(),
  buffer_stock: z.boolean().default(false),
  products: z.array(
    z.object({
      product_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid product ID',
      }),
      uom: z.enum(['sqmt', 'nos', 'meter'], { message: 'UOM must be "sqmt" or "nos"' }),
      po_quantity: z.number().min(0, 'PO quantity must be non-negative'),
      qty_in_nos: z.number().min(0, 'Original square meters must be non-negative').refine((val) => !isNaN(val), { message: 'qty_in_nos cannot be NaN' }),      // plant_code: z.string().refine((val) => mongoose.isValidObjectId(val), {
      //   message: 'Invalid plant code',
      // }),
      delivery_date: z.date().optional(),
    })
  ).min(1, 'At least one product is required'),
  files: z.array(
    z.object({
      file_name: z.string().min(1, 'File name is required'),
      file_url: z.string().url('File URL must be a valid URL'),
    })
  ).optional(),
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled']).default('Pending'),
  created_by: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID"),
  updated_by: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID"),
}).strict();

// export const createWorkOrder = async (req, res) => {
//   try {
//     // 1. Parse form-data (already parsed by multer)
//     const bodyData = req.body;
//     console.log("Request body:", bodyData);

//     // 2. Parse stringified products array if needed
//     if (typeof bodyData.products === 'string') {
//       bodyData.products = JSON.parse(bodyData.products);
//       console.log("products", bodyData.products);
//     }

//     // 3. Handle file uploads
//     const uploadedFiles = [];
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         console.log("file", file);
//         const tempFilePath = path.join("./public/temp", file.filename);
//         const fileBuffer = fs.readFileSync(tempFilePath);
//         console.log("fileBuffer", fileBuffer);

//         // Upload to S3
//         const { url } = await putObject(
//           { data: fileBuffer, mimetype: file.mimetype },
//           `work-orders/${Date.now()}-${file.originalname}`
//         );
//         console.log("url", url);

//         // Delete temp file
//         fs.unlinkSync(tempFilePath);

//         uploadedFiles.push({
//           file_name: file.originalname,
//           file_url: url,
//         });
//       }
//     }
//     console.log("uploadedFiles", uploadedFiles);

//     // 4. Prepare and validate data
//     const workOrderData = {
//       ...bodyData,
//       files: uploadedFiles, // Will be empty if no files uploaded
//       date: new Date(bodyData.date),
//       products: bodyData.products.map(product => ({
//         ...product,
//         delivery_date: product.delivery_date ? new Date(product.delivery_date) : undefined,
//       })),
//     };
//     console.log("workOrderData", workOrderData);

//     const validatedData = createWorkOrderSchema.parse(workOrderData);
//     console.log("validatedData", validatedData);


//     // 5. Save to MongoDB
//     const workOrder = new WorkOrder(validatedData);
//     console.log("workOrder", workOrder);
//     await workOrder.save();

//     res.status(201).json({ success: true, data: workOrder });
//   } catch (error) {
//     // Cleanup: Delete temp files on error
//     if (req.files) {
//       req.files.forEach((file) => {
//         const tempFilePath = path.join("./public/temp", file.filename);
//         if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//       });
//     }

//     // Handle Zod Errors
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map((err) => ({
//           field: err.path.join("."),
//           message: err.message,
//         })),
//       });
//     }

//     // Handle Mongoose Errors
//     if (error.name === "ValidationError") {
//       const formattedErrors = Object.values(error.errors).map((err) => ({
//         field: err.path,
//         message: err.message,
//       }));
//       return res.status(400).json({
//         success: false,
//         errors: formattedErrors,
//       });
//     }

//     // Generic Server Error
//     console.error("Error creating WorkOrder:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };


////WORKING --

// export const createWorkOrder = async (req, res) => {
//   try {
//     // 1. Parse form-data (already parsed by multer)
//     const bodyData = req.body;
//     console.log("Request body:", bodyData);

//     // 2. Parse stringified products array if needed
//     if (typeof bodyData.products === 'string') {
//       bodyData.products = JSON.parse(bodyData.products);
//       // console.log("products", bodyData.products);
//     }
//     if (typeof bodyData.buffer_stock === 'string') {
//       bodyData.buffer_stock = JSON.parse(bodyData.buffer_stock);
//       console.log("buffer_stocks", typeof (bodyData.buffer_stock));
//     }

//     // 3. Process products - convert sqmt to nos if needed
//     const processedProducts = await Promise.all(
//       bodyData.products.map(async (product) => {
//         // Get the product details
//         const productDetails = await Product.findById(product.product_id);

//         if (!productDetails) {
//           throw new Error(`Product not found with ID: ${product.product_id}`);
//         }

//         // If UOM is "sqmt", convert to nos using the product's area
//         if (product.uom.toLowerCase() === 'sqmt') {
//           if (!productDetails.area || productDetails.area <= 0) {
//             throw new Error(`Invalid area value (${productDetails.area}) for product ${productDetails.material_code}`);
//           }

//           // Calculate quantity in nos
//           const quantityInNos = Math.floor(product.po_quantity / productDetails.area);
//           // console.log("quantityInNos", quantityInNos)

//           return {
//             ...product,
//             po_quantity: quantityInNos, // Store the calculated nos value 

//             // *******************************NEED TO CHECK WHILE FURTHER DEVELOPMENT******************************* //

//             original_sqmt: product.po_quantity, // Store original sqmt value
//             // conversion_rate: productDetails.area, // Store conversion rate used
//           };
//         }

//         // For "nos", keep as is
//         return product;
//       })
//     );
//     console.log("processedProducts",processedProducts);

//     // 4. Handle file uploads
//     const uploadedFiles = [];
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         const tempFilePath = path.join("./public/temp", file.filename);
//         const fileBuffer = fs.readFileSync(tempFilePath);

//         // Upload to S3
//         const { url } = await putObject(
//           { data: fileBuffer, mimetype: file.mimetype },
//           `work-orders/${Date.now()}-${file.originalname}`
//         );
//         // console.log("aws url",url);

//         // Delete temp file
//         fs.unlinkSync(tempFilePath);

//         uploadedFiles.push({
//           file_name: file.originalname,
//           file_url: url,
//         });
//       }
//     }

//     // 5. Prepare and validate data
//     const workOrderData = {
//       ...bodyData,
//       products: processedProducts, // Use the processed products array
//       files: uploadedFiles,
//       date: new Date(bodyData.date),
//       buffer_stock: bodyData.buffer_stock || false,
//     };

//     // Convert delivery dates if they exist
//     workOrderData.products = workOrderData.products.map(product => ({
//       ...product,
//       delivery_date: product.delivery_date ? new Date(product.delivery_date) : undefined,
//     }));

//     const validatedData = createWorkOrderSchema.parse(workOrderData);

//     // 6. Save to MongoDB
//     const workOrder = new WorkOrder(validatedData);
//     await workOrder.save();

//     res.status(201).json({
//       success: true,
//       data: workOrder,
//       message: "Work order created successfully"
//     });

//   } catch (error) {
//     // Cleanup: Delete temp files on error
//     if (req.files) {
//       req.files.forEach((file) => {
//         const tempFilePath = path.join("./public/temp", file.filename);
//         if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//       });
//     }

//     // Handle different error types
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map((err) => ({
//           field: err.path.join("."),
//           message: err.message,
//         })),
//       });
//     }

//     if (error.name === "ValidationError") {
//       const formattedErrors = Object.values(error.errors).map((err) => ({
//         field: err.path,
//         message: err.message,
//       }));
//       return res.status(400).json({
//         success: false,
//         errors: formattedErrors,
//       });
//     }

//     console.error("Error creating WorkOrder:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal Server Error",
//     });
//   }
// };




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////







//Working fine ------
// export const createWorkOrder = async (req, res) => {
//   // const session = await mongoose.startSession();
//   try {
//     // session.startTransaction();
//     // 1. Parse form-data
//     const bodyData = req.body;
//     console.log("userId", typeof (req.user._id));
//     const userId = req.user._id.toString();


//     // 2. Parse stringified fields if needed
//     if (typeof bodyData.products === 'string') {
//       bodyData.products = JSON.parse(bodyData.products);
//     }
//     if (typeof bodyData.buffer_stock === 'string') {
//       bodyData.buffer_stock = JSON.parse(bodyData.buffer_stock);
//     }

//     // 3. Process products - handle sqmt to nos conversion
//     const processedProducts = await Promise.all(
//       bodyData.products.map(async (product) => {
//         // Get product details
//         const productDetails = await Product.findById(product.product_id);
//         console.log("productDetails", productDetails);

//         if (!productDetails) {
//           throw new Error(`Product not found with ID: ${product.product_id}`);
//         }

//         // Initialize processed product
//         const processedProduct = {
//           ...product,
//           qty_in_nos: 0, // Default to 0
//         };
//         processedProduct.po_quantity = Number(product.po_quantity);

//         // Handle UOM
//         if (product.uom.toLowerCase() === 'sqmt' || product.uom.toLowerCase() === 'metre') {
//           if (!productDetails.area || productDetails.area <= 0) {
//             throw new Error(`Invalid area value (${productDetails.area}) for product ${productDetails.material_code}`);
//           }

//           // Store original sqmt and convert po_quantity to nos
//           // console.log("po_quantity...............",typeof(product.po_quantity));
//           // processedProduct.original_sqmt = Number(product.po_quantity); 
//           // console.log("lalalallalalala",typeof(processedProduct.original_sqmt));
//           processedProduct.qty_in_nos = Math.ceil(Number(product.po_quantity) / productDetails.area);
//           // console.log("nossss",processedProduct.qty_in_nos);
//         }
//         else if (product.uom.toLowerCase() === 'nos') {
//           // Keep po_quantity as-is, original_sqmt remains 0
//           processedProduct.qty_in_nos = Number(product.po_quantity);
//         }
//         else {
//           throw new Error(`Invalid UOM: ${product.uom} for product ${productDetails.material_code}`);
//         }

//         return processedProduct;
//       })
//     );
//     console.log("processedProducts", processedProducts);

//     // 4. Handle file uploads
//     const uploadedFiles = [];
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         const tempFilePath = path.join('./public/temp', file.filename);
//         const fileBuffer = fs.readFileSync(tempFilePath);

//         // Upload to S3
//         const { url } = await putObject(
//           { data: fileBuffer, mimetype: file.mimetype },
//           `work-orders/${Date.now()}-${file.originalname}`
//         );

//         // Delete temp file
//         fs.unlinkSync(tempFilePath);

//         uploadedFiles.push({
//           file_name: file.originalname,
//           file_url: url,
//         });
//       }
//     }

//     // 5. Prepare and validate data
//     const workOrderData = {
//       ...bodyData,
//       products: processedProducts,
//       files: uploadedFiles,
//       date: bodyData.date ? new Date(bodyData.date) : undefined,
//       buffer_stock: bodyData.buffer_stock || false,
//       created_by: userId, // Assuming authentication middleware sets req.user
//       updated_by: userId,
//     };

//     // Convert delivery dates if they exist
//     workOrderData.products = workOrderData.products.map((product) => ({
//       ...product,
//       delivery_date: product.delivery_date ? new Date(product.delivery_date) : undefined,
//     }));
//     // console.log("workOrderData",workOrderData);


//     // 6. Validate with Zod
//     const validatedData = createWorkOrderSchema.parse(workOrderData);
//     console.log("validatedData", validatedData);

//     // 7. Save to MongoDB
//     const workOrder = new WorkOrder(validatedData);

//     const inventoryDocs = validatedData.products.map((product) => ({
//       product: product.product_id,
//       work_order: workOrder._id,
//       produced_quantity: 0,
//       packed_quantity: 0,
//       dispatched_quantity: 0,
//       available_stock: 0,
//       updated_by: userId,
//     }));



//     await Inventory.insertMany(inventoryDocs);//, { session }
//     await workOrder.save({}); //session

//     // await session.commitTransaction();
//     // 8. Return success response
//     res.status(201).json({
//       success: true,
//       data: workOrder,
//       message: 'Work order created successfully',
//     });
//   } catch (error) {
//     // Cleanup: Delete temp files on error
//     console.log("error", error);
//     if (req.files) {
//       req.files.forEach((file) => {
//         const tempFilePath = path.join('./public/temp', file.filename);
//         if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//       });
//     }

//     // Handle different error types
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map((err) => ({
//           field: err.path.join('.'),
//           message: err.message,
//         })),
//       });
//     }

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

//     console.error('Error creating WorkOrder:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message || 'Internal Server Error',
//     });
//   }
// };






////////////////////////////////////////////////////////////////////////////////////////////////////////////////






export const createWorkOrder = async (req, res) => {
  try {
    // 1. Parse form-data
    const bodyData = req.body;
    console.log("bodyData", bodyData);
    const userId = req.user._id.toString();

    // 2. Parse stringified fields if needed
    if (typeof bodyData.products === 'string') {
      bodyData.products = JSON.parse(bodyData.products);
    }
    if (typeof bodyData.buffer_stock === 'string') {
      bodyData.buffer_stock = JSON.parse(bodyData.buffer_stock);
    }

    // 3. Process products - handle sqmt/metre to nos conversion
    const processedProducts = await Promise.all(
      bodyData.products.map(async (product) => {
        // Get product details
        const productDetails = await Product.findById(product.product_id);
        if (!productDetails) {
          throw new Error(`Product not found with ID: ${product.product_id}`);
        }

        // Initialize processed product
        const processedProduct = {
          product_id: product.product_id,
          uom: product.uom,
          po_quantity: Number(product.po_quantity),
          qty_in_nos: 0,
          delivery_date: product.delivery_date,
        };

        // Normalize submitted UOM for validation
        const uomLower = product.uom.toLowerCase();
        const uomMap = {
          sqmt: 'square meter',
          meter: 'meter',
          nos: 'nos',
        };
        const normalizedUOM = uomMap[uomLower] || uomLower;

        // Validate UOM
        const productUOMs = productDetails.uom || [];
        const validUOMs = productUOMs.map(u => u.toLowerCase().replace('/no', '')); // e.g., ['square metre', 'metre']
        if (normalizedUOM !== 'nos' && !validUOMs.includes(normalizedUOM)) {
          throw new Error(`Invalid UOM: ${product.uom} for product ${productDetails.material_code}. Available UOMs: ${productUOMs.join(', ')}`);
        }

        // Handle UOM
        if (uomLower === 'sqmt' || uomLower === 'meter') {
          const areaKey = uomLower === 'sqmt' ? 'Square Meter/No' : 'Meter/No';
          const areaValue = parseFloat(productDetails.areas?.get(areaKey) || '0');
          if (!areaValue || areaValue <= 0) {
            throw new Error(
              `Invalid area value for UOM ${product.uom} in product ${productDetails.material_code}. ` +
              `Expected a positive number for ${areaKey}, got: ${productDetails.areas?.get(areaKey) || 'missing'}`
            );
          }
          processedProduct.qty_in_nos = Math.ceil(Number(product.po_quantity) / areaValue);
        } else if (uomLower === 'nos') {
          processedProduct.qty_in_nos = Number(product.po_quantity);
        } else {
          throw new Error(`Unsupported UOM: ${product.uom} for product ${productDetails.material_code}`);
        }

        return processedProduct;
      })
    );

    // 4. Handle file uploads
    // const uploadedFiles = [];
    // if (req.files && req.files.length > 0) {
    //   for (const file of req.files) {
    //     const tempFilePath = path.join('./public/temp', file.filename);
    //     const fileBuffer = fs.readFileSync(tempFilePath);

    //     // Upload to S3
    //     const { url } = await putObject(
    //       { data: fileBuffer, mimetype: file.mimetype },
    //       `work-orders/${Date.now()}-${file.originalname}`
    //     );

    //     // Delete temp file
    //     fs.unlinkSync(tempFilePath);

    //     uploadedFiles.push({
    //       file_name: file.originalname,
    //       file_url: url,
    //     });
    //   }
    // }


    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        console.log("files", file);

        try {
          const s3Key = `work-orders/${Date.now()}-${sanitizeFilename(file.originalname)}`;
          const { url } = await putObject(
            { data: file.buffer, mimetype: file.mimetype },
            s3Key
          );

          uploadedFiles.push({
            file_name: file.originalname,
            file_url: url,
          });
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: `File upload failed: ${err.message}`,
          });
        }
      }
    }


    // 5. Prepare and validate data
    const workOrderData = {
      ...bodyData,
      products: processedProducts,
      files: uploadedFiles,
      date: bodyData.date ? new Date(bodyData.date) : undefined,
      buffer_stock: bodyData.buffer_stock || false,
      created_by: userId,
      updated_by: userId,
    };

    // Convert delivery dates if they exist
    workOrderData.products = workOrderData.products.map((product) => ({
      ...product,
      delivery_date: product.delivery_date ? new Date(product.delivery_date) : undefined,
    }));

    // 6. Validate with Zod
    const validatedData = createWorkOrderSchema.parse(workOrderData);

    // 7. Save to MongoDB
    const workOrder = new WorkOrder(validatedData);

    const inventoryDocs = validatedData.products.map((product) => ({
      product: product.product_id,
      work_order: workOrder._id,
      produced_quantity: 0,
      packed_quantity: 0,
      dispatched_quantity: 0,
      available_stock: 0,
      updated_by: userId,
    }));

    await Inventory.insertMany(inventoryDocs);
    await workOrder.save();

    // 8. Return success response
    res.status(201).json({
      success: true,
      data: workOrder,
      message: 'Work order created successfully',
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

    console.error('Error creating WorkOrder:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
};







export const getWorkOrder = async (req, res) => {
  try {

    // 1. Read pagination params
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;
    // const skip = (page - 1) * limit;

    // // 2. Count total documents
    // const totalWorkOrders = await WorkOrder.countDocuments({});


    const workOrders = await WorkOrder.find()
      .populate('client_id', 'name')
      .populate('project_id', 'name')
      .populate('created_by', 'username');
    // .skip(skip)
    // .limit(limit)
    // .sort({ createdAt: -1 });

    if (!workOrders?.length) {
      return res.status(404).json({
        success: true,
        message: "No work orders found.",
        data: [] // Explicitly return empty array
      });
    }

    return res.status(200).json({
      success: true,
      message: "Work orders fetched successfully.",
      data: workOrders
    });
    // return res.status(200).json({
    //   success: true,
    //   message: "Work orders fetched successfully.",
    //   data: workOrders,
    //   pagination: {
    //     total: totalWorkOrders,
    //     page,
    //     limit,
    //     totalPages: Math.ceil(totalWorkOrders / limit),
    //   },
    // });

  } catch (error) {
    // Handle Mongoose errors
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    // Handle other errors
    console.error("Error fetching work orders:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/////////////////////////////////////////=========================================///////////////////////////////////////////////
// export const getWorkOrderById = async (req, res) => {
//   try {
//     const woId = req.params.id;

//     const woData = await WorkOrder.findById(woId)
//       .populate({
//         path: 'client_id',
//         select: 'name address',
//         // match: { isDeleted: false }
//       })
//       .populate({
//         path: 'project_id',
//         select: 'name',
//         match: { isDeleted: false },
//         populate: {
//           path: 'client',
//           select: 'name',
//           // match: { isDeleted: false }
//         }
//       })
//       .populate({
//         path: 'created_by',
//         select: 'username userType',
//         // match: { isDeleted: false }
//       })
//       .populate({
//         path: 'updated_by',
//         select: 'username',
//         // match: { isDeleted: false }
//       })
//       .populate({
//         path: 'products.product_id',
//         select: 'description material_code',
//         // match: { isDeleted: false }
//         populate: {
//           path: 'plant',
//           select: 'plant_code',
//           // match: { isDeleted: false }
//         }
//       })
//       // .populate({
//       //   path: 'products.plant_code',
//       //   select: 'plant_name',
//       //   // match: { isDeleted: false }
//       // })
//       .lean(); // Convert to plain JavaScript object
//     // console.log("woData", woData);

//     if (!woData) {
//       return res.status(404).json({
//         success: false,
//         message: `Work Order with id ${woId} not found`
//       });
//     }


//     // Transform the data for better frontend consumption
//     const transformedData = {
//       ...woData,
//       client: woData.client_id, // Flatten client details
//       project: {
//         ...woData.project_id,
//         client: woData.project_id.client // Include client details from project
//       },
//       creator: woData.created_by, // Flatten created_by user
//       updater: woData.updated_by, // Flatten updated_by user
//       products: woData.products.map(product => ({
//         ...product,
//         product: product.product_id, // Flatten product details
//         plant: product.plant_code    // Flatten plant details
//       }))
//     };

//     // Remove the original populated fields
//     delete transformedData.client_id;
//     delete transformedData.project_id;
//     delete transformedData.created_by;
//     delete transformedData.updated_by;
//     transformedData.products.forEach(product => {
//       delete product.product_id;
//       delete product.plant_code;
//     });

//     return res.status(200).json({
//       success: true,
//       message: `Work Order Data for id ${woId} found.`,
//       data: transformedData
//     });

//   } catch (error) {
//     console.log("error", error);
//     if (error.name === 'ValidationError') {
//       const formattedErrors = Object.values(error.errors).map(err => ({
//         field: err.path,
//         message: err.message,
//       }));
//       return res.status(400).json({ success: false, errors: formattedErrors });
//     }

//     if (error.name === 'CastError') {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid ${error.path}: ${error.value}`,
//       });
//     }

//     console.error("Error fetching work order:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// }


export const getWorkOrderById1 = async (req, res) => {
  try {
    const woId = req.params.id;

    const woData = await WorkOrder.findById(woId)
      .populate({
        path: 'client_id',
        select: 'name address',
      })
      .populate({
        path: 'project_id',
        select: 'name',
        match: { isDeleted: false },
        populate: {
          path: 'client',
          select: 'name',
        }
      })
      .populate({
        path: 'created_by',
        select: 'username userType',
      })
      .populate({
        path: 'updated_by',
        select: 'username',
      })
      .populate({
        path: 'products.product_id',
        select: 'description material_code',
        populate: {
          path: 'plant',
          select: 'plant_code',
        }
      })
      .lean();

    if (!woData) {
      return res.status(404).json({
        success: false,
        message: `Work Order with id ${woId} not found`
      });
    }
    const transformedData = {
      ...woData,
      client: woData.client_id || null,
      project: woData.project_id
        ? {
          ...woData.project_id,
          client: woData.project_id.client || null
        }
        : null,
      creator: woData.created_by || null,
      updater: woData.updated_by || null,
      products: woData.products.map(product => ({
        ...product,
        product: product.product_id || null,
        plant: product.product_id?.plant || null
      }))
    };

    delete transformedData.client_id;
    delete transformedData.project_id;
    delete transformedData.created_by;
    delete transformedData.updated_by;
    transformedData.products.forEach(product => {
      delete product.product_id;
      delete product.plant_code;
    });

    return res.status(200).json({
      success: true,
      message: `Work Order Data for id ${woId} found.`,
      data: transformedData
    });

  } catch (error) {
    console.log("error", error);
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    console.error("Error fetching work order:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


export const getWorkOrderByIds = async (req, res) => {
  try {
    const woId = req.params.id;

    const woData = await WorkOrder.findById(woId)
      .populate({
        path: 'client_id',
        select: 'name address',
      })
      .populate({
        path: 'project_id',
        select: 'name',
        match: { isDeleted: false },
        populate: {
          path: 'client',
          select: 'name',
        },
      })
      .populate({
        path: 'created_by',
        select: 'username userType',
      })
      .populate({
        path: 'updated_by',
        select: 'username',
      })
      .populate({
        path: 'products.product_id',
        select: 'description material_code',
        populate: {
          path: 'plant',
          select: 'plant_code',
        },
      })
      .lean();

    if (!woData) {
      return res.status(404).json({
        success: false,
        message: `Work Order with id ${woId} not found`,
      });
    }

    // Fetch aggregated data from DailyProduction for achieved_quantity
    const dailyProductions = await DailyProduction.find({ work_order: woId })
      .select('products.product_id products.achieved_quantity')
      .lean();

    // Aggregate achieved_quantity by product_id
    const achievedQuantities = dailyProductions.reduce((acc, dp) => {
      dp.products.forEach((product) => {
        // console.log("product",product);
        const productId = product.product_id.toString();
        acc[productId] = (acc[productId] || 0) + (product.achieved_quantity || 0);
      });
      return acc;
    }, {});

    // Fetch aggregated data from Packing for packed and dispatched quantities
    const packingData = await Packing.find({
      work_order: woId,
      delivery_stage: { $in: ['Packed', 'Dispatched'] },
    })
      .select('product_id product_quantity delivery_stage')
      .lean();
    // console.log("packingData", packingData);

    // Aggregate packed and dispatched quantities by product_id
    const packingQuantities = packingData.reduce(
      (acc, packing) => {
        // console.log("packing",packing);
        const productId = packing._id.toString(); // Fixed: Use product_id instead of _id
        if (!acc[productId]) {
          acc[productId] = { packed_quantity: 0, dispatched_quantity: 0 };
        }
        if (packing.delivery_stage === 'Packed') {
          acc[productId].packed_quantity += packing.product_quantity || 0;
        } else if (packing.delivery_stage === 'Dispatched') {
          acc[productId].dispatched_quantity += packing.product_quantity || 0;
        }
        return acc;
      },
      {}
    );

    // Transform the response, preserving original key names and renaming product_id to product
    const transformedData = {
      ...woData,
      client_id: woData.client_id || null,
      project_id: woData.project_id
        ? {
          ...woData.project_id,
          client: woData.project_id.client || null,
        }
        : null,
      created_by: woData.created_by || null,
      updated_by: woData.updated_by || null,
      products: woData.products.map((product) => {
        const productId = product.product_id?._id.toString();
        return {
          ...product,
          product: product.product_id || null, // Rename product_id to product
          plant: product.product_id?.plant || null,
          achieved_quantity: achievedQuantities[productId] || 0,
          packed_quantity: packingQuantities[productId]?.packed_quantity || 0,
          dispatched_quantity: packingQuantities[productId]?.dispatched_quantity || 0,
        };
      }),
    };

    // Clean up unwanted fields, preserving original key names
    transformedData.products.forEach((product) => {
      delete product.product_id; // Remove original product_id field
      delete product.plant_code;
    });

    return res.status(200).json({
      success: true,
      message: `Work Order Data for id ${woId} found.`,
      data: transformedData,
    });
  } catch (error) {
    console.log('error', error);
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    console.error('Error fetching work order:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getWorkOrderById2 = async (req, res) => {
  try {
    const woId = req.params.id;

    const woData = await WorkOrder.findById(woId)
      .populate({
        path: 'client_id',
        select: 'name address',
      })
      .populate({
        path: 'project_id',
        select: 'name',
        match: { isDeleted: false },
        populate: {
          path: 'client',
          select: 'name',
        },
      })
      .populate({
        path: 'created_by',
        select: 'username userType',
      })
      .populate({
        path: 'updated_by',
        select: 'username',
      })
      .populate({
        path: 'products.product_id',
        select: 'description material_code uom',
        populate: {
          path: 'plant',
          select: 'plant_code',
        },
      })
      .lean();

    if (!woData) {
      return res.status(404).json({
        success: false,
        message: `Work Order with id ${woId} not found`,
      });
    }

    // Fetch aggregated data from DailyProduction for achieved_quantity
    const dailyProductions = await DailyProduction.find({ work_order: woId })
      .select('products.product_id products.achieved_quantity')
      .lean();

    // Aggregate achieved_quantity by product_id
    const achievedQuantities = dailyProductions.reduce((acc, dp) => {
      dp.products.forEach((product) => {
        const productId = product.product_id.toString();
        acc[productId] = (acc[productId] || 0) + (product.achieved_quantity || 0);
      });
      return acc;
    }, {});

    // Fetch aggregated data from Packing for packed and dispatched quantities
    const packingData = await Packing.find({
      work_order: woId,
      delivery_stage: { $in: ['Packed', 'Dispatched'] },
    })
      .select('product_id product_quantity delivery_stage')
      .lean();

    // Aggregate packed and dispatched quantities by product_id
    const packingQuantities = packingData.reduce(
      (acc, packing) => {
        const productId = packing._id.toString();
        if (!acc[productId]) {
          acc[productId] = { packed_quantity: 0, dispatched_quantity: 0 };
        }
        if (packing.delivery_stage === 'Packed') {
          acc[productId].packed_quantity += packing.product_quantity || 0;
        } else if (packing.delivery_stage === 'Dispatched') {
          acc[productId].dispatched_quantity += packing.product_quantity || 0;
        }
        return acc;
      },
      {}
    );

    // Fetch Packing data for the Packings array
    const packingDetails = await Packing.find({ work_order: woId })
      .select('product product_quantity rejected_quantity createdAt packed_by')
      .populate({
        path: 'product',
        select: 'description',
      })
      .populate({
        path: 'packed_by',
        select: 'username',
      })
      .lean();

    // Aggregate packing details by product
    const packingByProduct = packingDetails.reduce((acc, packing) => {
      const productId = packing.product?._id.toString();
      if (!acc[productId]) {
        acc[productId] = {
          product: packing.product?.description || null,
          date: packing.createdAt,
          total_qty: 0,
          rejected_quantity: 0,
          created_by: packing.packed_by?.username || null,
        };
      }
      acc[productId].total_qty += packing.product_quantity || 0;
      acc[productId].rejected_quantity += packing.rejected_quantity || 0;
      // Use the latest createdAt date for the product
      if (packing.createdAt > acc[productId].date) {
        acc[productId].date = packing.createdAt;
        acc[productId].created_by = packing.packed_by?.username || null;
      }
      return acc;
    }, {});

    // Format Packings array with sl_no
    const packingsArray = Object.values(packingByProduct).map((packing, index) => ({
      sl_no: index + 1,
      product: packing.product,
      date: new Date(packing.date).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).replace(',', ''),
      total_qty: packing.total_qty,
      'Rejected Quantity': packing.rejected_quantity,
      created_by: packing.created_by,
    }));

    // Fetch Dispatch data for the dispatches array
    const dispatchDetails = await Dispatch.find({ work_order: woId })
      .select('products date vehicle_number')
      .populate({
        path: 'products.product_id',
        select: 'description uom',
      })
      .lean();

    // Aggregate dispatch details by product
    const dispatchByProduct = dispatchDetails.reduce((acc, dispatch) => {
      dispatch.products.forEach((product) => {
        const productId = product.product_id?._id.toString();
        if (!acc[productId]) {
          acc[productId] = {
            product: product.product_id?.description || null,
            date: dispatch.date,
            total_qty: 0,
            uom: product.product_id?.uom || null,
            vehicle_number: dispatch.vehicle_number || null,
          };
        }
        acc[productId].total_qty += product.dispatch_quantity || 0;
        // Use the latest date and vehicle_number for the product
        if (dispatch.date > acc[productId].date) {
          acc[productId].date = dispatch.date;
          acc[productId].vehicle_number = dispatch.vehicle_number || null;
        }
      });
      return acc;
    }, {});

    // Format dispatches array with sl_no
    const dispatchesArray = Object.values(dispatchByProduct).map((dispatch, index) => ({
      sl_no: index + 1,
      product: dispatch.product,
      date: new Date(dispatch.date).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).replace(',', ''),
      total_qty: dispatch.total_qty,
      uom: dispatch.uom,
      vehicle_number: dispatch.vehicle_number,
    }));

    // Fetch QC data for the qc_details array
    const qcDetails = await QCCheck.find({ work_order: woId })
      .select('product_id rejected_quantity recycled_quantity remarks')
      .populate({
        path: 'product_id',
        select: 'description',
      })
      .lean();

    // Aggregate QC details by product
    const qcByProduct = qcDetails.reduce((acc, qc) => {
      const productId = qc.product_id?._id.toString();
      if (!acc[productId]) {
        acc[productId] = {
          product: qc.product_id?.description || null,
          recycled_quantity: 0,
          rejected_quantity: 0,
          remarks: qc.remarks || null,
        };
      }
      acc[productId].recycled_quantity += qc.recycled_quantity || 0;
      acc[productId].rejected_quantity += qc.rejected_quantity || 0;
      // Use the latest remarks for the product
      if (qc.remarks && (!acc[productId].remarks || qc.createdAt > acc[productId].createdAt)) {
        acc[productId].remarks = qc.remarks;
        acc[productId].createdAt = qc.createdAt;
      }
      return acc;
    }, {});

    // Format qc_details array with sl_no
    const qcDetailsArray = Object.values(qcByProduct).map((qc, index) => ({
      sl_no: index + 1,
      product: qc.product,
      recycled_quantity: qc.recycled_quantity,
      rejected_quantity: qc.rejected_quantity,
      remarks: qc.remarks,
    }));

    // Fetch Job Orders directly from JobOrder model where work_order matches woId
    const jobOrders = await JobOrder.find({ work_order: woId })
      .select('job_order_id work_order sales_order_number products batch_number date status created_by updated_by createdAt updatedAt')
      .populate([
        {
          path: 'products.product',
          select: 'description material_code',
        },
        {
          path: 'products.machine_name',
          select: 'name',
        },
        {
          path: 'created_by',
          select: 'username userType',
        },
        {
          path: 'updated_by',
          select: 'username',
        },
      ])
      .lean();

    // Fetch DailyProduction data for each JobOrder, including downtime
    const jobOrdersWithProduction = await Promise.all(
      jobOrders.map(async (jobOrder) => {
        const dailyProductionData = await DailyProduction.find({ job_order: jobOrder._id })
          .select('products date submitted_by started_at stopped_at qc_checked_by status downtime created_by updated_by createdAt updatedAt')
          .populate({
            path: 'products.product_id',
            select: 'description material_code',
          })
          .populate({
            path: 'submitted_by',
            select: 'username userType',
          })
          .populate({
            path: 'qc_checked_by',
            select: 'username',
          })
          .lean();
        console.log("dailyProductionDatassssss", dailyProductionData);

        // Transform daily production data to rename product_id to product
        const transformedDailyProduction = dailyProductionData.map((dp) => ({
          ...dp,
          products: dp.products.map((prod) => ({
            ...prod,
            product: prod.product_id || null,
          })).map((prod) => {
            delete prod.product_id;
            return prod;
          }),
          submitted_by: dp.submitted_by || null,
          qc_checked_by: dp.qc_checked_by || null,
          created_by: dp.created_by || null,
          updated_by: dp.updated_by || null,
          downtime: dp.downtime || [],
        }));

        // Transform job order products to include uom and po_quantity from WorkOrder
        const transformedJobOrder = {
          ...jobOrder,
          products: jobOrder.products.map((prod) => {
            const woProduct = woData.products.find(
              (woProd) => woProd.product_id && woProd.product_id._id.toString() === prod.product?._id.toString()
            );
            return {
              ...prod,
              product: prod.product || null,
              machine_name: prod.machine_name || null,
              uom: woProduct?.uom || null,
              po_quantity: woProduct?.po_quantity || null,
            };
          }),
          created_by: jobOrder.created_by || null,
          updated_by: jobOrder.updated_by || null,
          daily_production: transformedDailyProduction,
        };

        return transformedJobOrder;
      })
    );

    // Transform the response, preserving original key names and renaming product_id to product
    const transformedData = {
      ...woData,
      client_id: woData.client_id || null,
      project_id: woData.project_id
        ? {
          ...woData.project_id,
          client: woData.project_id.client || null,
        }
        : null,
      created_by: woData.created_by || null,
      updated_by: woData.updated_by || null,
      products: woData.products.map((product) => {
        const productId = product.product_id?._id.toString();
        return {
          ...product,
          product: product.product_id || null,
          plant: product.product_id?.plant || null,
          achieved_quantity: achievedQuantities[productId] || 0,
          packed_quantity: packingQuantities[productId]?.packed_quantity || 0,
          dispatched_quantity: packingQuantities[productId]?.dispatched_quantity || 0,
        };
      }),
      job_orders: jobOrdersWithProduction,
      Packings: packingsArray,
      dispatches: dispatchesArray,
      qc_details: qcDetailsArray,
    };

    // Clean up unwanted fields, preserving original key names
    transformedData.products.forEach((product) => {
      delete product.product_id;
      delete product.plant_code;
    });

    return res.status(200).json({
      success: true,
      message: `Work Order Data for id ${woId} found.`,
      data: transformedData,
    });
  } catch (error) {
    console.log('error', error);
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    console.error('Error fetching work order:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


export const getWorkOrderById = async (req, res) => {
  try {
    const woId = req.params.id;

    const woData = await WorkOrder.findById(woId)
      .populate({
        path: 'client_id',
        select: 'name address',
      })
      .populate({
        path: 'project_id',
        select: 'name',
        match: { isDeleted: false },
        populate: {
          path: 'client',
          select: 'name',
        },
      })
      .populate({
        path: 'created_by',
        select: 'username userType',
      })
      .populate({
        path: 'updated_by',
        select: 'username',
      })
      .populate({
        path: 'products.product_id',
        select: 'description material_code uom',
        populate: {
          path: 'plant',
          select: 'plant_code',
        },
      })
      .populate({
        path: 'buffer_transfer_logs',
        select: 'from_work_order_id to_work_order_id product_id quantity_transferred transferred_by transfer_date isBufferTransfer',
        populate: [
          {
            path: 'from_work_order_id',
            select: 'work_order_number',
          },
          {
            path: 'to_work_order_id',
            select: 'work_order_number',
          },
          {
            path: 'product_id',
            select: 'description material_code',
          },
          {
            path: 'transferred_by',
            select: 'username',
          },
        ],
      })
      .lean();

    if (!woData) {
      return res.status(404).json({
        success: false,
        message: `Work Order with id ${woId} not found`,
      });
    }
    console.log("woData", woData);


    // Fetch aggregated data from DailyProduction for achieved_quantity
    const dailyProductions = await DailyProduction.find({ work_order: woId })
      .select('products.product_id products.achieved_quantity')
      .lean();

    // Aggregate achieved_quantity by product_id
    const achievedQuantities = dailyProductions.reduce((acc, dp) => {
      dp.products.forEach((product) => {
        const productId = product.product_id.toString();
        acc[productId] = (acc[productId] || 0) + (product.achieved_quantity || 0);
      });
      return acc;
    }, {});

    // Fetch packed and dispatched quantities from Inventory
    const inventoryData = await Inventory.find({ work_order: woId })
      .select('product packed_quantity dispatched_quantity')
      .lean();

    // Map inventory quantities by product_id
    const inventoryQuantities = inventoryData.reduce((acc, inventory) => {
      const productId = inventory.product.toString();
      acc[productId] = {
        packed_quantity: inventory.packed_quantity || 0,
        dispatched_quantity: inventory.dispatched_quantity || 0,
      };
      return acc;
    }, {});

    // Fetch Packing data for the Packings array
    const packingDetails = await Packing.find({ work_order: woId })
      .select('product product_quantity rejected_quantity createdAt packed_by')
      .populate({
        path: 'product',
        select: 'description',
      })
      .populate({
        path: 'packed_by',
        select: 'username',
      })
      .lean();

    // Aggregate packing details by product
    const packingByProduct = packingDetails.reduce((acc, packing) => {
      const productId = packing.product?._id.toString();
      if (!acc[productId]) {
        acc[productId] = {
          product: packing.product?.description || null,
          date: packing.createdAt,
          total_qty: 0,
          rejected_quantity: 0,
          created_by: packing.packed_by?.username || null,
        };
      }
      acc[productId].total_qty += packing.product_quantity || 0;
      acc[productId].rejected_quantity += packing.rejected_quantity || 0;
      // Use the latest createdAt date for the product
      if (packing.createdAt > acc[productId].date) {
        acc[productId].date = packing.createdAt;
        acc[productId].created_by = packing.packed_by?.username || null;
      }
      return acc;
    }, {});

    // Format Packings array with sl_no
    const packingsArray = Object.values(packingByProduct).map((packing, index) => ({
      sl_no: index + 1,
      product: packing.product,
      date: new Date(packing.date).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).replace(',', ''),
      total_qty: packing.total_qty,
      'Rejected Quantity': packing.rejected_quantity,
      created_by: packing.created_by,
    }));

    // Fetch Dispatch data for the dispatches array
    const dispatchDetails = await Dispatch.find({ work_order: woId })
      .select('products date vehicle_number')
      .populate({
        path: 'products.product_id',
        select: 'description uom',
      })
      .lean();

    // Aggregate dispatch details by product
    const dispatchByProduct = dispatchDetails.reduce((acc, dispatch) => {
      dispatch.products.forEach((product) => {
        const productId = product.product_id?._id.toString();
        if (!acc[productId]) {
          acc[productId] = {
            product: product.product_id?.description || null,
            date: dispatch.date,
            total_qty: 0,
            uom: product.product_id?.uom || null,
            vehicle_number: dispatch.vehicle_number || null,
          };
        }
        acc[productId].total_qty += product.dispatch_quantity || 0;
        // Use the latest date and vehicle_number for the product
        if (dispatch.date > acc[productId].date) {
          acc[productId].date = dispatch.date;
          // acc[productId].vehicle_number = dispatch.vehicle_number || null;
        }
      });
      return acc;
    }, {});

    // Format dispatches array with sl_no
    const dispatchesArray = Object.values(dispatchByProduct).map((dispatch, index) => ({
      sl_no: index + 1,
      product: dispatch.product,
      date: new Date(dispatch.date).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(',', ''),
      total_qty: dispatch.total_qty,
      uom: dispatch.uom,
      vehicle_number: dispatch.vehicle_number,
    }));

    // Fetch QC data for the qc_details array
    const qcDetails = await QCCheck.find({ work_order: woId })
      .select('product_id rejected_quantity recycled_quantity remarks')
      .populate({
        path: 'product_id',
        select: 'description',
      })
      .lean();

    // Aggregate QC details by product
    const qcByProduct = qcDetails.reduce((acc, qc) => {
      const productId = qc.product_id?._id.toString();
      if (!acc[productId]) {
        acc[productId] = {
          product: qc.product_id?.description || null,
          recycled_quantity: 0,
          rejected_quantity: 0,
          remarks: qc.remarks || null,
        };
      }
      acc[productId].recycled_quantity += qc.recycled_quantity || 0;
      acc[productId].rejected_quantity += qc.rejected_quantity || 0;
      // Use the latest remarks for the product
      if (qc.remarks && (!acc[productId].remarks || qc.createdAt > acc[productId].createdAt)) {
        acc[productId].remarks = qc.remarks;
        acc[productId].createdAt = qc.createdAt;
      }
      return acc;
    }, {});

    // Format qc_details array with sl_no
    const qcDetailsArray = Object.values(qcByProduct).map((qc, index) => ({
      sl_no: index + 1,
      product: qc.product,
      recycled_quantity: qc.recycled_quantity,
      rejected_quantity: qc.rejected_quantity,
      remarks: qc.remarks,
    }));

    // Fetch Job Orders directly from JobOrder model where work_order matches woId
    const jobOrders = await JobOrder.find({ work_order: woId })
      .select('job_order_id work_order sales_order_number products batch_number date status created_by updated_by createdAt updatedAt')
      .populate([
        {
          path: 'products.product',
          select: 'description material_code',
        },
        {
          path: 'products.machine_name',
          select: 'name',
        },
        {
          path: 'created_by',
          select: 'username userType',
        },
        {
          path: 'updated_by',
          select: 'username',
        },
      ])
      .lean();

    // Fetch DailyProduction data for each JobOrder, including downtime
    const jobOrdersWithProduction = await Promise.all(
      jobOrders.map(async (jobOrder) => {
        const dailyProductionData = await DailyProduction.find({ job_order: jobOrder._id })
          .select('products date submitted_by started_at stopped_at qc_checked_by status downtime created_by updated_by createdAt updatedAt')
          .populate({
            path: 'products.product_id',
            select: 'description material_code',
          })
          .populate({
            path: 'submitted_by',
            select: 'username userType',
          })
          .populate({
            path: 'qc_checked_by',
            select: 'username',
          })
          .lean();

        // Transform daily production data to rename product_id to product
        const transformedDailyProduction = dailyProductionData.map((dp) => ({
          ...dp,
          products: dp.products.map((prod) => ({
            ...prod,
            product: prod.product_id || null,
          })).map((prod) => {
            delete prod.product_id;
            return prod;
          }),
          submitted_by: dp.submitted_by || null,
          qc_checked_by: dp.qc_checked_by || null,
          created_by: dp.created_by || null,
          updated_by: dp.updated_by || null,
          downtime: dp.downtime || [],
        }));

        // Transform job order products to include uom, po_quantity, and daily_production
        const transformedJobOrder = {
          ...jobOrder,
          products: jobOrder.products.map((prod) => {
            const woProduct = woData.products.find(
              (woProd) => woProd.product_id && woProd.product_id._id.toString() === prod.product?._id.toString()
            );
            // Find the daily production record for this product
            const productDailyProduction = transformedDailyProduction.find((dp) =>
              dp.products.some((p) => p.product?._id.toString() === prod.product?._id.toString())
            );
            return {
              ...prod,
              product: prod.product || null,
              machine_name: prod.machine_name || null,
              uom: woProduct?.uom || null,
              po_quantity: woProduct?.po_quantity || null,
              daily_production: productDailyProduction || null,
            };
          }),
          created_by: jobOrder.created_by || null,
          updated_by: jobOrder.updated_by || null,
        };

        return transformedJobOrder;
      })
    );

    // Transform the response, preserving original key names and renaming product_id to product
    const transformedData = {
      ...woData,
      client_id: woData.client_id || null,
      project_id: woData.project_id
        ? {
          ...woData.project_id,
          client: woData.project_id.client || null,
        }
        : null,
      created_by: woData.created_by || null,
      updated_by: woData.updated_by || null,
      products: woData.products.map((product) => {
        const productId = product.product_id?._id.toString();
        return {
          ...product,
          product: product.product_id || null,
          plant: product.product_id?.plant || null,
          achieved_quantity: achievedQuantities[productId] || 0,
          packed_quantity: inventoryQuantities[productId]?.packed_quantity || 0,
          dispatched_quantity: inventoryQuantities[productId]?.dispatched_quantity || 0,
        };
      }),
      job_orders: jobOrdersWithProduction,
      Packings: packingsArray,
      dispatches: dispatchesArray,
      qc_details: qcDetailsArray,
      buffer_transfer_logs: woData.buffer_transfer_logs
      ? woData.buffer_transfer_logs.map((log) => ({
          _id: log._id,
          from_work_order_id: log.from_work_order_id?.work_order_number || null,
          to_work_order_id: log.to_work_order_id?.work_order_number || null,
          material_code: log.product_id?.material_code || null,
          description: log.product_id?.description || null,
          quantity_transferred: log.quantity_transferred,
          transferred_by: log.transferred_by?.username || null,
          transfer_date: log.transfer_date,
          isBufferTransfer: log.isBufferTransfer,
        }))
      : [],
    };
    console.log("transformedData", transformedData);

    // Clean up unwanted fields, preserving original key names
    transformedData.products.forEach((product) => {
      delete product.product_id;
      delete product.plant_code;
    });

    return res.status(200).json({
      success: true,
      message: `Work Order Data for id ${woId} found.`,
      data: transformedData,
    });
  } catch (error) {
    console.log('error', error);
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    console.error('Error fetching work order:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
////////////////////////////////////////////======================================////////////////////////////////////////////


// export const getWorkOrderById = async (req, res) => {
//   try {
//     const woId = req.params.id;

//     const woData = await WorkOrder.findById(woId)
//       .populate({
//         path: 'client_id',
//         select: 'name address',
//       })
//       .populate({
//         path: 'project_id',
//         select: 'name',
//         match: { isDeleted: false },
//         populate: {
//           path: 'client',
//           select: 'name',
//         }
//       })
//       .populate({
//         path: 'created_by',
//         select: 'username userType',
//       })
//       .populate({
//         path: 'updated_by',
//         select: 'username',
//       })
//       .populate({
//         path: 'products.product_id',
//         select: 'description material_code',
//       })
//       .lean(); // Convert to plain JavaScript object

//     if (!woData) {
//       return res.status(404).json({
//         success: false,
//         message: `Work Order with id ${woId} not found`
//       });
//     }

//     // Generate pre-signed URLs for each file
//     const filesWithUrls = await Promise.all(
//       woData.files.map(async (file) => {
//         const url = await getObject(file.file_url); 
//         return {
//           ...file,
//           file_url: url,
//         };
//       })
//     );

//     // Transform the data for better frontend consumption
//     const transformedData = {
//       ...woData,
//       client: woData.client_id, // Flatten client details
//       project: {
//         ...woData.project_id,
//         client: woData.project_id.client // Include client details from project
//       },
//       creator: woData.created_by, // Flatten created_by user
//       updater: woData.updated_by, // Flatten updated_by user
//       products: woData.products.map(product => ({
//         ...product,
//         product: product.product_id, // Flatten product details
//         plant: product.plant_code    // Flatten plant details
//       })),
//       files: filesWithUrls, // Include files with pre-signed URLs
//     };

//     // Remove the original populated fields
//     delete transformedData.client_id;
//     delete transformedData.project_id;
//     delete transformedData.created_by;
//     delete transformedData.updated_by;
//     transformedData.products.forEach(product => {
//       delete product.product_id;
//       delete product.plant_code;
//     });

//     return res.status(200).json({
//       success: true,
//       message: `Work Order Data for id ${woId} found.`,
//       data: transformedData
//     });

//   } catch (error) {
//     console.log("error", error);
//     if (error.name === 'ValidationError') {
//       const formattedErrors = Object.values(error.errors).map(err => ({
//         field: err.path,
//         message: err.message,
//       }));
//       return res.status(400).json({ success: false, errors: formattedErrors });
//     }

//     if (error.name === 'CastError') {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid ${error.path}: ${error.value}`,
//       });
//     }

//     console.error("Error fetching work order:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };




export const updateWorkOrder = async (req, res) => {
  try {
    // 1. Get work order ID from params
    const { id } = req.params;

    // 2. Check if work order exists
    const existingWorkOrder = await WorkOrder.findById(id);
    if (!existingWorkOrder) {
      return res.status(400).json({
        success: false,
        message: "Work order not found",
      });
    }

    // 3. Parse form-data
    const bodyData = req.body;

    // 4. Initialize update data object
    const updateData = {};

    if (bodyData.work_order_number) {
      updateData.work_order_number = bodyData.work_order_number;
    }

    // Handle client_id update
    if (bodyData.client_id) {
      updateData.client_id = bodyData.client_id;
    }

    // Handle project_id update
    if (bodyData.project_id) {
      updateData.project_id = bodyData.project_id;
    }

    // 5. Handle date update if provided
    if (bodyData.date) {
      const dateObj = new Date(bodyData.date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Please use YYYY-MM-DD",
        });
      }
      updateData.date = dateObj;
    }

    // 6. Handle plant update if provided
    if (bodyData.plant) {
      updateData.plant = bodyData.plant;
    }

    // 7. Handle products update if provided
    if (bodyData.products) {
      let updatedProducts = bodyData.products;
      if (typeof bodyData.products === 'string') {
        updatedProducts = JSON.parse(bodyData.products);
      }
      console.log("updatedProducts", updatedProducts);

      updateData.products = await Promise.all(
        updatedProducts.map(async (product) => {
          const productDetails = await Product.findById(product.product_id);
          if (!productDetails) {
            throw new Error(`Product not found with ID: ${product.product_id}`);
          }

          // Convert delivery_date to Date object
          const deliveryDate = product.delivery_date ? new Date(product.delivery_date) : undefined;

          // Convert po_quantity to number with validation
          const poQuantity = Number(product.po_quantity);
          if (isNaN(poQuantity)) {
            throw new Error(`Invalid po_quantity value: ${product.po_quantity} for product ${product.product_id}`);
          }

          // Normalize UOM and determine area
          const uomLower = product.uom.toLowerCase();
          const uomMap = {
            sqmt: 'Square Meter/No',
            meter: 'Meter/No',
            nos: null, // No area conversion for 'nos'
          };
          const areaKey = uomMap[uomLower];
          let areaValue = 1; // Default for 'nos' or invalid uom
          if (areaKey) {
            areaValue = parseFloat(productDetails.areas?.get(areaKey) || '0');
            if (isNaN(areaValue) || areaValue <= 0) {
              throw new Error(
                `Invalid area value for UOM ${product.uom} in product ${productDetails.material_code}. ` +
                `Expected a positive number for ${areaKey}, got: ${productDetails.areas?.get(areaKey) || 'missing'}`
              );
            }
          }

          // Calculate qty_in_nos
          const qtyInNos = areaKey
            ? Math.ceil(poQuantity / areaValue)
            : poQuantity;

          return {
            product_id: product.product_id,
            uom: product.uom,
            po_quantity: poQuantity,
            qty_in_nos: qtyInNos,
            plant_code: product.plant_code,
            delivery_date: deliveryDate,
          };
        })
      );
    }

    // 8. Handle file uploads if provided
    // if (req.files && req.files.length > 0) {
    //   const uploadedFiles = [];
    //   for (const file of req.files) {
    //     const tempFilePath = path.join("./public/temp", file.filename);
    //     const fileBuffer = fs.readFileSync(tempFilePath);

    //     const { url } = await putObject(
    //       { data: fileBuffer, mimetype: file.mimetype },
    //       `work-orders/${Date.now()}-${file.originalname}`
    //     );

    //     fs.unlinkSync(tempFilePath);

    //     uploadedFiles.push({
    //       file_name: file.originalname,
    //       file_url: url,
    //     });
    //   }
    //   updateData.files = [...existingWorkOrder.files, ...uploadedFiles];
    // }


    // 8. Handle file uploads if provided
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];
      for (const file of req.files) {
        try {
          const s3Key = `work-orders/${Date.now()}-${sanitizeFilename(file.originalname)}`;
          const { url } = await putObject(
            { data: file.buffer, mimetype: file.mimetype },
            s3Key
          );

          uploadedFiles.push({
            file_name: file.originalname,
            file_url: url,
          });
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: `File upload failed: ${err.message}`,
          });
        }
      }

      updateData.files = [...existingWorkOrder.files, ...uploadedFiles];
    }


    // 9. Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

    // 10. Validate provided data
    const validatedData = createWorkOrderSchema.partial().parse(updateData);
    console.log("validatedData", validatedData);

    // 11. Transform validated data for MongoDB
    const mongoData = { ...validatedData };
    if (mongoData.date) mongoData.date = new Date(mongoData.date);
    if (mongoData.products) {
      mongoData.products = mongoData.products.map((product) => ({
        ...product,
        delivery_date: product.delivery_date ? new Date(product.delivery_date) : undefined,
      }));
    }

    // 12. Update work order
    const updatedWorkOrder = await WorkOrder.findByIdAndUpdate(
      id,
      { $set: mongoData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedWorkOrder,
      message: "Work order updated successfully",
    });
  } catch (error) {
    console.log("error", error);
    if (req.files) {
      req.files.forEach((file) => {
        const tempFilePath = path.join("./public/temp", file.filename);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    if (error.name === "ValidationError") {
      const formattedErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors: formattedErrors,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format: ${error.value}`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

// Update work order status based on production status
export const updateWorkOrderStatus = async (workOrderId) => {
  try {
    // Get the work order
    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) {
      console.log(`Work order ${workOrderId} not found`);
      return;
    }

    // Get all job orders for this work order
    const jobOrders = await JobOrder.find({ work_order: workOrderId });
    
    if (jobOrders.length === 0) {
      // No job orders, keep as Pending
      if (workOrder.status !== 'Pending') {
        workOrder.status = 'Pending';
        await workOrder.save();
        console.log(`Work order ${workOrderId} status updated to Pending (no job orders)`);
      }
      return;
    }

    // Check if any job order has production in progress
    let hasInProgressProduction = false;
    let allCompleted = true;

    for (const jobOrder of jobOrders) {
      // Check if any daily production for this job order is in progress
      const dailyProductions = await DailyProduction.find({ job_order: jobOrder._id });
      
      for (const production of dailyProductions) {
        if (production.status === 'In Progress') {
          hasInProgressProduction = true;
          allCompleted = false;
          break;
        }
        if (production.status !== 'Completed') {
          allCompleted = false;
        }
      }
      
      if (hasInProgressProduction) break;
    }

    // Update work order status based on production status
    let newStatus = workOrder.status;
    
    if (hasInProgressProduction) {
      newStatus = 'In Progress';
    } else if (allCompleted && jobOrders.length > 0) {
      newStatus = 'Completed';
    } else {
      newStatus = 'Pending';
    }

    if (workOrder.status !== newStatus) {
      workOrder.status = newStatus;
      await workOrder.save();
      console.log(`Work order ${workOrderId} status updated to ${newStatus}`);
    }

  } catch (error) {
    console.error(`Error updating work order status for ${workOrderId}:`, error);
  }
};

// Update all work order statuses
export const updateAllWorkOrderStatuses = async (req, res) => {
  try {
    console.log('Starting to update all work order statuses...');
    
    // Get all work orders
    const workOrders = await WorkOrder.find({});
    console.log(`Found ${workOrders.length} work orders to update`);
    
    let updatedCount = 0;
    
    for (const workOrder of workOrders) {
      await updateWorkOrderStatus(workOrder._id);
      updatedCount++;
    }
    
    console.log(`Updated ${updatedCount} work order statuses`);
    
    res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} work order statuses successfully`,
      data: { updatedCount }
    });
    
  } catch (error) {
    console.error('Error updating all work order statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work order statuses',
      error: error.message
    });
  }
};

// Manually set work order status directly (no calculations)
export const manualUpdateWorkOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid work order ID: ${id}` });
    }

    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({ success: false, message: `Work order not found: ${id}` });
    }

    workOrder.status = status;
    await workOrder.save();

    return res.status(200).json({
      success: true,
      message: 'Work order status updated successfully',
      data: {
        work_order_id: workOrder._id,
        work_order_number: workOrder.work_order_number,
        status: workOrder.status,
      },
    });
  } catch (error) {
    console.error('Error manually updating work order status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update work order status' });
  }
};
// export const updateWorkOrder = async (req, res) => {
//   // console.log(req.body);

//   try {
//     // 1. Get work order ID from params
//     const { id } = req.params;
//     // console.log("id", id);

//     // 2. Check if work order exists
//     const existingWorkOrder = await WorkOrder.findById(id);
//     if (!existingWorkOrder) {
//       return res.status(404).json({
//         success: false,
//         message: "Work order not found",
//       });
//     }

//     // 3. Parse form-data (already parsed by multer)
//     const bodyData = req.body;

//     // 4. Initialize update data object
//     const updateData = {};

//     // 5. Handle date update if provided (keep as string for validation)
//     if (bodyData.date) {
//       const dateObj = new Date(bodyData.date);
//       if (isNaN(dateObj.getTime())) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid date format. Please use YYYY-MM-DD",
//         });
//       }
//       updateData.date = dateObj;
//     }

//     // 6. Handle plant update if provided
//     if (bodyData.plant) {
//       updateData.plant = bodyData.plant;
//     }

//     // 7. Handle products update if provided
//     if (bodyData.products) {
//       let updatedProducts = bodyData.products;
//       // Parse stringified products array if needed
//       if (typeof bodyData.products === 'string') {
//         updatedProducts = JSON.parse(bodyData.products);
//       }
//       console.log("updatedProducts", updatedProducts);


//       // Process products - convert sqmt to nos if needed
//       updateData.products = await Promise.all(
//         updatedProducts.map(async (product) => {
//           // Get the product details
//           const productDetails = await Product.findById(product.product_id);
//           if (!productDetails) {
//             throw new Error(`Product not found with ID: ${product.product_id}`);
//           }
//           // console.log("came here......",product.delivery_date);
//           // Convert delivery_date to Date object
//           if (product.delivery_date) {
//             product.delivery_date = new Date(product.delivery_date);
//           } else {
//             product.delivery_date = undefined; // Ensure it's undefined if not provided
//           }
//           console.log("productDetails",productDetails.areas);

//           // If UOM is "sqmt", convert to nos
//           if (product.uom && product.uom.toLowerCase() === 'sqmt') {
//             if (!productDetails.areas || productDetails.areas <= 0) {
//               throw new Error(
//                 `Invalid area value (${productDetails.areas}) for product ${productDetails.material_code}`
//               );
//             }
//             // console.log("type....",typeof(product.po_quantity));

//             // Calculate quantity in nos
//             const quantityInNos = Math.ceil(Number(product.po_quantity) / productDetails.area);

//             return {
//               ...product,
//               po_quantity: Number(product.po_quantity),
//               qty_in_nos: quantityInNos,
//               delivery_date: product.delivery_date,
//             };
//           }

//           // For "nos", keep as is
//           return {
//             ...product,
//             po_quantity: Number(product.po_quantity),
//             qty_in_nos: Number(product.po_quantity),
//             delivery_date: product.delivery_date,
//           };
//         })
//       );
//     }

//     // 8. Handle file uploads if provided
//     if (req.files && req.files.length > 0) {
//       const uploadedFiles = [];
//       for (const file of req.files) {
//         const tempFilePath = path.join("./public/temp", file.filename);
//         const fileBuffer = fs.readFileSync(tempFilePath);

//         // Upload to S3
//         const { url } = await putObject(
//           { data: fileBuffer, mimetype: file.mimetype },
//           `work-orders/${Date.now()}-${file.originalname}`
//         );

//         // Delete temp file
//         fs.unlinkSync(tempFilePath);

//         uploadedFiles.push({
//           file_name: file.originalname,
//           file_url: url,
//         });
//       }
//       // Append new files to existing files
//       updateData.files = [...existingWorkOrder.files, ...uploadedFiles];
//     }

//     // 9. Check if there's anything to update
//     if (Object.keys(updateData).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No fields provided for update",
//       });
//     }

//     // 10. Validate provided data
//     const validatedData = createWorkOrderSchema.partial().parse(updateData);
//     console.log("validatedData", validatedData);

//     // 11. Transform validated data for MongoDB (convert dates to Date objects)
//     const mongoData = { ...validatedData };
//     if (mongoData.date) {
//       mongoData.date = new Date(mongoData.date);
//     }
//     if (mongoData.products) {
//       mongoData.products = mongoData.products.map((product) => ({
//         ...product,
//         delivery_date: product.delivery_date ? new Date(product.delivery_date) : undefined,
//       }));
//     }

//     // 12. Update work order
//     const updatedWorkOrder = await WorkOrder.findByIdAndUpdate(
//       id,
//       { $set: mongoData },
//       { new: true, runValidators: true }
//     );

//     res.status(200).json({
//       success: true,
//       data: updatedWorkOrder,
//       message: "Work order updated successfully",
//     });
//   } catch (error) {
//     // Cleanup: Delete temp files on error
//     console.log("error",error);
//     if (req.files) {
//       req.files.forEach((file) => {
//         const tempFilePath = path.join("./public/temp", file.filename);
//         if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
//       });
//     }

//     // Handle different error types
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         success: false,
//         errors: error.errors.map((err) => ({
//           field: err.path.join("."),
//           message: err.message,
//         })),
//       });
//     }

//     if (error.name === "ValidationError") {
//       const formattedErrors = Object.values(error.errors).map((err) => ({
//         field: err.path,
//         message: err.message,
//       }));
//       return res.status(400).json({
//         success: false,
//         errors: formattedErrors,
//       });
//     }

//     if (error.name === "CastError") {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid ID format: ${error.value}`,
//       });
//     }

//     console.error("Error updating work order:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal Server Error",
//     });
//   }
// };


export const deleteWorkOrder = async (req, res) => {
  try {
    let ids = req.body.ids;
    console.log('ids', ids);

    // Validate input
    if (!ids) {
      return res.status(400).json(new ApiResponse(400, null, 'No IDs provided'));
    }

    // Convert single ID to array if needed
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    // Check for empty array
    if (ids.length === 0) {
      return res.status(400).json(new ApiResponse(400, null, 'IDs array cannot be empty'));
    }

    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
    }

    // Permanent deletion
    // const result = await WorkOrder.deleteMany({ _id: { $in: ids } });
    const result = await WorkOrder.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json(new ApiResponse(404, null, 'No work orders found to delete'));
    }

    return res.status(200).json(new ApiResponse(200, {
      deletedCount: result.deletedCount,
      deletedIds: ids
    }, `${result.deletedCount} work order(s) deleted successfully`));

  } catch (error) {
    console.error("Error deleting work order(s):", error.message);

    if (error.name === 'CastError') {
      return res.status(400).json(new ApiResponse(400, null, `Invalid ID format: ${error.value}`));
    }

    res.status(500).json(new ApiResponse(500, null, 'Internal server error'));
  }
}

export const getProjectBasedOnClient = async (req, res, next) => {
  try {
    const clientId = req.query.clientId;
    // console.log("body",clientId);

    let getProjectByClient = await Project.find({ client: clientId, isDeleted:false }).select({ name: 1 });
    console.log("getProjectByClient", getProjectByClient);

    const validProjects = getProjectByClient.filter((project) => project.client !== null);

    if (!validProjects || validProjects.length === 0) {
      return next(new ApiError(404, 'No active projects found for this client'));
    }

    // return res.status(200).json(
    //   new ApiResponse(200, validProjects, 'Projects fetched successfully')
    // );
    return res.status(200).json({ success: true, message: "Projects", data: validProjects });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    // Handle other errors
    console.error("Error fetching work orders:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

export const getPlantBasedOnProduct = async (req, res) => {
  try {
    const materialCode = req.body.materialcode;

    const products = await Product.find({ material_code: materialCode })
      .populate('plant', 'plant_name')
      .select({ plant: 1, _id: 0 });

    // Transform the data to match your desired format
    const transformedData = products.map(product => ({
      _id: product.plant._id,
      plant_name: product.plant.plant_name
    }));

    return res.status(200).json({
      success: true,
      message: "Plants",
      data: transformedData
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const formattedErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    console.error("Error fetching plants:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}