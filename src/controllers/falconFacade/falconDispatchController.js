import Joi from 'joi';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { putObject } from '../../../util/putObject.js';
import { falconPacking } from '../../models/falconFacade/falconPacking.model.js';
import { falocnDispatch } from '../../models/falconFacade/falconDispatch.model.js';
import { falconJobOrder } from '../../models/falconFacade/falconJobOrder.model.js';
import { falconProduct } from '../../models/falconFacade/helpers/falconProduct.model.js';
import { falconWorkOrder } from '../../models/falconFacade/falconWorkOrder.model.js';
import { falconCounter } from '../../models/falconFacade/falconCouner.model.js'
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

// const getScannedProductsData = asyncHandler(async (req, res) => {
//     try {
//       const qrId = req.query.id;
//       if (!qrId) {
//         return res.status(400).json({ success: false, message: "Please provide QR ID" });
//       }

//       const getScannedProducts = await falconPacking.findOne({ qr_id: qrId }).populate('product', 'name');
//       if (!getScannedProducts) {
//         return res.status(404).json({ success: false, message: "No packing entry found for QR ID" });
//       }

//       res.status(200).json({ success: true, data: getScannedProducts });
//     } catch (error) {
//       console.error('Error fetching scanned products:', error);
//       res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
//     }
//   });

const getScannedProductsData = asyncHandler(async (req, res) => {
    try {
        const qrId = req.query.id;
        if (!qrId) {
            return res.status(400).json({ success: false, message: "Please provide QR ID" });
        }

        // Find the packing entry by QR ID and populate product
        const packingEntry = await falconPacking.findOne({ qr_id: qrId }).populate('product', 'name');
        if (!packingEntry) {
            return res.status(404).json({ success: false, message: "No packing entry found for QR ID" });
        }
        console.log("packingEntry", packingEntry);

        if (packingEntry.delivery_stage !== 'Packed') {
            return res.status(400).json({ success: false, message: `Given QR ID '${qrId}' has already been dispatched or delivered` });
        }

        // Fetch job order details using job_order_id from packingEntry
        const jobOrder = await falconJobOrder.findOne({ _id: packingEntry.job_order_id });
        if (!jobOrder) {
            return res.status(404).json({ success: false, message: "No job order found for the packing entry" });
        }


        // Find the matching product in the job order's products array
        const productMatch = jobOrder.products.find(p => p.product.toString() === packingEntry.product._id.toString());
        if (!productMatch) {
            return res.status(404).json({ success: false, message: "No matching product found in job order" });
        }

        // Add the requested fields to the packing entry response
        const responseData = {
            ...packingEntry.toObject(),
            uom: productMatch.uom,
            code: productMatch.code,
            color_code: productMatch.color_code,
            width: productMatch.width,
            height: productMatch.height,
        };

        res.status(200).json({ success: true, data: responseData });
    } catch (error) {
        console.error('Error fetching scanned products:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
});



// Validation Schema for Falcon Dispatch
// const dispatchSchema = Joi.object({
//     job_order: Joi.string().required().messages({ 'string.empty': 'Job Order ID is required' }),
//     invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
//     vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
//     contact_person_detail: Joi.string().required().messages({ 'string.empty': 'Contact person details are required' }),
//     gate_pass_no: Joi.number().required().messages({ 'number.base': 'Gate Pass No is required' }),
//     dc_no: Joi.number().required().messages({ 'number.base': 'DC No is required' }),
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
//     dispatch_quantity: Joi.number().required().messages({ 'number.base': 'Dispatch quantity is required' }),
//     hsn_code: Joi.string().required().messages({ 'string.empty': 'HSN code is required' }),
//     boq: Joi.string().required().messages({ 'string.empty': 'BOQ is required' }),
//     rate: Joi.number().required().messages({ 'number.base': 'Rate is required' }),
//     amount: Joi.number().required().messages({ 'number.base': 'Amount is required' }),
//     hardware_included: Joi.string().optional().allow('').messages({ 'string.empty': 'Hardware included must be a string' }),
// });

// const createDispatch = async (req, res, next) => {
//     let body = { ...req.body };
//     if (typeof body.qr_codes === 'string') {
//         try {
//             body.qr_codes = JSON.parse(body.qr_codes);
//         } catch (e) {
//             return next(new ApiError(400, 'Invalid QR codes format: must be a valid JSON array'));
//         }
//     }

//     // Validate request body
//     const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
//     if (error) {
//         return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
//     }

//     const { job_order, invoice_or_sto, vehicle_number, contact_person_detail, gate_pass_no, dc_no, qr_codes, date, dispatch_quantity, hsn_code, boq, rate, amount, hardware_included } = value;
//     const userId = req.user.id;

//     if (!mongoose.Types.ObjectId.isValid(job_order)) {
//         return next(new ApiError(400, `Invalid Job Order ID: ${job_order}`));
//     }

//     // Fetch Packing Entries Based on Scanned QR Codes
//     const packingEntries = await falconPacking.find({ qr_code: { $in: qr_codes } }).populate('product', 'description');
//     if (!packingEntries || packingEntries.length === 0) {
//         return next(new ApiError(404, 'No packing entries found for scanned QR codes'));
//     }

//     // Fetch product names from falconProduct for each unique product_id
//     const uniqueProductIds = [...new Set(packingEntries.map(p => p.product._id.toString()))];
//     const productsData = await falconProduct.find({ _id: { $in: uniqueProductIds } });
//     const productMap = productsData.reduce((acc, product) => {
//         acc[product._id.toString()] = product.name;
//         return acc;
//     }, {});

//     // Construct products array with aggregated dispatch_quantity
//     const totalDispatchQuantity = packingEntries.reduce((sum, packing) => sum + packing.semi_finished_quantity, 0);
//     const products = packingEntries.map(packing => ({
//         product_id: packing.product._id,
//         product_name: productMap[packing.product._id.toString()],
//         semi_finished_id: packing.semi_finished_id,
//         dispatch_quantity: totalDispatchQuantity, // Aggregated from all packing entries
//         hsn_code: hsn_code,
//         boq: boq,
//         rate: rate,
//         amount: amount,
//         hardware_included: hardware_included,
//     }));

//     const files = req.files || [];
//     let invoiceFileUrls = [];
//     if (files.length > 0) {
//         for (const file of files) {
//             const tempFilePath = path.join('./public/temp', file.filename);
//             const fileBuffer = fs.readFileSync(tempFilePath);
//             const { url } = await putObject(
//                 { data: fileBuffer, mimetype: file.mimetype },
//                 `dispatch/${Date.now()}-${file.originalname}`
//             );
//             invoiceFileUrls.push(url);
//             fs.unlinkSync(tempFilePath);
//         }
//     }

//     // Create Dispatch Entry
//     const dispatchEntry = await falocnDispatch.create({
//         job_order,
//         packing_ids: packingEntries.map((p) => p._id),
//         products,
//         invoice_or_sto,
//         qr_codes,
//         vehicle_number,
//         contact_person_detail,
//         gate_pass_no,
//         dc_no,
//         created_by: userId,
//         invoice_file: invoiceFileUrls,
//         date,
//     });

//     // Update packing delivery_stage
//     await falconPacking.updateMany(
//         { _id: { $in: packingEntries.map((p) => p._id) } },
//         { delivery_stage: 'Dispatched', updated_by: userId }
//     );

//     res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
// };





// const dispatchSchema = Joi.object({
//     job_order: Joi.string().required().messages({ 'string.empty': 'Job Order ID is required' }),
//     invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
//     vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
//     contact_person_detail: Joi.string().required().messages({ 'string.empty': 'Contact person details are required' }),
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
//     dispatch_quantity: Joi.number().required().messages({ 'number.base': 'Dispatch quantity is required' }),
//     hsn_code: Joi.string().required().messages({ 'string.empty': 'HSN code is required' }),
//     boq: Joi.string().required().messages({ 'string.empty': 'BOQ is required' }),
//     rate: Joi.number().required().messages({ 'number.base': 'Rate is required' }),
//     amount: Joi.number().required().messages({ 'number.base': 'Amount is required' }),
//     hardware_included: Joi.string().optional().allow('').messages({ 'string.empty': 'Hardware included must be a string' }),
// });

// const createDispatch = async (req, res, next) => {
//     console.log("came in dispatch creation");

//     let body = { ...req.body };
//     console.log("bodyyyyy", body);
//     // console.log("file", req.files);
//     if (typeof body.qr_codes === 'string') {
//         try {
//             body.qr_codes = JSON.parse(body.qr_codes);
//         } catch (e) {
//             return next(new ApiError(400, 'Invalid QR codes format: must be a valid JSON array'));
//         }
//     }

//     // Validate request body (without gate_pass_no and dc_no)
//     const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
//     if (error) {
//         return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
//     }

//     const { job_order, invoice_or_sto, vehicle_number, contact_person_detail, qr_codes, date, dispatch_quantity, hsn_code, boq, rate, amount, hardware_included } = value;
//     const userId = req.user.id;

//     if (!mongoose.Types.ObjectId.isValid(job_order)) {
//         return next(new ApiError(400, `Invalid Job Order ID: ${job_order}`));
//     }

//     // Auto-generate gate_pass_no and dc_no using falconCounter
//     let counter = await falconCounter.findOneAndUpdate(
//         { _id: 'dispatchCounter' }, // Unique identifier for dispatch counter
//         { $inc: { sequence_value: 1 } },
//         { new: true, upsert: true }
//     );
//     const gate_pass_no = counter.sequence_value;
//     const dc_no = counter.sequence_value;

//     // Fetch Packing Entries Based on Scanned QR Codes
//     const packingEntries = await falconPacking.find({ qr_code: { $in: qr_codes } }).populate('product', 'description');
//     if (!packingEntries || packingEntries.length === 0) {
//         return next(new ApiError(404, 'No packing entries found for scanned QR codes'));
//     }

//     // Fetch product names from falconProduct for each unique product_id
//     const uniqueProductIds = [...new Set(packingEntries.map(p => p.product._id.toString()))];
//     const productsData = await falconProduct.find({ _id: { $in: uniqueProductIds } });
//     const productMap = productsData.reduce((acc, product) => {
//         acc[product._id.toString()] = product.name;
//         return acc;
//     }, {});

//     // Construct products array with aggregated dispatch_quantity
//     const totalDispatchQuantity = packingEntries.reduce((sum, packing) => sum + packing.semi_finished_quantity, 0);
//     console.log("totalDispatchQuantity", totalDispatchQuantity);
//     const products = packingEntries.map(packing => ({
//         product_id: packing.product._id,
//         product_name: productMap[packing.product._id.toString()],
//         semi_finished_id: packing.semi_finished_id,
//         dispatch_quantity: totalDispatchQuantity, // Aggregated from all packing entries
//         hsn_code: hsn_code,
//         boq: boq,
//         rate: rate,
//         amount: amount,
//         hardware_included: hardware_included,
//     }));

//     const files = req.files || [];
//     let invoiceFileUrls = [];
//     if (files.length > 0) {
//         for (const file of files) {
//             const tempFilePath = path.join('./public/temp', file.filename);
//             const fileBuffer = fs.readFileSync(tempFilePath);
//             const { url } = await putObject(
//                 { data: fileBuffer, mimetype: file.mimetype },
//                 `dispatch/${Date.now()}-${file.originalname}`
//             );
//             invoiceFileUrls.push(url);
//             fs.unlinkSync(tempFilePath);
//         }
//     }

//     // Create Dispatch Entry
//     const dispatchEntry = await falocnDispatch.create({
//         job_order,
//         packing_ids: packingEntries.map((p) => p._id),
//         products,
//         invoice_or_sto,
//         qr_codes,
//         vehicle_number,
//         contact_person_detail,
//         gate_pass_no,
//         dc_no,
//         created_by: userId,
//         invoice_file: invoiceFileUrls,
//         date,
//     });

//     // Update packing delivery_stage
//     await falconPacking.updateMany(
//         { _id: { $in: packingEntries.map((p) => p._id) } },
//         { delivery_stage: 'Dispatched', updated_by: userId }
//     );

//     res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
// };

const dispatchSchema = Joi.object({
    job_order: Joi.string().required().messages({ 'string.empty': 'Job Order ID is required' }),
    invoice_or_sto: Joi.string().required().messages({ 'string.empty': 'Invoice/STO is required' }),
    vehicle_number: Joi.string().required().messages({ 'string.empty': 'Vehicle number is required' }),
    contact_person_detail: Joi.string().required().messages({ 'string.empty': 'Contact person details are required' }),
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
    dispatch_quantity: Joi.number().optional().messages({ 'number.base': 'Dispatch quantity must be a number' }),
    // Old format fields (optional for backward compatibility)
    hsn_code: Joi.string().optional().allow('').messages({ 'string.empty': 'HSN code must be a string' }),
    boq: Joi.string().optional().allow('').messages({ 'string.empty': 'BOQ must be a string' }),
    rate: Joi.number().optional().messages({ 'number.base': 'Rate must be a number' }),
    amount: Joi.number().optional().messages({ 'number.base': 'Amount must be a number' }),
    hardware_included: Joi.string().optional().allow('').messages({ 'string.empty': 'Hardware included must be a string' }),
    // New format: products array and hardware
    products: Joi.string().optional().allow(''),
    hardware: Joi.string().optional().allow(''),
});

const createDispatch = async (req, res, next) => {
    console.log("came in dispatch creation");

    let body = { ...req.body };
    console.log("bodyyyyy", body);
    if (typeof body.qr_codes === 'string') {
        try {
            body.qr_codes = JSON.parse(body.qr_codes);
        } catch (e) {
            return next(new ApiError(400, 'Invalid QR codes format: must be a valid JSON array'));
        }
    }
    
    // Parse products array if sent from frontend
    let frontendProducts = null;
    if (body.products && typeof body.products === 'string') {
        try {
            frontendProducts = JSON.parse(body.products);
        } catch (e) {
            return next(new ApiError(400, 'Invalid products format: must be a valid JSON array'));
        }
    }
    
    // Parse hardware data if sent from frontend (now an array)
    let hardwareData = [];
    if (body.hardware && typeof body.hardware === 'string') {
        try {
            hardwareData = JSON.parse(body.hardware);
            if (!Array.isArray(hardwareData)) {
                hardwareData = [hardwareData]; // Convert single object to array for backward compatibility
            }
        } catch (e) {
            return next(new ApiError(400, 'Invalid hardware format: must be a valid JSON array'));
        }
    }

    // Validate request body (without gate_pass_no and dc_no)
    const { error, value } = dispatchSchema.validate(body, { abortEarly: false });
    if (error) {
        return next(new ApiError(400, 'Validation failed for dispatch creation', error.details));
    }

    const { job_order, invoice_or_sto, vehicle_number, contact_person_detail, qr_codes, date, dispatch_quantity, hsn_code, boq, rate, amount, hardware_included } = value;
    const userId = req.user.id;
    
    console.log("frontendProducts parsed:", frontendProducts);

    if (!mongoose.Types.ObjectId.isValid(job_order)) {
        return next(new ApiError(400, `Invalid Job Order ID: ${job_order}`));
    }

    // Auto-generate gate_pass_no and dc_no using falconCounter
    // let counter = await falconCounter.findOneAndUpdate(
    //     { _id: 'dispatchCounter' },
    //     { $inc: { sequence_value: 1 } },
    //     { new: true, upsert: true }
    // );
    // const gate_pass_no = counter.sequence_value;
    // const dc_no = counter.sequence_value;

    const generateUniqueFourDigitNumber = async (field) => {
        let unique = false;
        let num;
        while (!unique) {
            num = Math.floor(1000 + Math.random() * 9000);
            const exists = await falocnDispatch.findOne({ [field]: num });
            if (!exists) unique = true;
        }
        return num;
    };

    const gate_pass_no = await generateUniqueFourDigitNumber('gate_pass_no');
    const dc_no = await generateUniqueFourDigitNumber('dc_no');

    // Fetch Packing Entries Based on Scanned QR Codes
    const packingEntries = await falconPacking.find({ qr_code: { $in: qr_codes } }).populate('product', 'description');
    if (!packingEntries || packingEntries.length === 0) {
        return next(new ApiError(404, 'No packing entries found for scanned QR codes'));
    }

    // Check if any of the packing entries are already dispatched
    const alreadyDispatched = packingEntries.filter(entry => entry.delivery_stage !== 'Packed');
    if (alreadyDispatched.length > 0) {
        const scannedIds = alreadyDispatched.map(entry => entry.qr_code || entry.qr_id).join(', ');
        return next(new ApiError(400, `The following QR codes have already been dispatched or delivered: ${scannedIds}`));
    }

    // Fetch product names from falconProduct for each unique product_id
    const uniqueProductIds = [...new Set(packingEntries.map(p => p.product._id.toString()))];
    const productsData = await falconProduct.find({ _id: { $in: uniqueProductIds } });
    const productMap = productsData.reduce((acc, product) => {
        acc[product._id.toString()] = product.name;
        return acc;
    }, {});

    // Use frontend products data if available, otherwise group from packing entries
    let products;
    
    if (frontendProducts && Array.isArray(frontendProducts) && frontendProducts.length > 0) {
        // Use product-specific data from frontend
        products = frontendProducts.map(fp => {
            // Find all packing entries for this product + semi-finished combination
            const relatedPackings = packingEntries.filter(
                p => p.product._id.toString() === fp.productId && p.semi_finished_id === fp.semiFinishedId
            );
            const dispatchQty = relatedPackings.reduce((sum, p) => sum + (p.semi_finished_quantity || 0), 0);
            
            return {
                product_id: fp.productId,
                product_name: productMap[fp.productId],
                semi_finished_id: fp.semiFinishedId,
                dispatch_quantity: dispatchQty,
                hsn_code: fp.hsnCode || '',
                boq: fp.boq || '',
                rate: fp.rate || 0,
                amount: fp.amount || 0,
            };
        });
        console.log("products from frontend:", products);
    } else {
        // Fallback: Group packing entries by product_id + semi_finished_id combination
        const productGroupMap = {};
        packingEntries.forEach(packing => {
            const productId = packing.product._id.toString();
            const semiFinishedId = packing.semi_finished_id;
            const key = `${productId}_${semiFinishedId}`;
            
            if (!productGroupMap[key]) {
                productGroupMap[key] = {
                    product_id: packing.product._id,
                    product_name: productMap[productId],
                    semi_finished_id: semiFinishedId,
                    dispatch_quantity: 0,
                    hsn_code: hsn_code || '',
                    boq: boq || '',
                    rate: rate || 0,
                    amount: 0,
                };
            }
            productGroupMap[key].dispatch_quantity += packing.semi_finished_quantity || 0;
        });

        // Convert grouped map to array and calculate amounts
        products = Object.values(productGroupMap).map((product) => ({
            ...product,
            amount: product.dispatch_quantity * (rate || 0),
        }));
        console.log("products grouped by product + semi-finished (fallback):", products);
    }
    
    // Prepare hardware data array
    const hardware = hardwareData && Array.isArray(hardwareData) && hardwareData.length > 0 
        ? hardwareData.map(hw => ({
            description: hw.description || '',
            quantity: hw.quantity || 0,
            hsn_code: hw.hsnCode || '',
            uom: hw.uom || '',
            rate: hw.rate || 0,
            amount: hw.amount || 0,
        }))
        : [];

    // const files = req.files || [];
    // let invoiceFileUrls = [];
    // if (files.length > 0) {
    //     for (const file of files) {
    //         const tempFilePath = path.join('./public/temp', file.filename);
    //         const fileBuffer = fs.readFileSync(tempFilePath);
    //         const { url } = await putObject(
    //             { data: fileBuffer, mimetype: file.mimetype },
    //             `dispatch/${Date.now()}-${file.originalname}`
    //         );
    //         invoiceFileUrls.push(url);
    //         fs.unlinkSync(tempFilePath);
    //     }
    // }


    const files = req.files || [];
    let invoiceFileUrls = [];
    if (files.length > 0) {
        for (const file of files) {
            try {
                const s3Key = `dispatch/${Date.now()}-${sanitizeFilename(file.originalname)}`;
                const { url } = await putObject(
                    { data: file.buffer, mimetype: file.mimetype },
                    s3Key
                );
                invoiceFileUrls.push(url);
            } catch (err) {
                return next(new ApiError(500, `Failed to upload invoice file: ${err.message}`));
            }
        }
    }


    // Create Dispatch Entry
    const dispatchEntry = await falocnDispatch.create({
        job_order,
        packing_ids: packingEntries.map((p) => p._id),
        products,
        hardware,
        invoice_or_sto,
        qr_codes,
        vehicle_number,
        contact_person_detail,
        gate_pass_no,
        dc_no,
        created_by: userId,
        invoice_file: invoiceFileUrls,
        date,
    });

    // Update packing delivery_stage
    await falconPacking.updateMany(
        { _id: { $in: packingEntries.map((p) => p._id) } },
        { delivery_stage: 'Dispatched', updated_by: userId }
    );

    res.status(201).json(new ApiResponse(201, dispatchEntry, 'Dispatch created successfully'));
};

// const getAllDispatches = asyncHandler(async (req, res, next) => {
//     const dispatches = await falocnDispatch.find({ status: 'Approved' })
//         .populate({
//             path: 'job_order',
//             select: 'client_id project_id work_order_number',
//             populate: {
//                 path: 'client_id',
//                 select: 'name',
//                 model: 'falconClient',
//             },
//             populate: {
//                 path: 'project_id',
//                 select: 'name',
//                 model: 'falconProject',
//             },
//         })
//         .populate({
//             path: 'products.product_id',
//             select: 'name',
//         })
//         .populate('created_by', 'username')
//         .lean();

//     if (!dispatches || dispatches.length === 0) {
//         return next(new ApiError(404, 'No approved dispatches found'));
//     }
//     console.log("dispatches",dispatches);

//     // Transform the response to match the desired format
//     const formattedDispatches = dispatches.map((dispatch) => {
//         // Find the job_order_id from falconJobOrder linked via work_order_number
//         const jobOrderId = dispatch.job_order?.work_order_number ? dispatch.job_order.work_order_number.job_order_id : 'N/A';

//         return {
//             _id: dispatch._id,
//             job_order_id: jobOrderId,
//             client_name: dispatch.job_order?.client_id?.name || 'N/A',
//             project_name: dispatch.job_order?.project_id?.name || 'N/A',
//             product_names: dispatch.products.map((product) => ({
//                 name: product.product_id?.name || product.product_name || 'N/A',
//                 dispatch_quantity: product.dispatch_quantity != null ? product.dispatch_quantity : 'N/A',
//             })),
//             contact_person_detail: dispatch.contact_person_detail || 'N/A',
//             gate_pass_no: dispatch.gate_pass_no != null ? dispatch.gate_pass_no : 'N/A',
//             dc_no: dispatch.dc_no != null ? dispatch.dc_no : 'N/A',
//             created_by: dispatch.created_by?.username || 'N/A',
//             created_at: dispatch.createdAt,
//         };
//     });

//     return res.status(200).json(
//         new ApiResponse(200, formattedDispatches, 'Approved dispatch records fetched successfully')
//     );
// });

const getAllDispatches = asyncHandler(async (req, res, next) => {
    const dispatches = await falocnDispatch.find({ status: 'Approved' })
        .populate({
            path: 'packing_ids',
            select: 'job_order_id',
            model: 'falconPacking',
        })
        .populate({
            path: 'products.product_id',
            select: 'name',
        })
        .populate('created_by', 'username')
        .lean();

    if (!dispatches || dispatches.length === 0) {
        return next(new ApiError(404, 'No approved dispatches found'));
    }

    // Transform the response using packing_ids to get job_order details
    const formattedDispatches = await Promise.all(dispatches.map(async (dispatch) => {
        let jobOrderId = 'N/A';
        let clientName = 'N/A';
        let projectName = 'N/A';

        if (dispatch.packing_ids && dispatch.packing_ids.length > 0) {
            // Use the first packing_id to get job_order_id (assuming all packing_ids share the same job_order_id)
            const packing = dispatch.packing_ids[0];
            if (packing.job_order_id) {
                const joborder = await falconJobOrder.findOne({ _id: packing.job_order_id }).select('job_order_id');
                jobOrderId = joborder?.job_order_id || 'N/A';

                // Fetch falconJobOrder to get work_order_number
                const jobOrder = await falconJobOrder.findOne({ _id: packing.job_order_id }).select('work_order_number');
                if (jobOrder && jobOrder.work_order_number) {
                    // Fetch falconWorkOrder using work_order_number
                    const workOrder = await falconWorkOrder.findOne({ _id: jobOrder.work_order_number })
                        .populate('client_id', 'name')
                        .populate('project_id', 'name')
                        .lean();

                    if (workOrder) {
                        clientName = workOrder.client_id?.name || 'N/A';
                        projectName = workOrder.project_id?.name || 'N/A';
                    }
                }
            }
        }

        return {
            _id: dispatch._id,
            job_order_id: jobOrderId,
            client_name: clientName,
            project_name: projectName,
            product_names: dispatch.products.map((product) => ({
                name: product.product_id?.name || product.product_name || 'N/A',
                dispatch_quantity: product.dispatch_quantity != null ? product.dispatch_quantity : 'N/A',
            })),
            contact_person_detail: dispatch.contact_person_detail || 'N/A',
            gate_pass_no: dispatch.gate_pass_no != null ? dispatch.gate_pass_no : 'N/A',
            dc_no: dispatch.dc_no != null ? dispatch.dc_no : 'N/A',
            created_by: dispatch.created_by?.username || 'N/A',
            created_at: dispatch.createdAt,
        };
    }));

    return res.status(200).json(
        new ApiResponse(200, formattedDispatches, 'Approved dispatch records fetched successfully')
    );
});


// const getDispatchById = asyncHandler(async (req, res, next) => {
//     const { id } = req.params; // Assuming dispatch _id is passed as a route parameter (e.g., /dispatches/:id)

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         return next(new ApiError(400, 'Invalid dispatch ID format'));
//     }

//     const dispatch = await falocnDispatch.findOne({ _id: id, status: 'Approved' })
//         .populate({
//             path: 'packing_ids',
//             select: 'job_order_id',
//             model: 'falconPacking',
//         })
//         .populate({
//             path: 'products.product_id',
//             select: 'name',
//         })
//         .populate('created_by', 'username')
//         .lean();

//     if (!dispatch) {
//         return next(new ApiError(404, 'No approved dispatch found with the given ID'));
//     }

//     let jobOrderId = 'N/A';
//     let clientName = 'N/A';
//     let projectName = 'N/A';

//     if (dispatch.packing_ids && dispatch.packing_ids.length > 0) {
//         const packing = dispatch.packing_ids[0];
//         if (packing.job_order_id) {
//             const jobOrder = await falconJobOrder.findOne({ _id: packing.job_order_id }).select('job_order_id');
//             jobOrderId = jobOrder?.job_order_id || 'N/A';

//             const workOrder = await falconWorkOrder.findOne({ _id: jobOrder.work_order_number })
//                 .populate('client_id', 'name')
//                 .populate('project_id', 'name')
//                 .lean();

//             if (workOrder) {
//                 clientName = workOrder.client_id?.name || 'N/A';
//                 projectName = workOrder.project_id?.name || 'N/A';
//             }
//         }
//     }

//     // Transform each product into a separate dispatch detail entry
//     const dispatchDetails = dispatch.products.map((product) => ({
//         _id: dispatch._id,
//         job_order_id: jobOrderId,
//         client_name: clientName,
//         project_name: projectName,
//         product_id: product.product_id?._id || 'N/A',
//         product_name: product.product_id?.name || product.product_name || 'N/A',
//         semi_finished_id: product.semi_finished_id || 'N/A',
//         dispatch_quantity: product.dispatch_quantity != null ? product.dispatch_quantity : 'N/A',
//         hsn_code: product.hsn_code || 'N/A',
//         boq: product.boq || 'N/A',
//         rate: product.rate != null ? product.rate : 'N/A',
//         amount: product.amount != null ? product.amount : 'N/A',
//         hardware_included: product.hardware_included || 'N/A',
//         invoice_or_sto: dispatch.invoice_or_sto || 'N/A',
//         vehicle_number: dispatch.vehicle_number || 'N/A',
//         contact_person_detail: dispatch.contact_person_detail || 'N/A',
//         gate_pass_no: dispatch.gate_pass_no != null ? dispatch.gate_pass_no : 'N/A',
//         dc_no: dispatch.dc_no != null ? dispatch.dc_no : 'N/A',
//         invoice_file: dispatch.invoice_file || [],
//         date: dispatch.date ? dispatch.date.toISOString().split('T')[0] : 'N/A',
//         created_by: dispatch.created_by?.username || 'N/A',
//         created_at: dispatch.createdAt,
//     }));

//     return res.status(200).json(
//         new ApiResponse(200, dispatchDetails, 'Dispatch details fetched successfully')
//     );
// });

const getDispatchById = asyncHandler(async (req, res, next) => {
    const { id } = req.params; // Assuming dispatch _id is passed as a route parameter (e.g., /dispatches/:id)

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ApiError(400, 'Invalid dispatch ID format'));
    }

    const dispatch = await falocnDispatch.findOne({ _id: id, status: 'Approved' })
        .populate({
            path: 'packing_ids',
            select: 'job_order_id',
            model: 'falconPacking',
        })
        .populate({
            path: 'products.product_id',
            select: 'name',
        })
        .populate('created_by', 'username')
        .lean();

    if (!dispatch) {
        return next(new ApiError(404, 'No approved dispatch found with the given ID'));
    }
    // console.log("dispatch", dispatch);

    let jobOrderId = 'N/A';
    let clientName = 'N/A';
    let clientAddress = 'N/A';
    let projectName = 'N/A';
    let projectAddress = 'N/A';


    if (dispatch.packing_ids && dispatch.packing_ids.length > 0) {
        const packing = dispatch.packing_ids[0];
        if (packing.job_order_id) {
            const jobOrder = await falconJobOrder.findOne({ _id: packing.job_order_id }).select('job_order_id work_order_number');
            jobOrderId = jobOrder?.job_order_id || 'N/A';

            const workOrder = await falconWorkOrder.findOne({ _id: jobOrder.work_order_number })
                .populate('client_id', 'name address')
                .populate('project_id', 'name address')
                .lean();

            if (workOrder) {
                console.log("workOrder", workOrder);
                clientName = workOrder.client_id?.name || 'N/A';
                clientAddress = workOrder.client_id?.address || 'N/A';
                projectName = workOrder.project_id?.name || 'N/A';
                projectAddress = workOrder.project_id?.address || 'N/A';
            }
        }
    }

    // Simplified response structure
    const response = {
        workOrderDetails: {
            workOrder: jobOrderId,
            clientName: clientName,
            clientAddress: clientAddress,
            projectName: projectName,
            projectAddress: projectAddress,
            invoiceOrOrder: dispatch.invoice_or_sto || 'N/A',
            vehicleNumber: dispatch.vehicle_number || 'N/A',
            gatePass: dispatch.gate_pass_no != null ? dispatch.gate_pass_no : 'N/A',
            dcNo: dispatch.dc_no != null ? dispatch.dc_no : 'N/A',
            contactPerson: dispatch.contact_person_detail || 'N/A',
        },
        productDetails: dispatch.products.map((product) => ({
            id: dispatch._id,
            jobOrderId: jobOrderId,
            // clientName: 'N/A',
            // projectName: 'N/A',
            productId: product.product_id?._id || 'N/A',
            productName: product.product_id?.name || product.product_name || 'N/A',
            semiFinishedId: product.semi_finished_id || 'N/A',
            dispatchQuantity: product.dispatch_quantity != null ? product.dispatch_quantity : 'N/A',
            hsnCode: product.hsn_code || 'N/A',
            boq: product.boq || 'N/A',
            rate: product.rate != null ? product.rate : 'N/A',
            amount: product.amount != null ? product.amount : 'N/A',
            invoiceOrOrder: dispatch.invoice_or_sto || 'N/A',
            vehicleNumber: dispatch.vehicle_number || 'N/A',
            gatePass: dispatch.gate_pass_no != null ? dispatch.gate_pass_no : 'N/A',
            dcNo: dispatch.dc_no != null ? dispatch.dc_no : 'N/A',
            invoiceFile: dispatch.invoice_file || [],
            date: dispatch.date ? dispatch.date.toISOString().split('T')[0] : 'N/A',
            createdBy: dispatch.created_by?.username || 'N/A',
            createdAt: dispatch.createdAt,
        })),
        hardware: dispatch.hardware || [],
    };

    return res.status(200).json({
        message: 'Dispatch details fetched successfully',
        success: true, data: response
    });
});

const updateFalconDispatchSchema = Joi.object({
    invoice_or_sto: Joi.string().optional().messages({ 'string.empty': 'Invoice/STO cannot be empty' }),
    vehicle_number: Joi.string().optional().messages({ 'string.empty': 'Vehicle number cannot be empty' }),
    date: Joi.date()
        .iso()
        .optional()
        .messages({
            'date.base': 'Date must be a valid ISO date',
        }),
    contact_person_detail: Joi.string().optional().messages({ 'string.empty': 'Contact person details cannot be empty' }),
});

const updateFalconDispatch = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        return next(new ApiError(401, 'Unauthorized: User not authenticated'));
    }

    // 1. Validate dispatch ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ApiError(400, `Invalid Dispatch ID: ${id}`));
    }

    const { error, value } = updateFalconDispatchSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return next(new ApiError(400, 'Validation failed for dispatch update', error.details));
    }

    const { invoice_or_sto, vehicle_number, date, contact_person_detail } = value;
    const files = req.files;

    // 2. Prepare update object
    const updateFields = {
        updated_by: userId,
        ...(invoice_or_sto && { invoice_or_sto }),
        ...(vehicle_number && { vehicle_number }),
        ...(date && { date }),
        ...(contact_person_detail && { contact_person_detail }),
    };

    // 3. Handle file upload to S3 if provided
    let invoiceFileUrls = [];
    // if (files && Array.isArray(files) && files.length > 0) {
    //     for (const file of files) {
    //         const tempFilePath = path.join('./public/temp', file.filename);
    //         try {
    //             const fileBuffer = fs.readFileSync(tempFilePath);
    //             const s3Path = `dispatch/${Date.now()}-${file.originalname}`;
    //             const { url } = await putObject(
    //                 { data: fileBuffer, mimetype: file.mimetype },
    //                 s3Path
    //             );
    //             invoiceFileUrls.push(url);
    //         } catch (error) {
    //             return next(new ApiError(500, `Failed to upload invoice file to S3: ${error.message}`));
    //         } finally {
    //             try {
    //                 if (fs.existsSync(tempFilePath)) {
    //                     fs.unlinkSync(tempFilePath);
    //                 }
    //             } catch (error) {
    //                 console.error(`Failed to delete temp file ${tempFilePath}:`, error);
    //             }
    //         }
    //     }
    //     updateFields.invoice_file = invoiceFileUrls; // Replace existing array
    // }

    if (files && files.length > 0) {
        for (const file of files) {
            try {
                const s3Key = `dispatch/${Date.now()}-${sanitizeFilename(file.originalname)}`;
                const { url } = await putObject(
                    { data: file.buffer, mimetype: file.mimetype },
                    s3Key
                );
                invoiceFileUrls.push(url);
            } catch (err) {
                return next(new ApiError(500, `Failed to upload invoice file: ${err.message}`));
            }
        }
        updateFields.invoice_file = invoiceFileUrls;
    }
    

    // 4. Check if there are fields to update
    if (Object.keys(updateFields).length === 1 && updateFields.updated_by && !invoiceFileUrls.length) {
        return next(new ApiError(400, 'No valid fields provided for update'));
    }

    // 5. Update dispatch with transaction
    try {
        console.log(`Updating dispatch with ID: ${id}`);
        console.log('Update fields:', updateFields);
        
        const updatedDispatch = await falocnDispatch.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedDispatch) {
            return next(new ApiError(404, 'Dispatch not found'));
        }

        console.log(`Dispatch ${id} updated successfully`);
        
        return res.status(200).json(
            new ApiResponse(200, updatedDispatch, 'Dispatch updated successfully')
        );
    } catch (error) {
        return next(new ApiError(500, `Failed to update dispatch: ${error.message}`));
    }
});

export { getScannedProductsData, createDispatch, getAllDispatches, getDispatchById, updateFalconDispatch };