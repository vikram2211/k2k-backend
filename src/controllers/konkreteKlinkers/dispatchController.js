import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { Dispatch } from '../../models/konkreteKlinkers/dispatch.model.js';
import { Packing } from '../../models/konkreteKlinkers/packing.model.js';
import { Inventory } from '../../models/konkreteKlinkers/inventory.model.js';
import { WorkOrder } from '../../models/konkreteKlinkers/workOrder.model.js';
import { DailyProduction } from '../../models/konkreteKlinkers/dailyProductionPlanning.js';
import Joi from 'joi';
import { putObject } from '../../../util/putObject.js';
import path from 'path';
import fs from 'fs';
import {z} from 'zod';
import axios from 'axios';
import { Jimp } from 'jimp';
import QrCode from 'qrcode-reader';




// ✅ Validation Schema for Dispatch
const dispatchSchema = Joi.object({
    work_order: Joi.string().required().messages({ 'string.empty': 'Work Order ID is required' }),
    invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
    vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
    qr_codes: Joi.alternatives()
        .try(
            Joi.array().items(Joi.string().min(1)).min(1),
            Joi.string().custom((value, helpers) => {
                try {
                    const parsed = JSON.parse(value);
                    if (!Array.isArray(parsed) || parsed.length === 0) {
                        return helpers.error('array.min');
                    }
                    if (!parsed.every((item) => typeof item === 'string' && item.length > 0)) {
                        return helpers.error('array.items');
                    }
                    return parsed;
                } catch (e) {
                    return helpers.error('string.base');
                }
            })
        ),
    date: Joi.date()
        .iso()
        .required()
        .messages({
            'date.base': 'Date must be a valid ISO date',
            'any.required': 'Date is required',
        }),
});

// ✅ Create Dispatch Entry ---- OLDER VERSION WORKING FINE
export const createDispatch = asyncHandler(async (req, res, next) => {
    let body = { ...req.body };
    // console.log('Dispatch creation request:', body);


    if (typeof body.qr_codes === 'string') {
        try {
            body.qr_codes = JSON.parse(body.qr_codes);
            // console.log("value", req.body.qr_codes);

        } catch (e) {
            return next(new ApiError(400, 'Invalid QR codes format: must be a valid JSON array'));
        }
    }

    // Validate request body
    const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
    if (error) {
        console.log(error);
        return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
    }

    const { work_order, invoice_or_sto, vehicle_number, qr_codes, date } = value;
    const userId = req.user.id; // Logged-in user creating the dispatch

    // Check if work order is valid
    if (!mongoose.Types.ObjectId.isValid(work_order)) {
        return next(new ApiError(400, `Invalid Work Order ID: ${work_order}`));
    }
    console.log("qr_codes", qr_codes);


    //////NEED TO IMPLIMENT BOTH THE SOLUTIONS - LIKE ON WEB APP WE ARE GIVING QR ID AND IN MOBILE APP WE ARE SCANNING QR CODES.

    // ✅ Fetch Packing Entries Based on Scanned QR Codes
    const packingEntries = await Packing.find({ qr_code: { $in: qr_codes } }).populate('product', 'description');
    console.log("packingEntries", packingEntries);

    if (!packingEntries || packingEntries.length === 0) {
        return next(new ApiError(404, 'No packing entries found for scanned QR codes'));
    }

    const productMap = packingEntries.reduce((acc, packing) => {
        const productId = packing.product._id.toString();
        if (!acc[productId]) {
            acc[productId] = {
                product_id: packing.product._id,
                product_name: packing.product.description,
                dispatch_quantity: 0,
                bundle_size: packing.bundle_size,
            };
        }
        acc[productId].dispatch_quantity += packing.product_quantity;
        return acc;
    }, {});
    const products = Object.values(productMap);
    // console.log('Prepared products:', products);

    // ✅ Prepare Products Array for Dispatch
    // const products = packingEntries.map(packing => ({
    //     product_id: packing.product,
    //     product_name: packing.product_name, // Optional, can be derived from Product model
    //     dispatch_quantity: packing.product_quantity,
    //     bundle_size: packing.bundle_size,
    // }));


    console.log("file", req.file);
    const file = req.file;
    let invoiceFileUrl;
    if (req.file) {

        const tempFilePath = path.join('./public/temp', file.filename);
        const fileBuffer = fs.readFileSync(tempFilePath);

        // Upload to S3
        const { url } = await putObject(
            { data: fileBuffer, mimetype: file.mimetype },
            `dispatch/${Date.now()}-${file.originalname}`
        );
        invoiceFileUrl = url;
        // Delete temp file
        fs.unlinkSync(tempFilePath);


    }

    // ✅ Create Dispatch Entry
    // const dispatchEntry = await Dispatch.create({
    //     work_order,
    //     packing_ids: packingEntries.map(p => p._id),
    //     products,
    //     invoice_or_sto,
    //     qr_codes,
    //     vehicle_number,
    //     created_by: userId,
    //     invoice_file: invoiceFileUrl,
    //     date
    // });

    // return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
    // const session = await mongoose.startSession();
    try {
        // session.startTransaction();
        const [dispatchEntry] = await Dispatch.create(
            [
                {
                    work_order,
                    packing_ids: packingEntries.map((p) => p._id),
                    products,
                    invoice_or_sto,
                    qr_codes,
                    vehicle_number,
                    created_by: userId,
                    invoice_file: invoiceFileUrl,
                    date,
                },
            ],
            // { session }
        );
        for (const product of products) {
          const inventory = await Inventory.findOne({
            work_order,
            product: product.product_id,
          });
          // .session(session);
          if (inventory) {
            inventory.dispatched_quantity += product.dispatch_quantity;
            inventory.available_stock = inventory.packed_quantity - inventory.dispatched_quantity;
            inventory.updated_by = userId;
            await inventory.save({  }); //session
          }
        }

        // Update packing delivery_stage
        await Packing.updateMany(
            { _id: { $in: packingEntries.map((p) => p._id) } },
            { delivery_stage: 'Dispatched', updated_by: userId },
            // { session }
        );

        // await session.commitTransaction();
        return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
    } catch (error) {
        // await session.abortTransaction();
        return next(new ApiError(500, `Failed to create dispatch: ${error.message}`));
    } 
    // finally {
    //     session.endSession();
    // }


});




// const decodeQRCodeFromImage = async (buffer) => {
//   try {
//       const image = await Jimp.read(buffer);
//       const qr = new QrCode();
//       return new Promise((resolve, reject) => {
//           qr.callback = (err, value) => {
//               if (err) return reject(new ApiError(400, 'Failed to decode QR code from image'));
//               if (!value || !value.result) return reject(new ApiError(400, 'No QR code found in image'));
//               resolve(value.result);
//           };
//           qr.decode(image.bitmap);
//       });
//   } catch (error) {
//       throw new ApiError(400, `Error processing QR code image: ${error.message}`);
//   }
// };


// ✅ Create Dispatch Entry
// export const createDispatch = asyncHandler(async (req, res, next) => {
//   let body = { ...req.body };
//   console.log('Dispatch creation request:', body);

//   if (typeof body.qr_codes === 'string') {
//       try {
//           body.qr_codes = JSON.parse(body.qr_codes);
//           console.log("value", req.body.qr_codes);
//       } catch (e) {
//           return next(new ApiError(400, 'Invalid QR codes format: must be a valid JSON array'));
//       }
//   }

//   // Validate request body
//   const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
//   if (error) {
//       console.log(error);
//       return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
//   }

//   const { work_order, invoice_or_sto, vehicle_number, qr_codes, date } = value;
//   const userId = req.user.id; // Logged-in user creating the dispatch

//   // Check if work order is valid
//   if (!mongoose.Types.ObjectId.isValid(work_order)) {
//       return next(new ApiError(400, `Invalid Work Order ID: ${work_order}`));
//   }

//   // Extract QR IDs from QR URLs if necessary
//   // const qrIds = qr_codes.map(qrCode => {
//   //     if (qrCode.includes('https://')) {
//   //         // Extract QR ID from URL
//   //         const parts = qrCode.split('/');
//   //         return parts[parts.length - 1].split('.')[0];
//   //     }
//   //     return qrCode;
//   // });
//   // console.log("qrIds",qrIds);

//   // ✅ Fetch Packing Entries Based on Scanned QR Codes
//   const packingEntries = await Packing.find({ qr_id: { $in: qrIds } }).populate('product', 'description');
//   console.log("packingEntries", packingEntries);

//   if (!packingEntries || packingEntries.length === 0) {
//       return next(new ApiError(404, 'No packing entries found for scanned QR codes'));
//   }

//   const productMap = packingEntries.reduce((acc, packing) => {
//       const productId = packing.product._id.toString();
//       if (!acc[productId]) {
//           acc[productId] = {
//               product_id: packing.product._id,
//               product_name: packing.product.description,
//               dispatch_quantity: 0,
//               bundle_size: packing.bundle_size,
//           };
//       }
//       acc[productId].dispatch_quantity += packing.product_quantity;
//       return acc;
//   }, {});
//   const products = Object.values(productMap);
//   console.log('Prepared products:', products);

//   console.log("file", req.file);
//   const file = req.file;
//   let invoiceFileUrl;
//   if (req.file) {
//       const tempFilePath = path.join('./public/temp', file.filename);
//       const fileBuffer = fs.readFileSync(tempFilePath);

//       // Upload to S3
//       const { url } = await putObject(
//           { data: fileBuffer, mimetype: file.mimetype },
//           `dispatch/${Date.now()}-${file.originalname}`
//       );
//       invoiceFileUrl = url;
//       // Delete temp file
//       fs.unlinkSync(tempFilePath);
//   }

//   // ✅ Create Dispatch Entry
//   const session = await mongoose.startSession();
//   try {
//       session.startTransaction();
//       const [dispatchEntry] = await Dispatch.create(
//           [
//               {
//                   work_order,
//                   packing_ids: packingEntries.map((p) => p._id),
//                   products,
//                   invoice_or_sto,
//                   qr_codes: qrIds, // Use the extracted QR IDs
//                   vehicle_number,
//                   created_by: userId,
//                   invoice_file: invoiceFileUrl,
//                   date,
//               },
//           ],
//           { session }
//       );

//       // Update packing delivery_stage
//       await Packing.updateMany(
//           { _id: { $in: packingEntries.map((p) => p._id) } },
//           { delivery_stage: 'Dispatched', updated_by: userId },
//           { session }
//       );

//       await session.commitTransaction();
//       return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
//   } catch (error) {
//       await session.abortTransaction();
//       return next(new ApiError(500, `Failed to create dispatch: ${error.message}`));
//   } finally {
//       session.endSession();
//   }
// });

export const getScannedProductsData = async(req,res)=>{
  try {
    console.log("inside backend qr scan");
    let qrId = req.query.id;
    console.log("qrId",qrId);
    if(!qrId){
      return res.status(400).json({success:false,message:"Please give QR Id"})
    }

    let getScannedProducts = await (await Packing.findOne({qr_id:qrId})).populate('product','description');
    console.log("getScannedProducts",getScannedProducts);
    res.status(200).json({ success: true, data: getScannedProducts });

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
}

// ✅ Get All Dispatch Entries
export const getAllDispatches = asyncHandler(async (req, res, next) => {
  const dispatches = await Dispatch.find({ status: 'Approved' })
    .populate({
      path: 'work_order',
      select: 'work_order_number project_id',
      populate: {
        path: 'project_id',
        select: 'name client',
        populate: {
          path: 'client',
          select: 'name',
        },
      },
    })
    .populate({
      path: 'products.product_id',
      select: 'description',
    })
    .populate('created_by', 'username')
    .lean();

  if (!dispatches || dispatches.length === 0) {
    return next(new ApiError(404, 'No approved dispatches found'));
  }

  // Transform the response to match the desired format
  const formattedDispatches = dispatches.map((dispatch) => ({
    _id: dispatch._id,
    work_order_number: dispatch.work_order?.work_order_number || 'N/A',
    client_name: dispatch.work_order?.project_id?.client?.name || 'N/A',
    project_name: dispatch.work_order?.project_id?.name || 'N/A',
    product_names: dispatch.products.map((product) => product.product_id?.description || 'N/A'),
    product_names: dispatch.products.map((product) => ({
      name: product.product_id?.description || product.description || 'N/A',
      dispatch_quantity: product.dispatch_quantity != null ? product.dispatch_quantity : 'N/A',
    })),
    created_by: dispatch.created_by?.username || 'N/A',
    created_at: dispatch.createdAt,
  }));

  return res.status(200).json(
    new ApiResponse(200, formattedDispatches, 'Approved dispatch records fetched successfully')
  );
});
// ✅ Get Dispatch by ID

export const getDispatchById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError(400, `Invalid Dispatch ID: ${id}`));
  }

  // Fetch the Dispatch
  const dispatch = await Dispatch.findById(id)
    .populate({
      path: 'work_order',
      select: 'work_order_number project_id client_id',
      populate: [
        {
          path: 'project_id',
          select: 'name',
        },
        {
          path: 'client_id',
          select: 'name',
        },
      ],
    })
    .populate({
      path: 'products.product_id',
      select: 'product_name uom',
    })
    .populate('created_by', 'username')
    .lean();

  if (!dispatch) {
    return next(new ApiError(404, 'Dispatch not found'));
  }

  // Fetch the associated JobOrder via DailyProduction
  let jobOrder = null;
  // const dailyProduction = await DailyProduction.findOne({
  const dailyProduction = await DailyProduction.findOne({
    work_order: dispatch.work_order?._id,
    'products.product_id': { $in: dispatch.products.map((p) => p.product_id) },
  })
    .populate('job_order', 'job_order_id batch_number')
    .lean();

  if (dailyProduction) {
    jobOrder = dailyProduction.job_order;
  }

  // Transform the response to match the desired format
  const formattedDispatch = {
    client_project: {
      client_name: dispatch.work_order?.client_id?.name || 'N/A',
      project_name: dispatch.work_order?.project_id?.name || 'N/A',
    },
    work_order_name: dispatch.work_order?.work_order_number || 'N/A',
    work_order_id: dispatch.work_order?._id || 'N/A',
    job_order_name: jobOrder?.job_order_id || 'N/A',
    job_order_id: jobOrder?._id || 'N/A',
    created: {
      created_by: dispatch.created_by?.username || 'N/A',
      created_at: dispatch.createdAt,
    },
    products: dispatch.products.map((product) => ({
      product_name: product.product_id?.product_name || product.product_name || 'N/A',
      uom: product.product_id?.uom || 'N/A',
      batch_id: jobOrder?.batch_number || 'N/A',
      dispatch_quantity: product.dispatch_quantity != null ? product.dispatch_quantity : 'N/A',
    })),
    dispatch_date: dispatch.date || 'N/A',
    invoice_or_sto: dispatch.invoice_or_sto || 'N/A',
    vehicle_number: dispatch.vehicle_number || 'N/A',
    invoice_file: dispatch.invoice_file || 'N/A',
  };

  return res.status(200).json(
    new ApiResponse(200, formattedDispatch, 'Dispatch details fetched successfully')
  );
});




// ✅ Update Dispatch (Status Change)
export const updateDispatch = asyncHandler(async (req, res, next) => {
    // console.log('Dispatch update request:', req.body);
  
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return next(new ApiError(401, 'Unauthorized: User not authenticated'));
    }
  
    // 1. Validate dispatch ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, `Invalid Dispatch ID: ${id}`));
    }
  
  
    const { invoice_or_sto, vehicle_number, date } = req.body;
    const file = req.file;
  
    // 3. Prepare update object
    const updateFields = {
      updated_by: userId,
      ...(invoice_or_sto && { invoice_or_sto }),
      ...(vehicle_number && { vehicle_number }),
      ...(date && { date }),
    };
  
    // 4. Handle file upload to S3 if provided
    let invoiceFileUrl;
    if (file) {
      const tempFilePath = path.join('./public/temp', file.filename);
      try {
        const fileBuffer = fs.readFileSync(tempFilePath);
        const s3Path = `dispatch/${Date.now()}-${file.originalname}`;
        const { url } = await putObject(
          { data: fileBuffer, mimetype: file.mimetype },
          s3Path
        );
        invoiceFileUrl = url;
        updateFields.invoice_file = invoiceFileUrl;
      } catch (error) {
        return next(new ApiError(500, `Failed to upload invoice file to S3: ${error.message}`));
      } finally {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (error) {
          console.error(`Failed to delete temp file ${tempFilePath}:`, error);
        }
      }
    }
  
    // 5. Check if there are fields to update
    if (Object.keys(updateFields).length === 1 && updateFields.updated_by) {
      return next(new ApiError(400, 'No valid fields provided for update'));
    }
  
    // 6. Update dispatch with transaction
    // const session = await mongoose.startSession();
    try {
      // session.startTransaction();
      const updatedDispatch = await Dispatch.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true } // session,
      );
  
      if (!updatedDispatch) {
        // await session.abortTransaction();
        return next(new ApiError(404, 'Dispatch not found'));
      }
  
      // await session.commitTransaction();
      return res.status(200).json(new ApiResponse(200, updatedDispatch, 'Dispatch updated successfully'));
    } catch (error) {
      // await session.abortTransaction();
      return next(new ApiError(500, `Failed to update dispatch: ${error.message}`));
    } 
    // finally {
    //   session.endSession();
    // }
  });



// export const updateDispatch = asyncHandler(async (req, res, next) => {
//     console.log('Dispatch update request:', req.body);
//     console.log('Raw request headers:', req.headers);
  
//     const { id } = req.params;
//     const userId = req.user?.id;
//     if (!userId) {
//       return next(new ApiError(401, 'Unauthorized: User not authenticated'));
//     }
  
//     // 1. Validate dispatch ID
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return next(new ApiError(400, `Invalid Dispatch ID: ${id}`));
//     }
  
//     // 2. Get current dispatch document for comparison
//     const currentDispatch = await Dispatch.findById(id).lean();
//     if (!currentDispatch) {
//       return next(new ApiError(404, 'Dispatch not found'));
//     }
//     console.log('Current dispatch date:', currentDispatch.date);
  
//     const { invoice_or_sto, vehicle_number, date } = req.body;
//     const file = req.file;

//     // Debug logging
//     console.log('Raw date received:', date);
//     console.log('Type of raw date:', typeof date);
    
//     // 3. Prepare update object
//     const updateFields = {
//       updated_by: userId,
//     };

//     // Explicit date handling with validation
//     if (date !== undefined) {
//       const parsedDate = new Date(date);
//       if (isNaN(parsedDate.getTime())) {
//         console.error('Invalid date format:', date);
//         return next(new ApiError(400, 'Invalid date format'));
//       }
      
//       // Compare with current date
//       if (currentDispatch.date && parsedDate.toISOString() === new Date(currentDispatch.date).toISOString()) {
//         console.log('Date unchanged - skipping update');
//       } else {
//         updateFields.date = parsedDate;
//         console.log('Setting new date:', parsedDate.toISOString());
//       }
//     }

//     // Handle other fields
//     if (invoice_or_sto !== undefined) updateFields.invoice_or_sto = invoice_or_sto;
//     if (vehicle_number !== undefined) updateFields.vehicle_number = vehicle_number;
  
//     // 4. File upload handling (unchanged from your original code)
//     let invoiceFileUrl;
//     if (file) {
//       const tempFilePath = path.join('./public/temp', file.filename);
//       try {
//         const fileBuffer = fs.readFileSync(tempFilePath);
//         const s3Path = `dispatch/${Date.now()}-${file.originalname}`;
//         const { url } = await putObject(
//           { data: fileBuffer, mimetype: file.mimetype },
//           s3Path
//         );
//         invoiceFileUrl = url;
//         updateFields.invoice_file = invoiceFileUrl;
//       } catch (error) {
//         return next(new ApiError(500, `Failed to upload invoice file to S3: ${error.message}`));
//       } finally {
//         try {
//           if (fs.existsSync(tempFilePath)) {
//             fs.unlinkSync(tempFilePath);
//           }
//         } catch (error) {
//           console.error(`Failed to delete temp file ${tempFilePath}:`, error);
//         }
//       }
//     }
  
//     // 5. Check for actual changes
//     const hasChanges = Object.keys(updateFields).length > 1; // More than just updated_by
//     console.log('Update fields with changes:', updateFields);
//     console.log('Has changes to update:', hasChanges);
    
//     if (!hasChanges) {
//       console.log('No changes detected - returning current document');
//       return res.status(200).json(new ApiResponse(200, currentDispatch, 'No changes detected'));
//     }
  
//     // 6. Perform the update with additional debugging
//     const session = await mongoose.startSession();
//     try {
//       session.startTransaction();
      
//       console.log('Executing update with:', updateFields);
//       const updatedDispatch = await Dispatch.findByIdAndUpdate(
//         id,
//         { $set: updateFields },
//         { 
//           new: true, 
//           session, 
//           runValidators: true,
//           timestamps: false // Prevent automatic updatedAt change
//         }
//       );
  
//       if (!updatedDispatch) {
//         await session.abortTransaction();
//         return next(new ApiError(404, 'Dispatch not found'));
//       }

//       console.log('Update successful. New values:', {
//         oldDate: currentDispatch.date,
//         newDate: updatedDispatch.date,
//         updatedAt: updatedDispatch.updatedAt
//       });
  
//       await session.commitTransaction();
//       return res.status(200).json(new ApiResponse(200, updatedDispatch, 'Dispatch updated successfully'));
//     } catch (error) {
//       console.error('Update error:', error);
//       await session.abortTransaction();
      
//       // Specific handling for validation errors
//       if (error.name === 'ValidationError') {
//         console.error('Validation errors:', error.errors);
//         return next(new ApiError(400, `Validation failed: ${error.message}`));
//       }
      
//       return next(new ApiError(500, `Failed to update dispatch: ${error.message}`));
//     } finally {
//       session.endSession();
//     }
// });