// import { z } from 'zod';
// import { Packing } from '../../models/konkreteKlinkers/packing.model.js';

// // Helper for MongoDB ObjectId validation
// const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// // Zod schema for Packing
// const packingZodSchema = z.object({
//     work_order: objectIdSchema.optional(),
//     product: objectIdSchema,
//     product_quantity: z.number().min(1, "Product quantity must be at least 1"),
//     bundle_size: z.number().min(1, "Bundle size must be at least 1"),
//     uom: z.string(),
//     // rejected_quantity: z.number().min(0, "Rejected quantity cannot be negative").default(0),
//     // delivery_stage: z.enum(['Packed', 'Dispatched', 'Delivered']).default('Packed'),
//     qr_code: z.string().min(1, "QR code is required").trim(),
// })
// // .refine(
// //     (data) => data.rejected_quantity <= data.product_quantity,
// //     "Rejected quantity cannot exceed product quantity"
// // );

// export const createPacking = async (req, res) => {
//     try {
//         // 1. Validate request data using Zod
//         const validatedData = packingZodSchema.parse(req.body);
//         console.log("validatedData", validatedData);

//         // 2. Add packed_by from authenticated user
//         if (!req.user?.id) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Unauthorized: User not authenticated",
//             });
//         }
//         validatedData.packed_by = req.user.id;
//         // console.log("packed_by",validatedData.packed_by);

//         // 3. Check for unique QR code (optional, as schema enforces uniqueness)
//         const existingPacking = await Packing.findOne({ qr_code: validatedData.qr_code });
//         if (existingPacking) {
//             return res.status(400).json({
//                 success: false,
//                 message: "QR code already exists",
//                 field: "qr_code",
//             });
//         }

//         // 4. Create and save the Packing
//         const packing = new Packing(validatedData);
//         await packing.save();

//         // 5. Return success response
//         res.status(201).json({
//             success: true,
//             message: "Packing created successfully",
//             data: packing,
//         });

//     } catch (error) {
//         // Handle Zod validation errors
//         if (error instanceof z.ZodError) {
//             return res.status(400).json({
//                 success: false,
//                 errors: error.errors.map(err => ({
//                     field: err.path.join('.'),
//                     message: err.message,
//                 })),
//             });
//         }

//         // Handle Mongoose validation errors
//         if (error.name === 'ValidationError') {
//             const formattedErrors = Object.values(error.errors).map(err => ({
//                 field: err.path,
//                 message: err.message,
//             }));
//             return res.status(400).json({
//                 success: false,
//                 errors: formattedErrors,
//             });
//         }

//         // Handle duplicate key errors (e.g., unique qr_code)
//         if (error.code === 11000) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Duplicate key error",
//                 field: Object.keys(error.keyPattern)[0],
//             });
//         }

//         // Handle other errors
//         console.error("Error creating Packing:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//             error: error.message,
//         });
//     }
// };

import { z } from 'zod';
import { Packing } from '../../models/konkreteKlinkers/packing.model.js';
import QRCode from 'qrcode';
import { putObject } from '../../../util/putObject.js';
import mongoose from 'mongoose';
import { WorkOrder } from '../../models/konkreteKlinkers/workOrder.model.js';
import { Product } from '../../models/konkreteKlinkers/product.model.js';
import {Inventory} from '../../models/konkreteKlinkers/inventory.model.js';
import { DailyProduction } from '../../models/konkreteKlinkers/dailyProductionPlanning.js';


// Helper for MongoDB ObjectId validation
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// const packingZodSchema = z.object({
//     work_order: z.string().refine((val) => !val || mongoose.isValidObjectId(val), {
//       message: 'Invalid work order ID',
//     }).optional(),
//     product: z.string().refine((val) => mongoose.isValidObjectId(val), {
//       message: 'Invalid product ID',
//     }),
//     product_quantity: z.number().positive('Product quantity must be positive'),
//     bundle_size: z.number().positive('Bundle size must be positive'),
//     uom: z.string().min(1, 'UOM is required'),
//   }).strict();

  // export const createPackingBundles = async (req, res) => {
  //   try {
  //     // 1. Validate request data using Zod
  //     const validatedData = packingZodSchema.parse(req.body);
  
  //     // 2. Check for authenticated user
  //     if (!req.user?.id) {
  //       return res.status(401).json({
  //         success: false,
  //         message: 'Unauthorized: User not authenticated',
  //       });
  //     }
  //     const userId = req.user.id;
  
  //     // 3. Validate work_order and product existence
  //     const { work_order, product, uom } = validatedData;
  //     if (work_order) {
  //       const workOrderExists = await WorkOrder.findById(work_order);
  //       if (!workOrderExists) {
  //         return res.status(404).json({
  //           success: false,
  //           message: 'Work order not found', 
  //         });
  //       }
  //     }
  
  //   //   const productDetails = await Product.findById(product);
  //   //   if (!productDetails || productDetails.isDeleted) {
  //   //     return res.status(404).json({
  //   //       success: false,
  //   //       message: 'Product not found or deleted',
  //   //     });
  //   //   }
  
  //     // 4. Validate UOM against product
  //   //   if (productDetails.uom !== uom) {
  //   //     return res.status(400).json({
  //   //       success: false,
  //   //       message: `UOM "${uom}" does not match product's UOM "${productDetails.uom}"`,
  //   //     });
  //   //   }
  
  //     // 5. Validate bundle_size against product's qty_in_bundle
  //   //   if (productDetails.qty_in_bundle !== validatedData.bundle_size) {
  //   //     return res.status(400).json({
  //   //       success: false,
  //   //       message: `Bundle size ${validatedData.bundle_size} does not match product's qty_in_bundle ${productDetails.qty_in_bundle}`,
  //   //     });
  //   //   }
  
  //     // 6. Calculate number of bundles
  //     const { product_quantity, bundle_size } = validatedData;
  //     const numberOfBundles = Math.ceil(product_quantity / bundle_size);
  //     const baseBundleQuantity = Math.floor(product_quantity / numberOfBundles);
  //     const remainingQuantity = product_quantity % numberOfBundles;
  
  //     // 7. Generate Packing documents for each bundle
  //     const packingDocuments = [];
  //     for (let i = 0; i < numberOfBundles; i++) {
  //       const bundleQuantity = i < remainingQuantity ? baseBundleQuantity + 1 : baseBundleQuantity;
  
  //       const packing = {
  //         work_order: validatedData.work_order || null,
  //         product: validatedData.product,
  //         product_quantity: bundleQuantity,
  //         bundle_size: validatedData.bundle_size,
  //         uom: validatedData.uom,
  //         packed_by: userId,
  //       };
  
  //       packingDocuments.push(packing);
  //     }
  
  //     console.log('packingDocuments', packingDocuments);
  
  //     // 8. Save all Packing documents
  //     const savedPackings = await Packing.insertMany(packingDocuments, { ordered: false });
  //     console.log("came here...");
  
  //     // 9. Return success response
  //     return res.status(201).json({
  //       success: true,
  //       message: `Created ${numberOfBundles} packing bundles successfully`,
  //       data: savedPackings,
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
  
  //     // Handle duplicate key errors (e.g., unique qr_id or qr_code)
  //     if (error.code === 11000) {
  //       const field = error.keyValue ? Object.keys(error.keyValue)[0] : 'unknown';
  //       return res.status(400).json({
  //         success: false,
  //         message: `Duplicate key error for field: ${field}`,
  //         field,
  //       });
  //     }
  
  //     // Handle other errors
  //     console.error('Error creating Packing:', error);
  //     return res.status(500).json({
  //       success: false,
  //       message: 'Internal Server Error',
  //       error: error.message,
  //     });
  //   }
  // };

  const packingZodSchema = z.object({
    work_order: z.string().refine((val) => !val || mongoose.isValidObjectId(val), {
      message: 'Invalid work order ID',
    }).optional(),
    product: z.string().refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid product ID',
    }),
    product_quantity: z.number().positive('Product quantity must be positive'),
    bundle_size: z.number().positive('Bundle size must be positive'),
    uom: z.string().min(1, 'UOM is required'),
}).strict();

export const createPackingBundles = async (req, res) => {
  try {
      // 1. Validate request data using Zod
      const validatedData = packingZodSchema.parse(req.body);

      // 2. Check for authenticated user
      if (!req.user?.id) {
          return res.status(401).json({
              success: false,
              message: 'Unauthorized: User not authenticated',
          });
      }
      const userId = req.user.id;

      // 3. Validate work_order and product existence
      const { work_order, product, uom, product_quantity, bundle_size } = validatedData;
      let totalAchievedQuantity = 0;
      let totalPackedQuantity = 0;

      if (work_order) {
          const workOrderExists = await WorkOrder.findById(work_order);
          if (!workOrderExists) {
              return res.status(404).json({
                  success: false,
                  message: 'Work order not found',
              });
          }

          // 4. Calculate total achieved_quantity from DailyProduction
          // Sum achieved_quantity for the product across all job orders for the work_order
          const dailyProductions = await DailyProduction.aggregate([
              { $match: { work_order: new mongoose.Types.ObjectId(work_order) } },
              { $unwind: '$products' },
              { $match: { 'products.product_id': new mongoose.Types.ObjectId(product) } },
              {
                  $group: {
                      _id: null,
                      totalAchievedQuantity: { $sum: '$products.achieved_quantity' },
                  },
              },
          ]);

          totalAchievedQuantity = dailyProductions.length > 0 ? dailyProductions[0].totalAchievedQuantity : 0;

          // 5. Calculate total packed_quantity from Packing (only delivery_stage: "Packed")
          const packedAggregates = await Packing.aggregate([
              {
                  $match: {
                      work_order: new mongoose.Types.ObjectId(work_order),
                      product: new mongoose.Types.ObjectId(product),
                      delivery_stage: 'Packed',
                  },
              },
              {
                  $group: {
                      _id: null,
                      totalPackedQuantity: { $sum: '$product_quantity' },
                  },
              },
          ]);
          console.log("totalAchievedQuantity",totalAchievedQuantity);

          totalPackedQuantity = packedAggregates.length > 0 ? packedAggregates[0].totalPackedQuantity : 0;
          console.log("totalPackedQuantity",totalPackedQuantity);


          // 6. Validate product_quantity against remaining packable quantity
          const remainingPackableQuantity = totalAchievedQuantity - totalPackedQuantity;
          console.log("remainingPackableQuantity",remainingPackableQuantity);

          if (product_quantity > remainingPackableQuantity) {
              return res.status(400).json({
                  success: false,
                  message: `Product quantity (${product_quantity}) exceeds remaining packable quantity (${remainingPackableQuantity}) for product ${product} in work order ${work_order}`,
              });
          }
      }

      // 7. Calculate number of bundles
      const fullBundles = Math.floor(product_quantity / bundle_size);
      const remainingItems = product_quantity % bundle_size;
      // Minimize bundles: if remainder exists, add it to the last full bundle
      const numberOfBundles = remainingItems > 0 ? Math.max(1, fullBundles) : fullBundles;

      // 8. Generate Packing documents for each bundle
      const packingDocuments = [];
      let itemsAssigned = 0;

      for (let i = 0; i < numberOfBundles; i++) {
          let bundleQuantity;
          if (i < numberOfBundles - 1) {
              // Assign full bundle_size to all but the last bundle
              bundleQuantity = bundle_size;
          } else {
              // Last bundle gets bundle_size + remainder (or all items if fewer than bundle_size)
              bundleQuantity = product_quantity - itemsAssigned;
          }

          const packing = {
              work_order: validatedData.work_order || null,
              product: validatedData.product,
              product_quantity: bundleQuantity,
              bundle_size: validatedData.bundle_size,
              uom: validatedData.uom,
              packed_by: userId,
          };

          packingDocuments.push(packing);
          itemsAssigned += bundleQuantity;
      }

      // Ensure total items assigned match product_quantity
      if (itemsAssigned !== product_quantity) {
          return res.status(400).json({
              success: false,
              message: 'Error: Total items in bundles do not match product quantity',
          });
      }

      // console.log('packingDocuments', packingDocuments);

      // 9. Save all Packing documents
      const savedPackings = await Packing.insertMany(packingDocuments, { ordered: false });
      // console.log("came here...");

      // 10. Calculate balance quantity
      const balanceQuantity = totalAchievedQuantity - totalPackedQuantity - product_quantity;

      // 11. Return success response with balance quantity details
      return res.status(201).json({
          success: true,
          message: `Created ${numberOfBundles} packing bundles successfully`,
          total_achieved_quantity: totalAchievedQuantity,
          total_packed_quantity: totalPackedQuantity,
          balance_quantity: balanceQuantity,
          data: savedPackings,
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

      // Handle duplicate key errors (e.g., unique qr_id or qr_code)
      if (error.code === 11000) {
          const field = error.keyValue ? Object.keys(error.keyValue)[0] : 'unknown';
          return res.status(400).json({
              success: false,
              message: `Duplicate key error for field: ${field}`,
              field,
          });
      }

      // Handle other errors
      console.error('Error creating Packing:', error);
      return res.status(500).json({
          success: false,
          message: 'Internal Server Error',
          error: error.message,
      });
  }
};


// Generate unique QR code

// const tempFilePath = path.join('./public/temp', file.filename);
// const fileBuffer = fs.readFileSync(tempFilePath);

// // Upload to S3
// const { url } = await putObject();

// // Delete temp file
// fs.unlinkSync(tempFilePath);


// const qrCodeData = await QRCode.toDataURL(qrCodeId);

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const outputPath = path.join(__dirname, 'qr-code.png');

// QRCode.toFile(outputPath, qrCodeId, {
//     color: {
//         dark: '#000',  // QR color
//         light: '#FFF'  // Background color
//     }
// }, function (err) {
//     if (err) {
//         console.error('❌ Failed to generate QR Code:', err);
//     } else {
//         console.log('✅ QR Code saved successfully!');
//         console.log('📁 File location:', outputPath);
//     }
// });
// console.log("QRCode",QRCode);

// const qrImage = QRCode.toString(qrCodeId, { type: 'terminal' }, function (err, url) {
//     // console.log("url", typeof(url))
//     return url;
// })
// console.log("qrImage", qrImage);


// Check for QR code uniqueness
// const existingPacking = await Packing.findOne({ qr_code: qrCodeData });
// if (existingPacking) {
//     return res.status(400).json({
//         success: false,
//         message: "Generated QR code already exists",
//         field: "qr_code",
//     });
// }

const createPackingSchema = z.object({
    packings: z.array(
      z.object({
        packing_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
          message: 'Invalid packing ID',
        }),
        qrCodeId: z.string().min(1, 'QR code ID is required'),
      })
    ).min(1, 'At least one packing record is required'),
  }).strict();
  
  export const createPacking = async (req, res) => {
    try {
      // 1. Check for authenticated user
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User not authenticated',
        });
      }
      const userId = req.user._id.toString();
  
      // 2. Validate input
      const validatedData = createPackingSchema.parse(req.body);
      const { packings } = validatedData;
  
      // 3. Process each packing record
      const updatedPackings = [];
      const errors = [];
  
      for (const { packing_id, qrCodeId } of packings) {
        try {
          const packing = await Packing.findById(packing_id);
          // .session(session);
        if (!packing) {
          throw new Error('Packing record not found');
        }
          // Generate QR code
          let qrCodeBuffer;
          try {
            qrCodeBuffer = await QRCode.toBuffer(qrCodeId, {
              type: 'png',
              errorCorrectionLevel: 'H',
              margin: 1,
              width: 200,
            });
          } catch (error) {
            throw new Error(`Failed to generate QR code for ${qrCodeId}: ${error.message}`);
          }
  
          // Upload QR code to S3
          const fileName = `qr-codes/${packing_id}-${Date.now()}.png`;
          const file = {
            data: qrCodeBuffer,
            mimetype: 'image/png',
          };
          let qrCodeUrl;
          try {
            const { url } = await putObject(file, fileName);
            qrCodeUrl = url;
          } catch (error) {
            throw new Error(`Failed to upload QR code to S3 for ${qrCodeId}: ${error.message}`);
          }
  
          // Update packing record
          const updatedPacking = await Packing.findByIdAndUpdate(
            packing_id,
            {
              qr_id: qrCodeId,
              qr_code: qrCodeUrl,
              updated_by: userId,
              delivery_stage:"Packed"
            },
            { new: true, runValidators: true }
          );
  
          // Check if packing record exists
          if (!updatedPacking) {
            throw new Error('Packing record not found');
          }


          const inventory = await Inventory.findOne({
            work_order: packing.work_order,
            product: packing.product,
          });
          // .session(session);
          if (inventory) {
            inventory.packed_quantity += packing.product_quantity;
            inventory.available_stock = inventory.packed_quantity - inventory.dispatched_quantity;
            inventory.updated_by = userId;
            await inventory.save({  }); //session
          }
  
          updatedPackings.push(updatedPacking);
        } catch (error) {
          errors.push({
            packing_id,
            qrCodeId,
            error: error.message,
          });
        }
      }
  
      // 4. Handle response based on results
      if (errors.length === 0) {
        // All updates succeeded
        return res.status(200).json({
          success: true,
          message: 'Packing records updated successfully',
          data: updatedPackings,
        });
      } else if (updatedPackings.length > 0) {
        // Partial success
        return res.status(207).json({
          success: false,
          message: 'Some packing updates failed',
          errors,
          updated: updatedPackings,
        });
      } else {
        // All updates failed
        return res.status(400).json({
          success: false,
          message: 'All packing updates failed',
          errors,
        });
      }
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
  
      // Handle duplicate key errors (e.g., unique qr_id)
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate QR code ID',
          field: Object.keys(error.keyPattern)[0],
        });
      }
  
      // Handle other errors
      console.error('Error updating Packing:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: error.message,
      });
    }
  };


// export const getAllPacking = async (req, res) => {
//     try {
//       // 1. Fetch all packing records with populated fields
//       const packingRecords = await Packing.find()
//         .populate({
//           path: 'work_order',
//           select: 'work_order_number',
//         })
//         .populate({
//           path: 'product',
//           select: 'description',
//         //   match: { isDeleted: false }, // Only include non-deleted products
//         })
//         .populate({
//           path: 'packed_by',
//           select: 'username',
//         })
//         .lean(); // Use lean for performance
  
//       // 2. Transform the data to match the requested format
//       const formattedRecords = packingRecords.map((record) => ({
//         packing_id: record._id.toString(),
//         work_order_number: record.work_order ? record.work_order.work_order_number : null,
//         product_name: record.product ? record.product.description : null,
//         product_quantity: record.product_quantity,
//         bundle_size: record.bundle_size,
//         qr_code_id: record.qr_id || null,
//         rejected_quantity: record.rejected_quantity,
//         uom: record.uom,
//         status: record.delivery_stage,
//         created_by: record.packed_by ? record.packed_by.username : null,
//         createdAt: record.createdAt,
//         updatedAt: record.updatedAt,
//       }));
  
//       // 3. Return success response
//       return res.status(200).json({
//         success: true,
//         message: packingRecords.length > 0 ? 'Packing details retrieved successfully' : 'No packing records found',
//         data: formattedRecords,
//       });
//     } catch (error) {
//       // Handle errors
//       console.error('Error fetching packing details:', error);
//       return res.status(500).json({
//         success: false,
//         message: 'Internal Server Error',
//         error: error.message,
//       });
//     }
//   };

  // const getPackingSchema = z.object({
  //   work_order_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
  //     message: 'Invalid work order ID',
  //   })
  // }).strict();
  
  // export const getPackingByWorkOrderAndProduct = async (req, res) => {
  //   try {
  //     // 1. Validate query parameters
  //     const validatedData = getPackingSchema.parse(req.query);
  //     const { work_order_id } = validatedData;
  
  //     // 2. Fetch packing records with populated fields
  //     const packingRecords = await Packing.find({
  //       work_order: work_order_id,
  //     })
  //       .populate({
  //         path: 'work_order',
  //         select: 'work_order_number',
  //       })
  //       .populate({
  //         path: 'product',
  //         select: 'description',
  //       //   match: { isDeleted: false }, // Only include non-deleted products
  //       })
  //       .populate({
  //         path: 'packed_by',
  //         select: 'username',
  //       })
  //       .lean(); // Use lean for performance
  
  //     // 3. Check if records exist
  //     if (packingRecords.length === 0) {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'No packing records found for the provided work order and product',
  //       });
  //     }
  
  //     // 4. Transform the data to match the requested format
  //     const formattedRecords = packingRecords.map((record) => ({
  //       packing_id: record._id.toString(),
  //       work_order_number: record.work_order ? record.work_order.work_order_number : null,
  //       product_name: record.product ? record.product.description : null,
  //       product_quantity: record.product_quantity,
  //       bundle_size: record.bundle_size,
  //       qr_id: record.qr_id || null,
  //       qr_code: record.qr_code || null, // Added qr_code field
  //       rejected_quantity: record.rejected_quantity,
  //       uom: record.uom,
  //       status: record.delivery_stage,
  //       created_by: record.packed_by ? record.packed_by.username : null,
  //       createdAt: record.createdAt,
  //       updatedAt: record.updatedAt,
  //     }));
  
  //     // 5. Return success response
  //     return res.status(200).json({
  //       success: true,
  //       message: 'Packing details retrieved successfully',
  //       data: formattedRecords,
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
  //     console.error('Error fetching packing details:', error);
  //     return res.status(500).json({
  //       success: false,
  //       message: 'Internal Server Error',
  //       error: error.message,
  //     });
  //   }
  // };
  
  export const getAllPacking = async (req, res) => {
    try {
        // 1. Fetch packing records with delivery_stage: "Packed" and populated fields
        const packingRecords = await Packing.find({ delivery_stage: 'Packed' })
            .populate({
                path: 'work_order',
                select: 'work_order_number',
            })
            .populate({
                path: 'product',
                select: 'description',
            })
            .populate({
                path: 'packed_by',
                select: 'username',
            })
            .lean(); // Use lean for performance

        // 2. Group records by work_order and product to create separate objects for each combination
        const groupedRecords = packingRecords.reduce((acc, record) => {
            const workOrderId = record.work_order ? record.work_order._id.toString() : 'no_work_order';
            const workOrderNumber = record.work_order ? record.work_order.work_order_number : 'No Work Order';
            const productId = record.product ? record.product._id.toString() : 'no_product';
            const productName = record.product ? record.product.description : 'No Product';

            // Create a unique key for the work_order and product combination
            const key = `${workOrderId}_${productId}`;

            // Initialize the group if not exists
            if (!acc[key]) {
                acc[key] = {
                    work_order_id: workOrderId === 'no_work_order' ? null : workOrderId,
                    work_order_number: workOrderNumber,
                    product_id: productId === 'no_product' ? null : productId,
                    product_name: productName,
                    total_bundles: 0,
                    total_quantity: 0,
                    uom: record.uom || 'Unknown',
                    qr_codes: [],
                    rejected_quantity: 0,
                    created_by: record.packed_by ? record.packed_by.username : null,
                    status: record.delivery_stage,
                    packings: [],
                };
            }

            // Format the packing record
            const formattedRecord = {
                packing_id: record._id.toString(),
                work_order_number: workOrderNumber,
                product_name: productName,
                product_quantity: record.product_quantity,
                bundle_size: record.bundle_size,
                qr_code_id: record.qr_id || null,
                qr_code: record.qr_code || null,
                rejected_quantity: record.rejected_quantity,
                uom: record.uom,
                status: record.delivery_stage,
                created_by: record.packed_by ? record.packed_by.username : null,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
            };

            // Update summary fields
            acc[key].total_bundles += 1;
            acc[key].total_quantity += record.product_quantity || 0;
            acc[key].rejected_quantity += record.rejected_quantity || 0;
            if (record.qr_id || record.qr_code) {
                acc[key].qr_codes.push({
                    qr_code_id: record.qr_id || null,
                    qr_code: record.qr_code || null,
                });
            }
            acc[key].packings.push(formattedRecord);

            return acc;
        }, {});

        // 3. Convert grouped records to array format for response
        const formattedData = Object.values(groupedRecords);

        // 4. Return success response
        return res.status(200).json({
            success: true,
            message: formattedData.length > 0 ? 'Packing details retrieved successfully' : 'No packing records found with status Packed',
            data: formattedData,
        });
    } catch (error) {
        // Handle errors
        console.error('Error fetching packing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};

  const getPackingSchema = z.object({
    work_order_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid work order ID',
    }),
    product_id: z.string().refine((val) => mongoose.isValidObjectId(val), {
        message: 'Invalid product ID',
    }),
}).strict();
  export const getPackingByWorkOrderAndProduct = async (req, res) => {
    try {
        // 1. Validate query parameters
        const validatedData = getPackingSchema.parse(req.query);
        const { work_order_id, product_id } = validatedData;

        // 2. Fetch packing records with populated fields and delivery_stage: "Packed"
        const packingRecords = await Packing.find({
            work_order: work_order_id,
            product: product_id,
            delivery_stage: 'Packed',
        })
            .populate({
                path: 'work_order',
                select: 'work_order_number',
            })
            .populate({
                path: 'product',
                select: 'description',
            })
            .populate({
                path: 'packed_by',
                select: 'username',
            })
            .lean(); // Use lean for performance

        // 3. Check if records exist
        if (packingRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No packing records found for the provided work order and product with status Packed',
            });
        }

        // 4. Transform the data to match the requested format
        const formattedRecords = packingRecords.map((record) => ({
            packing_id: record._id.toString(),
            work_order_number: record.work_order ? record.work_order.work_order_number : null,
            product_name: record.product ? record.product.description : null,
            product_quantity: record.product_quantity,
            bundle_size: record.bundle_size,
            qr_id: record.qr_id || null,
            qr_code: record.qr_code || null,
            rejected_quantity: record.rejected_quantity,
            uom: record.uom,
            status: record.delivery_stage,
            created_by: record.packed_by ? record.packed_by.username : null,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        }));

        // 5. Return success response
        return res.status(200).json({
            success: true,
            message: 'Packing details retrieved successfully',
            data: formattedRecords,
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
        console.error('Error fetching packing details:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};
  const deletePackingSchema = z.object({
    work_order_number: z.string().min(1, 'Work order number is required'),
    product_number: z.string().min(1, 'Product number is required'),
  }).strict();
  
  export const deletePackingByWorkOrderAndProduct = async (req, res) => {
    try {
      // 1. Check for authenticated user
      if (!req.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User not authenticated',
        });
      }
  
      // 2. Validate input
      const validatedData = deletePackingSchema.parse(req.body);
      const { work_order_number, product_number } = validatedData;
  
      // 3. Find WorkOrder by work_order_number
      const workOrder = await WorkOrder.findOne({ _id:work_order_number });
    //   console.log("workOrder",workOrder);
      if (!workOrder) {
        return res.status(404).json({
          success: false,
          message: `Work order not found for work_order_number: ${work_order_number}`,
        });
      }
  
      // 4. Find Product by material_code
      const product = await Product.findOne({ _id: product_number });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found or deleted for material_code: ${product_number}`,
        });
      }
  
      // 5. Find matching Packing records
      const packingRecords = await Packing.find({
        work_order: workOrder._id,
        product: product._id,
      }).lean();
  
      if (packingRecords.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No packing records found for the provided work order and product',
        });
      }
  
      // 6. Delete S3 objects for qr_code
      const s3Errors = [];
      for (const record of packingRecords) {
        if (record.qr_code) {
          try {
            const result = await deleteObject(record.qr_code);
            if (result.status !== 204) {
              s3Errors.push({
                packing_id: record._id.toString(),
                qr_code: record.qr_code,
                error: 'Failed to delete S3 object',
              });
            }
          } catch (error) {
            s3Errors.push({
              packing_id: record._id.toString(),
              qr_code: record.qr_code,
              error: error.message,
            });
          }
        }
      }
  
      // 7. Delete Packing records
      const deleteResult = await Packing.deleteMany({
        work_order: workOrder._id,
        product: product._id,
      });
  
      // 8. Prepare response
      const response = {
        success: true,
        message: `Deleted ${deleteResult.deletedCount} packing records successfully`,
        deletedCount: deleteResult.deletedCount,
      };
  
      if (s3Errors.length > 0) {
        response.success = false;
        response.message = `Deleted ${deleteResult.deletedCount} packing records, but some S3 deletions failed`;
        response.errors = s3Errors;
        return res.status(207).json(response);
      }
  
      return res.status(200).json(response);
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
      console.error('Error deleting packing records:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: error.message,
      });
    }
  };

  export const getBundleSizeByProduct = async(req,res)=>{
    try {
      const {product_id} = req.query;
      console.log("product_id",product_id);
      const getBundleSize = await Product.findOne({_id:product_id}).select({qty_in_bundle:1});
      console.log("getBundleSize",getBundleSize);

      return res.status(200).json({success:true,message:"Found Bundle data",data:getBundleSize})
    }catch (error) {
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
      console.error('Error deleting packing records:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: error.message,
      });
    }
  }

  // export const updatePacking = async(req,res)=>{
  //   try {
      
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
  //     console.error('Error deleting packing records:', error);
  //     return res.status(500).json({
  //       success: false,
  //       message: 'Internal Server Error',
  //       error: error.message,
  //     });
  //   }
  // }
