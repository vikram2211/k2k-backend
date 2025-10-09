import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ironDispatch } from '../../models/ironSmith/dispatch.model.js';
import { ironJobOrder } from '../../models/ironSmith/jobOrders.model.js';
import { iornPacking } from '../../models/ironSmith/packing.model.js';
import { ironWorkOrder } from '../../models/ironSmith/workOrder.model.js';
import { ironShape } from '../../models/ironSmith/helpers/ironShape.model.js';
import { ironClient } from '../../models/ironSmith/helpers/ironClient.model.js';
import { ironProject } from '../../models/ironSmith/helpers/ironProject.model.js';
import {ironDailyProduction} from '../../models/ironSmith/dailyProductionPlanning.js';
import { User } from '../../models/user.model.js';
import Joi from 'joi';
import { putObject } from '../../../util/putObject.js';
import path from 'path';
import fs from 'fs';





// const dispatchSchema = Joi.object({
//     work_order: Joi.string().required().messages({ 'string.empty': 'Work Order ID is required' }),
//     invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
//     vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
//     ticket_number: Joi.string().required().messages({ 'string.empty': 'Ticket number is required' }),
//     qr_codes: Joi.alternatives()
//         .try(
//             Joi.array().items(Joi.string().min(1)).min(1),
//             Joi.string().custom((value, helpers) => {
//                 try {
//                     const parsed = JSON.parse(value);
//                     if (!Array.isArray(parsed) || parsed.length === 0) {
//                         return helpers.error('array.min');
//                     }
//                     if (!parsed.every((item) => typeof item === 'string' && item.length > 0)) {
//                         return helpers.error('array.items');
//                     }
//                     return parsed;
//                 } catch (e) {
//                     return helpers.error('string.base');
//                 }
//             })
//         ),
//     date: Joi.date()
//         .iso()
//         .required()
//         .messages({
//             'date.base': 'Date must be a valid ISO date',
//             'any.required': 'Date is required',
//         }),
// });

// const createDispatch = asyncHandler(async (req, res, next) => {
//     let body = { ...req.body };
//     console.log("body", body);

//     if (typeof body.qr_codes === 'string') {
//         try {
//             body.qr_codes = JSON.parse(body.qr_codes);
//         } catch (e) {
//             return next(new ApiError(400, 'Invalid QR codes format: must be a valid JSON array'));
//         }
//     }

//     const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
//     if (error) {
//         return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
//     }

//     const { work_order, invoice_or_sto, vehicle_number, qr_codes, date, ticket_number } = value;
//     const userId = req.user.id;

//     if (!mongoose.Types.ObjectId.isValid(work_order)) {
//         return next(new ApiError(400, `Invalid Work Order ID: ${work_order}`));
//     }

//     // Fetch Packing Entries Based on QR Codes
//     const packingEntries = await iornPacking.find({ qr_code_url: { $in: qr_codes } })
//         .populate('shape_id', 'shape_code')
//         .populate('work_order', 'workOrderNumber');
//         console.log("packingEntries",packingEntries);

//     if (!packingEntries || packingEntries.length === 0) {
//         return next(new ApiError(404, 'No packing entries found for scanned QR codes'));
//     }

//     // Aggregate product data
//     const productMap = packingEntries.reduce((acc, packing) => {
//         const shapeId = packing.shape_id._id.toString();
//         if (!acc[shapeId]) {
//             acc[shapeId] = {
//                 shape_id: packing.shape_id._id,
//                 product_name: packing.shape_id.shape_code,
//                 dispatch_quantity: 0,
//                 bundle_size: packing.bundle_size,
//                 weight: packing.weight,
//             };
//         }
//         acc[shapeId].dispatch_quantity += packing.product_quantity;
//         return acc;
//     }, {});
//     const products = Object.values(productMap);

//     // Handle file uploads
//     const files = req.files || [];
//     let invoiceFileUrls = [];
//     if (files.length > 0) {
//         for (const file of files) {
//             const tempFilePath = path.join('./public/temp', file.filename);
//             const fileBuffer = fs.readFileSync(tempFilePath);

//             const { url } = await putObject(
//                 { data: fileBuffer, mimetype: file.mimetype },
//                 `irondispatch/${Date.now()}-${file.originalname}`
//             );
//             invoiceFileUrls.push(url);
//             fs.unlinkSync(tempFilePath);
//         }
//     }

//     // Create dispatch entry and update related records
//     try {
//         const [dispatchEntry] = await ironDispatch.create([
//             {
//                 work_order,
//                 packing_ids: packingEntries.map((p) => p._id),
//                 products,
//                 invoice_or_sto,
//                 qr_codes:packingEntries.map((p) => p.qr_code),
//                 qr_code_urls: packingEntries.map((p) => p.qr_code_url).filter(url => url),
//                 vehicle_number,
//                 ticket_number,
//                 created_by: userId,
//                 invoice_file: invoiceFileUrls,
//                 date,
//             },
//         ]);

//         await iornPacking.updateMany(
//             { _id: { $in: packingEntries.map((p) => p._id) } },
//             { delivery_stage: 'Dispatched', updated_by: userId }
//         );

//         return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
//     } catch (error) {
//         return next(new ApiError(500, `Failed to create dispatch: ${error.message}`));
//     }
// });


const dispatchSchema_26_09_2025 = Joi.object({
    work_order: Joi.string().required().messages({ 'string.empty': 'Work Order ID is required' }),
    invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
    gate_pass_no: Joi.string().required().messages({ 'string.empty': 'Gate Pass No is required' }),
    vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
    ticket_number: Joi.string().required().messages({ 'string.empty': 'Ticket number is required' }),
    qr_code_urls: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().uri()).min(1),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed) || parsed.length === 0) {
              return helpers.error('array.min');
            }
            if (!parsed.every((item) => typeof item === 'string' && Joi.string().uri().validate(item).error === null)) {
              return helpers.error('array.items');
            }
            return parsed;
          } catch (e) {
            return helpers.error('string.base');
          }
        })
      )
      .messages({
        'string.uri': 'Each QR code URL must be a valid URL',
        'array.min': 'At least one QR code URL is required',
      }),
    date: Joi.date()
      .iso()
      .required()
      .messages({
        'date.base': 'Date must be a valid ISO date',
        'any.required': 'Date is required',
      }),
    invoice_file: Joi.array().items(Joi.string().uri()).optional().messages({
      'string.uri': 'Each invoice file must be a valid URL',
    }),
  }).messages({ 'object.unknown': 'Unknown field detected' });
  
  const createDispatch_26_069_2025 = asyncHandler(async (req, res, next) => {
    let body = { ...req.body };
    console.log("body", body);
  
    if (typeof body.qr_code_urls === 'string') {
      try {
        body.qr_code_urls = JSON.parse(body.qr_code_urls);
      } catch (e) {
        return next(new ApiError(400, 'Invalid QR code URLs format: must be a valid JSON array'));
      }
    }
  
    const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
    if (error) {
      return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
    }
  
    const { work_order, invoice_or_sto, gate_pass_no, vehicle_number, qr_code_urls, date, ticket_number, invoice_file: preUploadedFiles } = value;
    const userId = req.user.id;
  
    if (!mongoose.Types.ObjectId.isValid(work_order)) {
      return next(new ApiError(400, `Invalid Work Order ID: ${work_order}`));
    }
  
    // Fetch Packing Entries Based on QR Code URLs
    const packingEntries = await iornPacking.find({ qr_code_url: { $in: qr_code_urls } })
      .populate('shape_id', 'shape_code')
      .populate('work_order', 'workOrderNumber');
    console.log("packingEntries", packingEntries);
  
    if (!packingEntries || packingEntries.length === 0) {
      return next(new ApiError(404, 'No packing entries found for scanned QR code URLs'));
    }
  
    // Aggregate product data
    const productMap = packingEntries.reduce((acc, packing) => {
      const shapeId = packing.shape_id._id.toString();
      if (!acc[shapeId]) {
        acc[shapeId] = {
          shape_id: packing.shape_id._id,
          product_name: packing.shape_id.shape_code,
          dispatch_quantity: 0,
          bundle_size: packing.bundle_size,
          weight: packing.weight,
        };
      }
      acc[shapeId].dispatch_quantity += packing.product_quantity;
      return acc;
    }, {});
    const products = Object.values(productMap);
  
    // Handle file uploads
    let invoiceFileUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const tempFilePath = path.join('./public/temp', file.filename);
        const fileBuffer = fs.readFileSync(tempFilePath);
  
        const { url } = await putObject(
          { data: fileBuffer, mimetype: file.mimetype },
          `irondispatch/${Date.now()}-${file.originalname}`
        );
        invoiceFileUrls.push(url);
        fs.unlinkSync(tempFilePath);
      }
    } else if (preUploadedFiles && preUploadedFiles.length > 0) {
      invoiceFileUrls = preUploadedFiles;
    }
  
    // Create dispatch entry and update related records
    try {
      const [dispatchEntry] = await ironDispatch.create([
        {
          work_order,
          packing_ids: packingEntries.map((p) => p._id),
          products,
          invoice_or_sto,
          gate_pass_no,
          qr_codes: packingEntries.map((p) => p.qr_code), // Keep qr_codes for reference
          qr_code_urls, // Use the provided URLs
          vehicle_number,
          ticket_number,
          created_by: userId,
          invoice_file: invoiceFileUrls,
          date,
        },
      ]);
  
      await iornPacking.updateMany(
        { _id: { $in: packingEntries.map((p) => p._id) } },
        { delivery_stage: 'Dispatched', updated_by: userId }
      );
  
      return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
    } catch (error) {
      return next(new ApiError(500, `Failed to create dispatch: ${error.message}`));
    }
  });


const dispatchSchema = Joi.object({
    work_order: Joi.string().required().messages({ 'string.empty': 'Work Order ID is required' }),
    invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
    gate_pass_no: Joi.string().required().messages({ 'string.empty': 'Gate Pass No is required' }),
    vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
    ticket_number: Joi.string().required().messages({ 'string.empty': 'Ticket number is required' }),
    qr_code_urls: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().uri()).min(1),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed) || parsed.length === 0) {
              return helpers.error('array.min');
            }
            if (!parsed.every((item) => typeof item === 'string' && Joi.string().uri().validate(item).error === null)) {
              return helpers.error('array.items');
            }
            return parsed;
          } catch (e) {
            return helpers.error('string.base');
          }
        })
      )
      .messages({
        'string.uri': 'Each QR code URL must be a valid URL',
        'array.min': 'At least one QR code URL is required',
      }),
    dispatchQuantities: Joi.object().pattern(
      Joi.string(),
      Joi.number().min(1).required()
    ).required().messages({
      'object.base': 'Dispatch quantities must be an object',
      'number.base': 'Dispatch quantity must be a number',
      'number.min': 'Dispatch quantity must be at least 1',
      'any.required': 'Dispatch quantities are required'
    }),
    date: Joi.date()
      .iso()
      .required()
      .messages({
        'date.base': 'Date must be a valid ISO date',
        'any.required': 'Date is required',
      }),
    invoice_file: Joi.array().items(Joi.string().uri()).optional().messages({
      'string.uri': 'Each invoice file must be a valid URL',
    }),
  }).messages({ 'object.unknown': 'Unknown field detected' });


// controller: ironSmith/dispatchController.js




///////////////////////////WAS WORKING FINE -----
// const createDispatch = asyncHandler(async (req, res, next) => {
//   let body = { ...req.body };

//   // Normalize qr_code_urls (stringified JSON → array)
//   if (typeof body.qr_code_urls === 'string') {
//     try {
//       body.qr_code_urls = JSON.parse(body.qr_code_urls);
//     } catch {
//       return next(new ApiError(400, 'Invalid QR code URLs format: must be a valid JSON array'));
//     }
//   }

//   // Joi validation
//   const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
//   if (error) return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));

//   const {
//     work_order,
//     invoice_or_sto,
//     gate_pass_no,
//     vehicle_number,
//     ticket_number,
//     qr_code_urls,
//     date,
//     invoice_file: preUploadedFiles,
//     dispatchQuantities, // { 'barMark-shapeCode': number }
//   } = value;

//   if (!mongoose.Types.ObjectId.isValid(work_order)) {
//     return next(new ApiError(400, `Invalid Work Order ID: ${work_order}`));
//   }

//   // Helpers
//   const normalizeBarMark = (bm) => {
//     if (bm === null || bm === undefined) return 'null';
//     const s = String(bm).trim();
//     return s.length === 0 ? 'null' : s;
//   };
//   const makeKey = (entry) => `${normalizeBarMark(entry.barMark)}-${entry.shape_id.shape_code}`;
//   const keyParts = (key) => {
//     const idx = key.lastIndexOf('-');
//     if (idx === -1) return { barMarkKey: normalizeBarMark(null), shapeCode: key };
//     return { barMarkKey: normalizeBarMark(key.slice(0, idx)), shapeCode: key.slice(idx + 1) };
//   };

//   // Fetch packs for scanned QR URLs (FIFO)
//   const packingEntries = await iornPacking
//     .find({ qr_code_url: { $in: qr_code_urls } })
//     .populate('shape_id', 'shape_code')
//     .populate('work_order', 'workOrderNumber');

//   if (!packingEntries?.length) {
//     return next(new ApiError(404, 'No packing entries found for scanned QR code URLs'));
//   }
//   packingEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

//   // Group by normalized barMark + shape_code
//   const groupedPackingEntries = packingEntries.reduce((acc, entry) => {
//     const k = makeKey(entry);
//     (acc[k] ||= []).push(entry);
//     return acc;
//   }, {});

//   // Deduct quantities
//   const dispatchedByKey = {}; // { key: totalDispatched }
//   for (const [rawKey, requestedRaw] of Object.entries(dispatchQuantities)) {
//     let requestedQty = Number(requestedRaw) || 0;
//     if (requestedQty <= 0) continue;

//     const { barMarkKey, shapeCode } = keyParts(rawKey);
//     let buckets = groupedPackingEntries[`${barMarkKey}-${shapeCode}`];

//     // Fallback: when requesting 'null-<shape>', combine all groups where barMark is null/empty for that shape
//     if (!buckets && barMarkKey === 'null') {
//       const matchingKeys = Object.keys(groupedPackingEntries).filter((k) => {
//         const { barMarkKey: bmk, shapeCode: sc } = keyParts(k);
//         return bmk === 'null' && sc === shapeCode;
//       });
//       buckets = matchingKeys.flatMap((k) => groupedPackingEntries[k]);
//     }

//     if (!buckets?.length) continue;

//     for (const entry of buckets) {
//       if (requestedQty <= 0) break;
//       const qtyToDeduct = Math.min(requestedQty, entry.product_quantity);
//       if (qtyToDeduct <= 0) continue;

//       entry.product_quantity -= qtyToDeduct;
//       requestedQty -= qtyToDeduct;

//       const k = makeKey(entry);
//       dispatchedByKey[k] = (dispatchedByKey[k] || 0) + qtyToDeduct;

//       entry.delivery_stage = entry.product_quantity === 0 ? 'Dispatched' : 'Packed';
      
//       await entry.save();
//     }
//   }

//   // Build products from dispatched amounts (NOT remaining)
//   const products = Object.entries(dispatchedByKey).map(([k, dispatchedQty]) => {
//     const sample = (groupedPackingEntries[k] || [])[0];
//     return {
//       shape_id: sample.shape_id._id,
//       product_name: sample.shape_id.shape_code,
//       dispatch_quantity: dispatchedQty,
//       bundle_size: sample.bundle_size,
//       weight: sample.weight,
//       // uom: sample.uom, // if available
//     };
//   });

//   if (!products.length) {
//     return next(new ApiError(400, 'Requested dispatch quantities could not be fulfilled from available packs'));
//   }

//   // Handle invoice files
//   let invoiceFileUrls = [];
//   if (req.files?.length) {
//     for (const file of req.files) {
//       const tempFilePath = path.join('./public/temp', file.filename);
//       const fileBuffer = fs.readFileSync(tempFilePath);
//       const { url } = await putObject({ data: fileBuffer, mimetype: file.mimetype }, `irondispatch/${Date.now()}-${file.originalname}`);
//       invoiceFileUrls.push(url);
//       fs.unlinkSync(tempFilePath);
//     }
//   } else if (preUploadedFiles?.length) {
//     invoiceFileUrls = preUploadedFiles;
//   }

//   try {
//     const userId = req.user.id;
//     const [dispatchEntry] = await ironDispatch.create([
//       {
//         work_order,
//         packing_ids: packingEntries.map((p) => p._id),
//         products,
//         invoice_or_sto,
//         gate_pass_no,
//         qr_codes: packingEntries.map((p) => p.qr_code),
//         qr_code_urls,
//         vehicle_number,
//         ticket_number,
//         created_by: userId,
//         invoice_file: invoiceFileUrls,
//         date,
//       },
//     ]);
//     return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
//   } catch (err) {
//     return next(new ApiError(500, `Failed to create dispatch: ${err.message}`));
//   }
// });


// controller: ironSmith/dispatchController.js
const createDispatch_07_10_2025 = asyncHandler(async (req, res, next) => {
  let body = { ...req.body };

  if (typeof body.qr_code_urls === 'string') {
    try {
      body.qr_code_urls = JSON.parse(body.qr_code_urls);
    } catch {
      return next(new ApiError(400, 'Invalid QR code URLs format: must be a valid JSON array'));
    }
  }

  const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
  if (error) return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));

  const {
    work_order,
    invoice_or_sto,
    gate_pass_no,
    vehicle_number,
    ticket_number,
    qr_code_urls,
    date,
    invoice_file: preUploadedFiles,
    dispatchQuantities, // { 'barMark-shapeCode': number }
  } = value;

  if (!mongoose.Types.ObjectId.isValid(work_order)) {
    return next(new ApiError(400, `Invalid Work Order ID: ${work_order}`));
  }

  const normalizeBarMark = (bm) => {
    if (bm === null || bm === undefined) return 'null';
    const s = String(bm).trim();
    return s.length === 0 ? 'null' : s;
  };
  const makeKey = (entry) => `${normalizeBarMark(entry.barMark)}-${entry.shape_id.shape_code}`;
  const keyParts = (key) => {
    const idx = key.lastIndexOf('-');
    if (idx === -1) return { barMarkKey: normalizeBarMark(null), shapeCode: key };
    return { barMarkKey: normalizeBarMark(key.slice(0, idx)), shapeCode: key.slice(idx + 1) };
  };

  // Load packs for scanned QR URLs (FIFO)
  const packingEntries = await iornPacking
    .find({ qr_code_url: { $in: qr_code_urls } })
    .populate('shape_id', 'shape_code')
    .populate('work_order', 'workOrderNumber');

  if (!packingEntries?.length) {
    return next(new ApiError(404, 'No packing entries found for scanned QR code URLs'));
  }
  packingEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Group by normalized barMark + shape_code
  const groupedPackingEntries = packingEntries.reduce((acc, entry) => {
    const k = makeKey(entry);
    (acc[k] ||= []).push(entry);
    return acc;
  }, {});

  // Deduct and accumulate dispatched amounts
  const dispatchedByKey = {};               // { 'barMark-shapeCode': number }
  const dispatchedByJobProductId = {};      // { jobProductId: number } (ironJobOrder.products._id)
  for (const [rawKey, requestedRaw] of Object.entries(dispatchQuantities)) {
    let requestedQty = Number(requestedRaw) || 0;
    if (requestedQty <= 0) continue;

    const { barMarkKey, shapeCode } = keyParts(rawKey);
    let buckets = groupedPackingEntries[`${barMarkKey}-${shapeCode}`];

    // Fallback: if request is 'null-<shape>', combine all groups with null/empty barMark for that shape
    if (!buckets && barMarkKey === 'null') {
      const matchingKeys = Object.keys(groupedPackingEntries).filter((k) => {
        const { barMarkKey: bmk, shapeCode: sc } = keyParts(k);
        return bmk === 'null' && sc === shapeCode;
      });
      buckets = matchingKeys.flatMap((k) => groupedPackingEntries[k]);
    }

    if (!buckets?.length) continue;

    for (const entry of buckets) {
      if (requestedQty <= 0) break;

      const qtyToDeduct = Math.min(requestedQty, entry.product_quantity);
      if (qtyToDeduct <= 0) continue;

      // Apply to packing entry
      entry.product_quantity -= qtyToDeduct;
      entry.delivery_stage = entry.product_quantity === 0 ? 'Dispatched' : 'Packed';
      await entry.save();

      requestedQty -= qtyToDeduct;

      // Track dispatched by display group key
      const k = makeKey(entry);
      dispatchedByKey[k] = (dispatchedByKey[k] || 0) + qtyToDeduct;

      // Track dispatched by job order product (_id stored in packing.object_id)
      if (entry.object_id) {
        const pid = entry.object_id.toString();
        dispatchedByJobProductId[pid] = (dispatchedByJobProductId[pid] || 0) + qtyToDeduct;
      }
    }
  }

  // Build products payload from dispatched amounts
  const products = Object.entries(dispatchedByKey).map(([k, dispatchedQty]) => {
    const sample = (groupedPackingEntries[k] || [])[0];
    return {
      shape_id: sample.shape_id._id,
      product_name: sample.shape_id.shape_code,
      dispatch_quantity: dispatchedQty,
      bundle_size: sample.bundle_size,
      weight: sample.weight,
      // uom: sample.uom, // if available
    };
  });

  if (!products.length) {
    return next(new ApiError(400, 'Requested dispatch quantities could not be fulfilled from available packs'));
  }

  // Update ironJobOrder products: packed_quantity -= dispatched, dispatched_quantity += dispatched
  if (Object.keys(dispatchedByJobProductId).length > 0) {
    const ops = Object.entries(dispatchedByJobProductId).map(([productId, qty]) => ({
      updateOne: {
        filter: { 'products._id': productId },
        update: {
          $inc: {
            'products.$.packed_quantity': -qty,
            'products.$.dispatched_quantity': qty,
          },
        },
      },
    }));
    await ironJobOrder.bulkWrite(ops);
  }

  // Handle invoice files
  let invoiceFileUrls = [];
  if (req.files?.length) {
    for (const file of req.files) {
      const tempFilePath = path.join('./public/temp', file.filename);
      const fileBuffer = fs.readFileSync(tempFilePath);
      const { url } = await putObject({ data: fileBuffer, mimetype: file.mimetype }, `irondispatch/${Date.now()}-${file.originalname}`);
      invoiceFileUrls.push(url);
      fs.unlinkSync(tempFilePath);
    }
  } else if (preUploadedFiles?.length) {
    invoiceFileUrls = preUploadedFiles;
  }

  // Ensure uniqueness within single dispatch doc only
  const uniqueQrCodes = [...new Set(packingEntries.map((p) => p.qr_code))];
  const uniqueQrUrls  = [...new Set(packingEntries.map((p) => p.qr_code_url))];

  try {
    const userId = req.user.id;
    const [dispatchEntry] = await ironDispatch.create([
      {
        work_order,
        packing_ids: packingEntries.map((p) => p._id),
        products,
        invoice_or_sto,
        gate_pass_no,
        qr_codes: uniqueQrCodes,
        qr_code_urls: uniqueQrUrls,
        vehicle_number,
        ticket_number,
        created_by: userId,
        invoice_file: invoiceFileUrls,
        date,
      },
    ]);
    return res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
  } catch (err) {
    return next(new ApiError(500, `Failed to create dispatch: ${err.message}`));
  }
});








const createDispatch = asyncHandler(async (req, res, next) => {
  try {
    const { products, invoice_or_sto, gate_pass_no, vehicle_number, ticket_number, date } = req.body;

    if (!products || !products.length) {
      return res.status(400).json(new ApiResponse(400, null, "Products are required"));
    }

    // Validate each product
    let workOrderId = null; // ensure we capture the related job order id
    for (const { object_id, dispatch_quantity, qr_code_id } of products) {
      if (!object_id || !dispatch_quantity || !qr_code_id) {
        return res.status(400).json(new ApiResponse(400, null, "Missing required fields for product"));
      }

      // Fetch the Job Order product
      const jobOrderProduct = await ironJobOrder.findOne(
        { "products._id": object_id },
        { "products.$": 1, work_order: 1 }
      );

      if (!jobOrderProduct) {
        return res.status(404).json(new ApiResponse(404, null, `Job Order product not found for object_id: ${object_id}`));
      }

      const product = jobOrderProduct.products[0];

      // Set and ensure consistent work order across all products
      if (!workOrderId) {
        workOrderId = jobOrderProduct.work_order; // use ironWorkOrder id
      } else if (String(workOrderId) !== String(jobOrderProduct.work_order)) {
        return res.status(400).json(new ApiResponse(400, null, `All products must belong to the same work order`));
      }

      // Check if the QR code matches
      if (product.qr_code_id !== qr_code_id) {
        return res.status(400).json(new ApiResponse(400, null, `QR code mismatch for object_id: ${object_id}`));
      }

      // Check if the product is already dispatched
      const dailyProduction = await ironDailyProduction.findOne({
        job_order: jobOrderProduct._id,
        'products.object_id': object_id,
      });

      if (!dailyProduction) {
        return res.status(404).json(new ApiResponse(404, null, `Production record not found for object_id: ${object_id}`));
      }

      const productionProduct = dailyProduction.products.find(
        (p) => p.object_id.toString() === object_id.toString()
      );

      if (productionProduct.delivery_stage === 'Dispatched') {
        return res.status(400).json(new ApiResponse(400, null, `Product with object_id: ${object_id} is already dispatched`));
      }

      // Check if packed_quantity is sufficient
      if (product.packed_quantity < dispatch_quantity) {
        return res.status(400).json(new ApiResponse(400, null, `Insufficient packed quantity for object_id: ${object_id}`));
      }
    }

    // Process dispatch
    const dispatchProducts = [];
    for (const { object_id, dispatch_quantity, qr_code_id } of products) {
      // Update Job Order: deduct from packed_quantity, add to dispatched_quantity
      await ironJobOrder.findOneAndUpdate(
        { "products._id": object_id },
        {
          $inc: {
            "products.$.packed_quantity": -dispatch_quantity,
            "products.$.dispatched_quantity": dispatch_quantity,
          },
        }
      );

      // Update Daily Production: set delivery_stage to "Dispatched"
      await ironDailyProduction.findOneAndUpdate(
        { "products.object_id": object_id },
        { $set: { "products.$.delivery_stage": "Dispatched" } }
      );

      // Fetch product details again to enrich dispatch product (shape, etc.)
      const jobOrderProductForItem = await ironJobOrder.findOne(
        { "products._id": object_id },
        { "products.$": 1, work_order: 1 }
      );
      const joProduct = jobOrderProductForItem?.products?.[0];

      // Add to dispatch products with required fields in schema
      dispatchProducts.push({
        shape_id: joProduct?.shape,
        object_id,
        product_name: undefined,
        dispatch_quantity,
        bundle_size: dispatch_quantity, // fallback allocation
        weight: 0, // fallback; update when actual weight is available
        qr_code: qr_code_id,
        uom: 'Nos',
      });
    }

    // Create dispatch record
    const dispatch = await ironDispatch.create({
      work_order: workOrderId,
      products: dispatchProducts,
      invoice_or_sto,
      gate_pass_no,
      vehicle_number,
      ticket_number,
      created_by: req.user?.id || req.user?._id,
      date: new Date(date),
    });

    res.status(201).json(new ApiResponse(201, dispatch, "Dispatch created successfully"));
  } catch (error) {
    console.error('Error creating dispatch:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal Server Error", error.message));
  }
});









const getScannedProducts_26_09_2025 = asyncHandler(async (req, res, next) => {
    try {
        console.log("inside backend qr scan");
        const qrCode = req.query.qr_code;
        console.log("qrCode", qrCode);

        if (!qrCode) {
            return res.status(400).json({ success: false, message: "Please provide a QR code" });
        }

        const getScannedProduct = await iornPacking.findOne({ qr_code: qrCode })
            .populate('shape_id', 'shape_code')
            .populate('work_order', 'workOrderNumber')
            .populate('packed_by', 'username');

        console.log("getScannedProduct", getScannedProduct);

        if (!getScannedProduct) {
            return res.status(404).json({
                success: false,
                message: `No packing entry found for QR code ${qrCode}`,
            });
        }

        if (getScannedProduct.delivery_stage === 'Dispatched') {
            return res.status(400).json({
                success: false,
                message: `QR code ${qrCode} has already been scanned and dispatched.`,
            });
        }

        res.status(200).json({ success: true, data: getScannedProduct });
    } catch (error) {
        // Cleanup: Delete temp files on error (if applicable)
        if (req.files) {
            req.files.forEach((file) => {
                const tempFilePath = path.join('./public/temp', file.filename);
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            });
        }

        // Handle different error types
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

        console.error('Error scanning QR code:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
});



const getScannedProducts_07_10_2025 = asyncHandler(async (req, res, next) => {
  try {
    const qrCode = req.query.qr_code;
    if (!qrCode) {
      return res.status(400).json({ success: false, message: "Please provide a QR code" });
    }

    const getScannedProduct = await iornPacking.findOne({ qr_code: qrCode })
      .populate('shape_id', 'shape_code')
      .populate({
        path: 'work_order',
        populate: {
          path: 'products',
        },
      })
      .populate('packed_by', 'username');

    if (!getScannedProduct) {
      return res.status(404).json({
        success: false,
        message: `No packing entry found for QR code ${qrCode}`,
      });
    }

    if (getScannedProduct.delivery_stage === 'Dispatched') {
      return res.status(400).json({
        success: false,
        message: `QR code ${qrCode} has already been scanned and dispatched.`,
      });
    }

    // Find the product in the work order's products array using object_id
    const product = getScannedProduct.work_order.products.find(
      (p) => p._id.toString() === getScannedProduct.object_id.toString()
    );

    const barMark = product?.barMark || null;

    res.status(200).json({
      success: true,
      data: {
        ...getScannedProduct.toObject(),
        barMark, // Include barMark in the response
         object_id: getScannedProduct.object_id,
      },
    });
  } catch (error) {
    if (req.files) {
      req.files.forEach((file) => {
        const tempFilePath = path.join('./public/temp', file.filename);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
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
    console.error('Error scanning QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
});


const getScannedProducts = asyncHandler(async (req, res, next) => {
  try {
    const qrCode = req.query.qr_code;
    if (!qrCode) {
      return res.status(400).json({ success: false, message: "Please provide a QR code" });
    }

    // Find the product in Job Order using the QR code
    const jobOrderProduct = await ironJobOrder.findOne(
      { "products.qr_code_id": qrCode },
      { "products.$": 1, work_order: 1, job_order_number: 1 }
    ).populate('products.shape', 'shape_code')
     .populate('work_order', 'workOrderNumber');
    console.log("jobOrderProduct",jobOrderProduct);
    

    if (!jobOrderProduct) {
      return res.status(404).json({
        success: false,
        message: `No product found for QR code ${qrCode}`,
      });
    }

    const product = jobOrderProduct.products[0];

    // Check if the product is already dispatched
    const dailyProduction = await ironDailyProduction.findOne({
      job_order: jobOrderProduct._id,
      'products.object_id': product._id,
    });

    if (!dailyProduction) {
      return res.status(404).json({
        success: false,
        message: `No production record found for QR code ${qrCode}`,
      });
    }

    const productionProduct = dailyProduction.products.find(
      (p) => p.object_id.toString() === product._id.toString()
    );

    if (productionProduct.delivery_stage === 'Dispatched') {
      return res.status(400).json({
        success: false,
        message: `QR code ${qrCode} has already been scanned and dispatched.`,
      });
    }

    // Return product details
    res.status(200).json({
      success: true,
      data: {
        work_order: jobOrderProduct._id,
        job_order_number: jobOrderProduct.job_order_number,
        work_order_number: jobOrderProduct.work_order?.workOrderNumber || null,
        object_id: product._id,
        shape_id: product.shape,
        shape_code: product.shape.shape_code,
        barMark: product.barMark,
        packed_quantity: product.packed_quantity,
        qr_code_id: product.qr_code_id,
        qr_code_url: product.qr_code_url,
      },
    });
  } catch (error) {
    console.error('Error scanning QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
});







const updateDispatchSchema = Joi.object({
    date: Joi.date().iso().optional().messages({
        'date.base': 'Date must be a valid ISO date',
    }),
    invoice_or_sto: Joi.string().optional().messages({ 'string.empty': 'Invoice/STO cannot be empty' }),
    gate_pass_no: Joi.string().optional().messages({ 'string.empty': 'Gate Pass No. cannot be empty' }),
    vehicle_number: Joi.string().optional().messages({ 'string.empty': 'Vehicle number cannot be empty' }),
    ticket_number: Joi.string().optional().messages({ 'string.empty': 'Ticket number cannot be empty' }),
    invoice_file: Joi.array().items(Joi.string()).optional(), // For new file URLs if pre-uploaded
}).min(1).messages({ 'object.min': 'At least one field (date, invoice_or_sto, vehicle_number, ticket_number, or invoice_file) is required' });

const updateDispatch = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    let body = { ...req.body };
    // console.log("Update body", body);

    // Validate the request body
    const { error, value } = updateDispatchSchema.validate(body, { abortEarly: false });
    if (error) {
        return next(new ApiError(400, 'Validation failed for dispatch update', error.details));
    }

    const { date, invoice_or_sto, gate_pass_no, vehicle_number, ticket_number, invoice_file: newInvoiceFiles } = value;
    const userId = req.user.id;

    // Handle file uploads for invoice_file if present
    let invoiceFileUrls = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const tempFilePath = path.join('./public/temp', file.filename);
            const fileBuffer = fs.readFileSync(tempFilePath);

            const { url } = await putObject(
                { data: fileBuffer, mimetype: file.mimetype },
                `dispatch/${Date.now()}-${file.originalname}`
            );
            invoiceFileUrls.push(url);
            fs.unlinkSync(tempFilePath);
        }
    } else if (newInvoiceFiles) {
        // Use pre-uploaded URLs if provided in body
        invoiceFileUrls = newInvoiceFiles;
    }

    // Prepare update object with only provided fields
    const updateData = {
        ...(date && { date }),
        ...(invoice_or_sto && { invoice_or_sto }),
        ...(gate_pass_no && { gate_pass_no }),
        ...(vehicle_number && { vehicle_number }),
        ...(ticket_number && { ticket_number }),
        ...(invoiceFileUrls.length > 0 && { invoice_file: invoiceFileUrls }), // Append or replace invoice_file
        updated_by: userId,
    };

    if (Object.keys(updateData).length === 1 && updateData.updated_by) {
        return next(new ApiError(400, 'At least one field (date, invoice_or_sto, gate_pass_no, vehicle_number, ticket_number, or invoice_file) must be updated'));
    }

    // Update the dispatch entry
    try {
        const updatedDispatch = await ironDispatch.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedDispatch) {
            return next(new ApiError(404, `Dispatch with ID ${id} not found`));
        }

        return res.status(200).json(new ApiResponse(200, updatedDispatch, 'Dispatch updated successfully'));
    } catch (error) {
        return next(new ApiError(500, `Failed to update dispatch: ${error.message}`));
    }
});


const getAllDispatches_11_09_2025 = asyncHandler(async (req, res, next) => {
    try {
        // Fetch all dispatch records and populate related fields
        const dispatches = await ironDispatch
            .find()
            .populate('work_order', 'workOrderNumber')
            .populate('created_by', 'username')
            .lean();

        if (!dispatches || dispatches.length === 0) {
            return res.status(200).json(new ApiResponse(200, [], 'No dispatch records found'));
        }

        // Process each dispatch to aggregate shape-wise data
        const result = await Promise.all(dispatches.map(async (dispatch) => {
            // Aggregate total dispatched quantity per shape
            const shapeQuantities = dispatch.products.reduce((acc, product) => {
                const shapeId = product.shape_id.toString();
                if (!acc[shapeId]) {
                    acc[shapeId] = {
                        shape_id: product.shape_id,
                        total_quantity: 0,
                    };
                }
                acc[shapeId].total_quantity += product.dispatch_quantity;
                return acc;
            }, {});

            // Fetch shape names for each shape_id
            const shapeIds = Object.keys(shapeQuantities);
            const shapes = await ironShape.find({ _id: { $in: shapeIds }, isDeleted: false }).select('description');

            // Map shape names to quantities
            const shapeData = Object.values(shapeQuantities).map((item) => {
                const shape = shapes.find(s => s._id.toString() === item.shape_id.toString());
                return {
                    shape_name: shape ? shape.description : 'N/A',
                    total_dispatched_qty: item.total_quantity,
                };
            });

            return {
                _id: dispatch._id,
                work_order_id: dispatch.work_order?._id,
                work_order_number: dispatch.work_order?.workOrderNumber || 'N/A',
                shape_data: shapeData, // Array of { shape_name, total_dispatched_qty }
                created_by: dispatch.created_by?.username || 'N/A',
                timestamp: dispatch.createdAt,
                status: dispatch.status,
            };
        }));

        return res.status(200).json(new ApiResponse(200, result, 'Dispatch records retrieved successfully'));
    } catch (error) {
        console.error('Error fetching dispatches:', error);
        return next(new ApiError(500, `Failed to fetch dispatch records: ${error.message}`));
    }
});






const getAllDispatches = asyncHandler(async (req, res, next) => {
  try {
      // Fetch all dispatch records and populate related fields
      const dispatches = await ironDispatch
          .find()
          .populate({
              path: 'work_order',
              select: 'workOrderNumber clientId projectId',
              populate: [
                  { path: 'clientId', model: 'ironClient', select: 'name' },
                  { path: 'projectId', model: 'ironProject', select: 'name' },
              ],
          })
          .populate('created_by', 'username')
          .lean();

      if (!dispatches || dispatches.length === 0) {
          return res.status(200).json(new ApiResponse(200, [], 'No dispatch records found'));
      }

      // Process each dispatch to aggregate shape-wise data and include planned quantities by matching QR codes
      const result = await Promise.all(dispatches.map(async (dispatch) => {
          // Aggregate total dispatched quantity per shape for this dispatch
          const shapeQuantities = dispatch.products.reduce((acc, product) => {
              const shapeId = product.shape_id?.toString();
              if (!shapeId) return acc;
              if (!acc[shapeId]) {
                  acc[shapeId] = { shape_id: product.shape_id, total_quantity: 0 };
              }
              acc[shapeId].total_quantity += Number(product.dispatch_quantity || 0);
              return acc;
          }, {});
          console.log("shapeQuantities",shapeQuantities);
          

          // Compute planned quantities per shape by comparing QR IDs
          const qrCodes = Array.from(new Set((dispatch.products || []).map((p) => p.qr_code).filter(Boolean)));
          let plannedByShape = {};
          let combos = [];// [{shapeId, dia, barMark}]
          const normalizeBarMark = (bm) => {
            if (bm === null || bm === undefined) return '';
            return String(bm).trim().replace(/,+$/g, '');
          };
          if (qrCodes.length > 0) {
              const relatedJobOrders = await ironJobOrder
                  .find({ 'products.qr_code_id': { $in: qrCodes } }, { products: 1 })
                  .lean();
              plannedByShape = relatedJobOrders.reduce((acc, jo) => {
                  (jo.products || []).forEach((prod) => {
                      if (!prod?.qr_code_id || !qrCodes.includes(prod.qr_code_id)) return;
                      const sid = prod.shape?.toString();
                      if (!sid) return;
                      acc[sid] = (acc[sid] || 0) + Number(prod.planned_quantity || 0);
                      combos.push({ shapeId: sid, dia: Number(prod.dia || 0), barMark: normalizeBarMark(prod.barMark) });
                  });
                  return acc;
              }, {});
          }

          // Compute total PO quantity per shape by matching shape+dia+barMark in related work order products
          let poByShape = {};
          try {
            const woId = dispatch.work_order?._id || dispatch.work_order;
            if (woId && combos.length) {
              const woDoc = await ironWorkOrder.findById(woId).select('products').lean();
              if (woDoc?.products?.length) {
                for (const combo of combos) {
                  const match = woDoc.products.find((wp) => {
                    const sid = (wp.shapeId || wp.shape_id || wp.shape || (wp.shape?._id) || '').toString();
                    const dia = Number(wp.diameter || wp.dia || 0);
                    const bm = normalizeBarMark(wp.barMark);
                    return sid === combo.shapeId && dia === combo.dia && bm === combo.barMark;
                  });
                  if (match) {
                    const sid = combo.shapeId;
                    const poQty = Number(match.quantity || match.poQuantity || 0);
                    poByShape[sid] = (poByShape[sid] || 0) + poQty;
                  }
                }
              }
            }
          } catch (e) {
            // swallow PO aggregation errors to avoid breaking listing
          }

          // Fetch shape names for each shape_id
          const shapeIds = Object.keys(shapeQuantities);
          const shapes = await ironShape.find({ _id: { $in: shapeIds }, isDeleted: false }).select('description');

          // Map shape names to quantities and planned quantities
          const shapeData = Object.values(shapeQuantities).map((item) => {
              const shape = shapes.find(s => s._id.toString() === item.shape_id.toString());
              const plannedQty = plannedByShape[item.shape_id.toString()] || 0;
              const poQty = poByShape[item.shape_id.toString()] || 0;
              return {
                  shape_name: shape ? shape.description : 'N/A',
                  total_dispatched_qty: item.total_quantity,
                  planned_quantity: plannedQty,
                  po_quantity: poQty,
              };
          });

          return {
              _id: dispatch._id,
              work_order_id: dispatch.work_order?._id || 'N/A',
              work_order_number: dispatch.work_order?.workOrderNumber || 'N/A',
              client_name: dispatch.work_order?.clientId?.name || 'Unknown Client',
              project_name: dispatch.work_order?.projectId?.name || 'Unknown Project',
              shape_data: shapeData,
              created_by: dispatch.created_by?.username || 'N/A',
              timestamp: dispatch.createdAt,
              status: dispatch.status,
          };
      }));

      return res.status(200).json(new ApiResponse(200, result, 'Dispatch records retrieved successfully'));
  } catch (error) {
      console.error('Error fetching dispatches:', error);
      return next(new ApiError(500, `Failed to fetch dispatch records: ${error.message}`));
  }
});




const getDispatchById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    try {
        // Fetch the dispatch record and populate related fields
        const dispatch = await ironDispatch
            .findById(id)
            .populate('work_order', 'workOrderNumber clientId projectId createdAt created_by')
            .populate('created_by', 'username')
            .lean();
            console.log("dispatch",dispatch);

        if (!dispatch) {
            return next(new ApiError(404, `Dispatch with ID ${id} not found`));
        }

        // Fetch client details
        const client = await ironClient.findById(dispatch.work_order.clientId).select('name _id');
        const project = await ironProject.findById(dispatch.work_order.projectId).select('name _id'); // Adjust if project schema differs

        // Fetch work order creator's username
        const workOrderCreator = await User.findById(dispatch.work_order.created_by).select('username');

        // Fetch all shapes in bulk
        const shapeIds = dispatch.products.map(product => product.shape_id.toString());
        const shapes = await ironShape.find({ _id: { $in: shapeIds }, isDeleted: false }).select('description _id shape_code');

        // Transform dispatched shape details
        const shapeDetails = dispatch.products.map((product, index) => {
            const shape = shapes.find(s => s._id.toString() === product.shape_id.toString());
            // console.log('shape', shape); // Debug log
            return {
                sr_no: index + 1,
                shape_name: shape ? shape.shape_code : 'Unknown Shape',
                dispatch_qty: product.dispatch_quantity,
                date: dispatch.date,
                invoice: dispatch.invoice_or_sto,
                vehicle_number: dispatch.vehicle_number,
                ticket_number: dispatch.ticket_number,
                invoice_file: dispatch.invoice_file.map(file => ({
                    name: file.split('/').pop() || 'Unnamed File',
                    url: file,
                })),
            };
        });

        // Prepare response
        const response = {
            client_project: {
                client: client ? { _id: client._id, name: client.name } : { _id: null, name: 'Unknown Client' },
                project: project ? { _id: project._id, name: project.name } : { _id: null, name: 'Unknown Project' },
            },
            work_order: {
                work_order_id: dispatch.work_order._id,
                work_order_number: dispatch.work_order.workOrderNumber || 'Unknown Work Order',
                work_order_created_by: workOrderCreator ? workOrderCreator.username : 'Unknown User',
                created_at: dispatch.work_order.createdAt || null,
                gate_pass_no: dispatch.gate_pass_no || null,
            },
            dispatched_shape_details: shapeDetails,
        };

        return res.status(200).json(new ApiResponse(200, response, 'Dispatch details retrieved successfully'));
    } catch (error) {
        console.error('Error fetching dispatch by ID:', error);
        return next(new ApiError(500, `Failed to fetch dispatch: ${error.message}`));
    }
});

const getDispatchByWorkOrderId = asyncHandler(async (req, res, next) => {
    try {
        const { workOrderId } = req.params;
        
        // Validate work order ID
        if (!workOrderId || !mongoose.Types.ObjectId.isValid(workOrderId)) {
            return next(new ApiError(400, 'Invalid or missing work order ID'));
        }

        // Fetch dispatch records for the specific work order
        const dispatches = await ironDispatch
            .find({ work_order: workOrderId })
            .populate({
                path: 'work_order',
                select: 'workOrderNumber clientId projectId',
                populate: [
                    { path: 'clientId', model: 'ironClient', select: 'name' },
                    { path: 'projectId', model: 'ironProject', select: 'name' },
                ],
            })
            .populate('created_by', 'username')
            .populate('products.shape_id', 'shape_code name')
            .lean();

        if (!dispatches || dispatches.length === 0) {
            return res.status(200).json(new ApiResponse(200, [], 'No dispatch records found for this work order'));
        }

        // Format the response data
        const formattedDispatches = dispatches.map(dispatch => ({
            dispatchId: dispatch._id,
            dispatchNumber: dispatch.dispatch_number || `D${dispatch._id.toString().slice(-6)}`,
            workOrderNumber: dispatch.work_order?.workOrderNumber || 'N/A',
            clientName: dispatch.work_order?.clientId?.name || 'Unknown Client',
            projectName: dispatch.work_order?.projectId?.name || 'Unknown Project',
            vehicleNumber: dispatch.vehicle_number || 'N/A',
            docketNumber: dispatch.ticket_number || 'N/A',
            gatePassNumber: dispatch.gate_pass_no || 'N/A',
            invoiceOrSTO: dispatch.invoice_or_sto || 'N/A',
            createdBy: dispatch.created_by?.username || 'N/A',
            createdAt: dispatch.createdAt,
            status: dispatch.status || 'Active',
            products: dispatch.products.map(product => ({
                shapeCode: product.shape_id?.shape_code || 'N/A',
                shapeName: product.shape_id?.name || 'N/A',
                quantity: product.dispatch_quantity || 0,
                bundleSize: product.bundle_size || 0,
                weight: product.weight || 0,
            })),
        }));

        return res.status(200).json(new ApiResponse(200, formattedDispatches, 'Dispatch data retrieved successfully'));
    } catch (error) {
        console.error('Error fetching dispatch by work order ID:', error);
        return next(new ApiError(500, `Failed to fetch dispatch data: ${error.message}`));
    }
});

export {createDispatch, getScannedProducts, updateDispatch, getAllDispatches, getDispatchById, getDispatchByWorkOrderId}