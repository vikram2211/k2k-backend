
import { iornPacking } from "../../models/ironSmith/packing.model.js";
import { ironShape } from "../../models/ironSmith/helpers/ironShape.model.js";
import { ironWorkOrder } from '../../models/ironSmith/workOrder.model.js';
import { ironJobOrder } from '../../models/ironSmith/jobOrders.model.js';
import QRCode from 'qrcode';
import { putObject } from '../../../util/putObject.js';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../../utils/ApiError.js';
import mongoose from 'mongoose';


const createPackingBundle1 = async (req, res) => {
  try {
    const { work_order, shape_id, product_quantity, bundle_size, weight } = req.body;

    // Validate required fields
    if (!shape_id || !product_quantity || !bundle_size) {
      throw new ApiError(400, 'shape_id, product_quantity, and bundle_size are required');
    }

    // Validate numeric fields
    if (isNaN(product_quantity) || isNaN(bundle_size) || (weight && isNaN(weight))) {
      throw new ApiError(400, 'product_quantity, bundle_size, and weight must be numbers');
    }

    // Check achieved production quantity
    if (work_order && shape_id) {
      // Get diameter from the request body or query parameters
      const diameter = req.body.diameter || req.query.diameter;
      
      const productionData = await mongoose.connection.db.collection('irondailyproductions').aggregate([
        {
          $match: {
            work_order: new mongoose.Types.ObjectId(work_order)
          }
        },
        {
          $unwind: '$products'
        },
        {
          $lookup: {
            from: 'ironjoborders',
            let: { objectId: '$products.object_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$$objectId', '$products._id']
                  }
                }
              },
              {
                $unwind: '$products'
              },
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$products._id', '$$objectId'] },
                      { $eq: ['$products.shape', new mongoose.Types.ObjectId(shape_id)] },
                      ...(diameter ? [{ $eq: ['$products.dia', parseInt(diameter)] }] : [])
                    ]
                  }
                }
              }
            ],
            as: 'jobOrderProduct'
          }
        },
        {
          $match: {
            'jobOrderProduct.0': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            totalAchieved: { $sum: '$products.achieved_quantity' }
          }
        }
      ]).toArray();

      const achievedQuantity = productionData.length > 0 ? productionData[0].totalAchieved : 0;
      
      if (product_quantity > achievedQuantity) {
        throw new ApiError(400, `Product quantity (${product_quantity}) cannot exceed achieved production quantity (${achievedQuantity})`);
      }
    }

    // Calculate number of bundles
    const totalBundles = Math.floor(product_quantity / bundle_size);
    if (totalBundles === 0) {
      throw new ApiError(400, 'bundle_size must be less than or equal to product_quantity');
    }

    const packingRecords = [];
    for (let i = 0; i < totalBundles; i++) {
      const qrCodeId = uuidv4(); // Generate unique QR code ID for each bundle
      const qrContent = JSON.stringify({
        work_order: work_order || null,
        shape_id,
        product_quantity: bundle_size,
        bundle_size,
        weight: weight || 0,
        bundle_number: i + 1,
        total_bundles: totalBundles,
        qr_code_id: qrCodeId, // Include QR code ID in content for verification
      });

      // Generate QR code buffer
      let qrCodeBuffer;
      try {
        qrCodeBuffer = await QRCode.toBuffer(qrContent, {
          type: 'png',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 200,
        });
      } catch (error) {
        throw new ApiError(500, `Failed to generate QR code for bundle ${i + 1}: ${error.message}`);
      }

      // Generate unique file name for S3
      const fileName = `qr-codes/packing-${qrCodeId}-${i + 1}.png`;
      const file = {
        data: qrCodeBuffer,
        mimetype: 'image/png',
      };

      // Upload QR code to S3
      let qrCodeUrl;
      try {
        const { url } = await putObject(file, fileName);
        qrCodeUrl = url;
      } catch (error) {
        throw new ApiError(500, `Failed to upload QR code to S3 for bundle ${i + 1}: ${error.message}`);
      }

      // Create packing record with explicit qr_code
      const packingRecord = new iornPacking({
        work_order,
        shape_id,
        product_quantity: bundle_size,
        bundle_size,
        weight: weight || 0,
        delivery_stage: 'Packed',
        //   qr_code: qrCodeId, // Always set to a unique UUID
        qr_code_url: qrCodeUrl,
        packed_by: req.user._id, // Assuming req.user is set by authentication middleware
      });
      packingRecords.push(packingRecord);
    }

    // Save all packing records to the database
    const savedRecords = await iornPacking.insertMany(packingRecords);

    res.status(201).json({
      success: true,
      message: `${totalBundles} packing records created successfully`,
      data: savedRecords,
    });
  } catch (error) {
    console.error('Error creating packing records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const createPackingBundle_05_08_2025 = async (req, res) => {
  try {
    const { work_order, shape_id, product_quantity, bundle_size, weight, qr_code } = req.body;

    // Validate required fields
    if (!shape_id || !product_quantity || !bundle_size) {
      throw new ApiError(400, 'shape_id, product_quantity, and bundle_size are required');
    }

    // Validate numeric fields
    if (isNaN(product_quantity) || isNaN(bundle_size) || (weight && isNaN(weight))) {
      throw new ApiError(400, 'product_quantity, bundle_size, and weight must be numbers');
    }

    // Calculate number of bundles
    const totalBundles = Math.floor(product_quantity / bundle_size);
    if (totalBundles === 0) {
      throw new ApiError(400, 'bundle_size must be less than or equal to product_quantity');
    }

    const packingRecords = [];
    for (let i = 0; i < totalBundles; i++) {
      const packingRecord = new iornPacking({
        work_order,
        shape_id,
        product_quantity: bundle_size,
        bundle_size,
        weight: weight || 0,
        // delivery_stage: 'Packed',
        packed_by: req.user._id, // Assuming req.user is set by authentication middleware
      });
      packingRecords.push(packingRecord);
    }

    // Save all packing records to the database
    const savedRecords = await iornPacking.insertMany(packingRecords);

    res.status(201).json({
      success: true,
      message: `${totalBundles} packing records created successfully`,
      data: savedRecords,
    });
  } catch (error) {
    console.error('Error creating packing records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// Inside createPackingBundle API
const createPackingBundle_25_09_2025_6_PM = async (req, res) => {
  try {
    const { work_order, shape_id, product_quantity, bundle_size, weight } = req.body;

    // --- NEW: Update packed_quantity in job order ---
    const jobOrder = await ironJobOrder.findOne({ 
work_order: work_order });
    if (!jobOrder) {
      throw new ApiError(404, "Job order not found");
    }

    // Find the product in the job order's products array
    const productIndex = jobOrder.products.findIndex(
      (p) => p.shape.toString() === shape_id.toString()
    );

    if (productIndex === -1) {
      throw new ApiError(404, "Product not found in job order");
    }

    // Update the packed_quantity
    jobOrder.products[productIndex].packed_quantity += product_quantity;
    await jobOrder.save();
    // --- END NEW ---

    // Calculate number of bundles (as before)
    const fullBundles = Math.ceil(product_quantity / bundle_size);
    const remainingItems = product_quantity % bundle_size;
    const numberOfBundles = remainingItems > 0 ? Math.max(1, fullBundles) : fullBundles;

    // Create packing records (as before)
    const packingRecords = [];
    let itemsAssigned = 0;
    for (let i = 0; i < numberOfBundles; i++) {
      let bundleQuantity;
      if (i < numberOfBundles - 1) {
        bundleQuantity = bundle_size;
      } else {
        bundleQuantity = product_quantity - itemsAssigned;
      }
      const packingRecord = new iornPacking({
        work_order: work_order || null,
        shape_id,
        product_quantity: bundleQuantity,
        bundle_size,
        weight: weight || 0,
        delivery_stage: "Packed", // --- NEW: Set status to "Packed" ---
        packed_by: req.user._id,
      });
      packingRecords.push(packingRecord);
      itemsAssigned += bundleQuantity;
    }

    // Save all packing records to the database
    const savedRecords = await iornPacking.insertMany(packingRecords);

    res.status(201).json({
      success: true,
      message: `${numberOfBundles} packing records created successfully`,
      data: savedRecords,
    });
  } catch (error) {
    console.error('Error creating packing records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const createPackingBundle = async (req, res) => {
  try {
    const { work_order, shape_id, object_id, product_quantity, bundle_size, weight, qr_codes, bundle_quantities } = req.body;

    // Find the specific job order that contains the product being packed.
    // This is more precise than finding by just work_order, which might not be unique.
    const jobOrder = await ironJobOrder.findOne({ "products._id": object_id });
    console.log("jobOrder",jobOrder);
    
    if (!jobOrder) {
      throw new ApiError(404, "Job order not found");
    }

    const productIndex = jobOrder.products.findIndex(
      (p) => p._id.toString() === object_id.toString()
    );
    if (productIndex === -1) {
      throw new ApiError(404, "Product not found in job order");
    }

    jobOrder.products[productIndex].packed_quantity += product_quantity;
    await jobOrder.save();

    // Create packing records for each QR code with the correct bundle quantity
    const packingRecords = await iornPacking.insertMany(
      qr_codes.map((qrCode, index) => ({
        work_order,
        shape_id,
        object_id,
        product_quantity: bundle_quantities[index], // Use the correct bundle quantity
        bundle_size,
        weight: weight || 0,
        qr_code: qrCode,
        delivery_stage: "Packed",
        packed_by: req.user._id,
      }))
    );

    // Generate QR code images and upload to S3
    const updatedRecords = [];
    for (const record of packingRecords) {
      const qrContent = JSON.stringify({
        work_order: record.work_order,
        shape_id: record.shape_id,
        product_quantity: record.product_quantity,
        bundle_size: record.bundle_size,
        weight: record.weight,
        qr_code_id: record.qr_code,
      });

      // Generate QR code buffer
      let qrCodeBuffer;
      try {
        qrCodeBuffer = await QRCode.toBuffer(qrContent, {
          type: 'png',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 200,
        });
      } catch (error) {
        throw new ApiError(500, `Failed to generate QR code for packing ${record._id}: ${error.message}`);
      }

      // Upload QR code to S3
      let qrCodeUrl;
      try {
        const fileName = `qr-codes/packing-${record._id}-${record.qr_code}.png`;
        const file = { data: qrCodeBuffer, mimetype: 'image/png' };
        const { url } = await putObject(file, fileName);
        qrCodeUrl = url;
      } catch (error) {
        throw new ApiError(500, `Failed to upload QR code to S3 for packing ${record._id}: ${error.message}`);
      }

      // Update the packing record with the QR code URL
      record.qr_code_url = qrCodeUrl;
      const updatedRecord = await record.save();
      updatedRecords.push(updatedRecord);
    }

    res.status(201).json({
      success: true,
      message: `${updatedRecords.length} packing records created and updated with QR codes successfully`,
      data: updatedRecords,
    });
  } catch (error) {
    console.error('Error creating packing records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};







const createPackingBundle_25_09_2025 = async (req, res) => {
  try {
    const { work_order, shape_id, product_quantity, bundle_size, weight } = req.body;
    console.log("product_quantity",product_quantity);

    // Validate required fields
    if (!shape_id || !product_quantity || !bundle_size) {
      throw new ApiError(400, 'shape_id, product_quantity, and bundle_size are required');
    }

    // Validate numeric fields
    if (
      isNaN(product_quantity) ||
      isNaN(bundle_size) ||
      (weight && isNaN(weight))
    ) {
      throw new ApiError(400, 'product_quantity, bundle_size, and weight must be numbers');
    }

    // Validate positive values
    if (product_quantity <= 0) {
      throw new ApiError(400, 'product_quantity must be greater than 0');
    }
    if (bundle_size <= 0) {
      throw new ApiError(400, 'bundle_size must be greater than 0');
    }

    // Calculate number of bundles
    const fullBundles = Math.ceil(product_quantity / bundle_size);
    const remainingItems = product_quantity % bundle_size;
    const numberOfBundles = remainingItems > 0 ? Math.max(1, fullBundles) : fullBundles;

    // Create packing records
    const packingRecords = [];
    let itemsAssigned = 0;

    for (let i = 0; i < numberOfBundles; i++) {
      let bundleQuantity;
      if (i < numberOfBundles - 1) {
        // Full bundles
        bundleQuantity = bundle_size;
      } else {
        // Last bundle gets remainder or all items if fewer than bundle_size
        bundleQuantity = product_quantity - itemsAssigned;
      }

      const packingRecord = new iornPacking({
        work_order: work_order || null,
        shape_id,
        product_quantity: bundleQuantity,
        bundle_size,
        weight: weight || 0,
        // delivery_stage: 'Packed',
        packed_by: req.user._id,
      });

      packingRecords.push(packingRecord);
      itemsAssigned += bundleQuantity;
    }

    // Validate total items assigned
    if (itemsAssigned !== product_quantity) {
      throw new ApiError(400, 'Total items in bundles do not match product_quantity');
    }

    // Save all packing records to the database
    const savedRecords = await iornPacking.insertMany(packingRecords);

    res.status(201).json({
      success: true,
      message: `${numberOfBundles} packing records created successfully`,
      data: savedRecords,
    });
  } catch (error) {
    console.error('Error creating packing records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const generatePackingQRCode1 = async (req, res) => {
  try {
    const { qr_code } = req.body;
    const { packingId } = req.params; // Assuming packingId is passed as a URL parameter

    // Validate input
    if (!qr_code || !packingId) {
      throw new ApiError(400, 'qr_code and packingId are required');
    }

    // Find the existing packing record
    const packingRecord = await iornPacking.findById(packingId);
    if (!packingRecord) {
      throw new ApiError(404, 'Packing record not found');
    }

    // Generate QR code content based on packing details
    const qrContent = JSON.stringify({
      work_order: packingRecord.work_order || null,
      shape_id: packingRecord.shape_id,
      product_quantity: packingRecord.product_quantity,
      bundle_size: packingRecord.bundle_size,
      weight: packingRecord.weight || 0,
      bundle_number: 1, // Single record, so bundle_number is 1
      total_bundles: 1, // Single record, so total_bundles is 1
      qr_code_id: qr_code, // Use the provided qr_code as the identifier
    });

    // Generate QR code buffer
    let qrCodeBuffer;
    try {
      qrCodeBuffer = await QRCode.toBuffer(qrContent, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 200,
      });
    } catch (error) {
      throw new ApiError(500, `Failed to generate QR code for packing ${packingId}: ${error.message}`);
    }

    // Generate unique file name for S3
    const fileName = `qr-codes/packing-${packingId}-${qr_code}.png`;
    const file = {
      data: qrCodeBuffer,
      mimetype: 'image/png',
    };

    // Upload QR code to S3
    let qrCodeUrl;
    try {
      const { url } = await putObject(file, fileName);
      qrCodeUrl = url;
    } catch (error) {
      throw new ApiError(500, `Failed to upload QR code to S3 for packing ${packingId}: ${error.message}`);
    }

    // Update the packing record
    packingRecord.delivery_stage = 'Packed';
    packingRecord.qr_code = qr_code;
    packingRecord.qr_code_url = qrCodeUrl;
    const updatedRecord = await packingRecord.save();

    res.status(200).json({
      success: true,
      message: 'Packing record updated with QR code successfully',
      data: updatedRecord,
    });
  } catch (error) {
    console.error('Error generating QR code for packing record:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const generatePackingQRCode = async (req, res) => {
  try {
    const { packings } = req.body;

    // Validate input
    if (!packings || !Array.isArray(packings) || packings.length === 0) {
      throw new ApiError(400, 'packings array is required and must contain at least one entry');
    }

    const updatedRecords = [];

    for (const { packing_id, qr_code } of packings) {
      // Validate each packing entry
      if (!packing_id || !qr_code) {
        throw new ApiError(400, 'Each packing entry must contain packing_id and qr_code');
      }

      // Find the existing packing record
      const packingRecord = await iornPacking.findById(packing_id);
      if (!packingRecord) {
        throw new ApiError(404, `Packing record not found for packing_id: ${packing_id}`);
      }

      // Generate QR code content based on packing details
      const qrContent = JSON.stringify({
        work_order: packingRecord.work_order || null,
        shape_id: packingRecord.shape_id,
        product_quantity: packingRecord.product_quantity,
        bundle_size: packingRecord.bundle_size,
        weight: packingRecord.weight || 0,
        bundle_number: packings.findIndex(p => p.packing_id === packing_id) + 1, // Index-based bundle number
        total_bundles: packings.length,
        qr_code_id: qr_code,
      });

      // Generate QR code buffer
      let qrCodeBuffer;
      try {
        qrCodeBuffer = await QRCode.toBuffer(qrContent, {
          type: 'png',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 200,
        });
      } catch (error) {
        throw new ApiError(500, `Failed to generate QR code for packing ${packing_id}: ${error.message}`);
      }

      // Generate unique file name for S3
      const fileName = `qr-codes/packing-${packing_id}-${qr_code}.png`;
      const file = {
        data: qrCodeBuffer,
        mimetype: 'image/png',
      };

      // Upload QR code to S3
      let qrCodeUrl;
      try {
        const { url } = await putObject(file, fileName);
        qrCodeUrl = url;
      } catch (error) {
        throw new ApiError(500, `Failed to upload QR code to S3 for packing ${packing_id}: ${error.message}`);
      }

      // Update the packing record
      packingRecord.delivery_stage = 'Packed';
      packingRecord.qr_code = qr_code;
      packingRecord.qr_code_url = qrCodeUrl;
      const updatedRecord = await packingRecord.save();

      updatedRecords.push(updatedRecord);
    }

    res.status(200).json({
      success: true,
      message: `${updatedRecords.length} packing records updated with QR codes successfully`,
      data: updatedRecords,
    });
  } catch (error) {
    console.error('Error generating QR codes for packing records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const getAllPackingDetails1 = async (req, res) => {
  try {
    // Aggregation pipeline
    const packingDetails = await iornPacking.aggregate([
      {
        $lookup: {
          from: 'ironworkorders', // Join with ironWorkOrder collection
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true, // Handle cases where work_order is null
        },
      },
      {
        $lookup: {
          from: 'ironshapes', // Join with ironShape collection
          localField: 'shape_id',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: '$shapeDetails', // Deconstruct the shapeDetails array
      },
      {
        $lookup: {
          from: 'users', // Join with User collection
          localField: 'packed_by',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true, // Handle cases where packed_by is null
        },
      },

      {
        $project: {
          wo_id: '$workOrderDetails._id',
          wo: '$workOrderDetails.workOrderNumber',
          shape: '$shapeDetails.shape_code',
          shape_id: '$shapeDetails._id',
          status: 1,
          time: '$createdAt',
          created_by: '$userDetails.username',
          _id: 0,
        },
      },
    ]).exec();

    if (!packingDetails.length) {
      return res.status(200).json({
        success: true,
        message: 'No packing records found',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'All packing details retrieved successfully',
      data: packingDetails,
    });
  } catch (error) {
    console.error('Error retrieving packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const getAllPackingDetails2 = async (req, res) => {
  try {
    const packingDetails = await iornPacking.aggregate([
      {
        $lookup: {
          from: 'ironworkorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'ironjoborders',
          let: { workOrderId: '$work_order', shapeId: '$shape_id', objectId: '$object_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$work_order', '$$workOrderId'] } } },
            { $unwind: '$products' },
            {
              $match: {
                $expr: {
                  $and: [
                    { $or: [
                      { $eq: ['$products._id', '$$objectId'] },
                      { $eq: ['$products.shape', '$$shapeId'] },
                      { $eq: ['$products.shape_id', '$$shapeId'] }
                    ] }
                  ]
                }
              }
            },
            { $project: { _id: 0, barMark: '$products.barMark', dia: '$products.dia', member: '$products.member', description: '$products.description', weight_kgs: '$products.weight', dimensions: '$products.dimensions' } }
          ],
          as: 'productDetails'
        }
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'shape_id',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: '$shapeDetails',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'packed_by',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          wo_id: '$workOrderDetails._id',
          wo: '$workOrderDetails.workOrderNumber',
          shape: '$shapeDetails.shape_code',
          shape_id: '$shapeDetails._id',
          time: '$createdAt',
          created_by: '$userDetails.username',
          qr_code: 1,
          status: 1,
        },
      },
      {
        $group: {
          _id: '$shape_id',
          wo_id: { $first: '$wo_id' },
          wo: { $first: '$wo' },
          shape: { $first: '$shape' },
          shape_id: { $first: '$shape_id' },
          time: { $first: '$time' },
          created_by: { $first: '$created_by' },
          status: { $first: '$status' },
          qr_code: { $push: '$qr_code' }, // collect all QR codes in array
        },
      },
      {
        $project: {
          _id: 0,
          wo_id: 1,
          wo: 1,
          shape: 1,
          shape_id: 1,
          time: 1,
          created_by: 1,
          status: 1,
          qr_code: 1,
        },
      },
    ]).exec();

    res.status(200).json({
      success: true,
      message: 'All packing details retrieved successfully',
      data: packingDetails,
    });
  } catch (error) {
    console.error('Error retrieving packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};
const getAllPackingDetails_11_09_2025 = async (req, res) => {
  try {
    const packingDetails = await iornPacking.aggregate([
      {
        $lookup: {
          from: 'ironworkorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'shape_id',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: '$shapeDetails',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'packed_by',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            shape_id: '$shape_id',
            work_order: '$work_order',
          },
          wo_id: { $first: '$workOrderDetails._id' },
          wo: { $first: '$workOrderDetails.workOrderNumber' },
          shape: { $first: '$shapeDetails.shape_code' },
          shape_id: { $first: '$shapeDetails._id' },
          time: { $first: '$createdAt' },
          created_by: { $first: '$userDetails.username' },
          status: { $first: '$delivery_stage' }, // from packing record
          qr_code: { $push: '$qr_code' }, // collect all QR codes
        },
      },
      {
        $project: {
          _id: 0,
          wo_id: 1,
          wo: 1,
          shape: 1,
          shape_id: 1,
          time: 1,
          created_by: 1,
          status: 1,
          qr_code: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: 'All packing details retrieved successfully',
      data: packingDetails,
    });
  } catch (error) {
    console.error('Error retrieving packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};



const getAllPackingDetails = async (req, res) => {
  try {
    const packingDetails = await iornPacking.aggregate([
      // Filter for records with delivery_stage: "Packed"
      {
        $match: {
          delivery_stage: 'Packed',
        },
      },
      {
        $lookup: {
          from: 'ironworkorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'shape_id',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: {
          path: '$shapeDetails',
          preserveNullAndEmptyArrays: true, // Handle cases where shape_id might not exist
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'packed_by',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            shape_id: '$shape_id',
            work_order: '$work_order',
          },
          wo_id: { $first: '$workOrderDetails._id' },
          wo: { $first: '$workOrderDetails.workOrderNumber' },
          shape: { $first: '$shapeDetails.shape_code' },
          shape_id: { $first: '$shapeDetails._id' },
          time: { $first: '$createdAt' },
          created_by: { $first: '$userDetails.username' },
          status: { $first: '$delivery_stage' },
          qr_code: { $push: '$qr_code' },
        },
      },
      {
        $project: {
          _id: 0,
          wo_id: 1,
          wo: 1,
          shape: 1,
          shape_id: 1,
          time: 1,
          created_by: 1,
          status: 1,
          qr_code: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: packingDetails.length ? 'Packed records retrieved successfully' : 'No packed records found',
      data: packingDetails,
    });
  } catch (error) {
    console.error('Error retrieving packed records:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};



const getPackingDetailsById_11_09_2025 = async (req, res) => {
  try {
    const { wo_id, shape_id } = req.query;

    // Validate input parameters
    if (!wo_id || !shape_id) {
      return res.status(400).json({
        success: false,
        message: 'work_order ID and shape ID are required',
      });
    }

    // Aggregation pipeline
    const packingDetails = await iornPacking.aggregate([
      {
        $match: {
          work_order: new mongoose.Types.ObjectId(wo_id),
          shape_id: new mongoose.Types.ObjectId(shape_id),
          delivery_stage:"Packed"
        },
      },
      {
        $lookup: {
          from: 'ironWorkOrders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
        },
      },
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: 'ironshapes',
          localField: 'shape_id',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: '$shapeDetails',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'packed_by',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {

          wo_id: '$work_order',
          // wo: '$workOrderDetails.workOrderNumber',
          shape: '$shapeDetails.shape_code',
          shape_id: '$shapeDetails._id',
          status: '$delivery_stage',
          time: '$createdAt',
          created_by: '$userDetails.username',
          qr_code: '$qr_code',
        },
      },
    ]);

    if (!packingDetails.length) {
      return res.status(200).json({
        success: true,
        message: 'No packing records found for the given IDs',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Packing details retrieved successfully',
      data: packingDetails,
    });
  } catch (error) {
    console.error('Error retrieving packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const getPackingDetailsById = async (req, res) => {
  try {
    const { wo_id, shape_id } = req.query;

    // Validate input parameters
    if (!wo_id || !shape_id) {
      return res.status(400).json({
        success: false,
        message: 'work_order ID and shape ID are required',
      });
    }

    // Aggregation pipeline
    const packingDetails = await iornPacking.aggregate([
      {
        $match: {
          work_order: new mongoose.Types.ObjectId(wo_id),
          shape_id: new mongoose.Types.ObjectId(shape_id),
          delivery_stage: "Packed"
        },
      },
      {
        $lookup: {
          from: 'ironworkorders',
          localField: 'work_order',
          foreignField: '_id',
          as: 'workOrderDetails',
          pipeline: [
            {
              $lookup: {
                from: 'ironclients',
                localField: 'clientId',
                foreignField: '_id',
                as: 'clientDetails',
              },
            },
            {
              $unwind: {
                path: '$clientDetails',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: 'ironprojects',
                localField: 'projectId',
                foreignField: '_id',
                as: 'projectDetails',
              },
            },
            {
              $unwind: {
                path: '$projectDetails',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: 'ironjoborders',
                localField: '_id',
                foreignField: 'work_order',
                as: 'jobOrderDetails',
              },
            },
            {
              $unwind: {
                path: '$jobOrderDetails',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                workOrderNumber: 1,
                client_name: '$clientDetails.name',
                project_name: '$projectDetails.name',
                job_order_number: '$jobOrderDetails.job_order_number',
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$workOrderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'shape_id',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: {
          path: '$shapeDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'packed_by',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          cutting_length: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$productDetails.dimensions', []] } }, 0] },
              {
                $reduce: {
                  input: '$productDetails.dimensions',
                  initialValue: '',
                  in: {
                    $concat: [
                      { $cond: [{ $eq: ['$$value', ''] }, '', { $concat: ['$$value', ', '] }] },
                      { $concat: ['$$this.name', ': ', { $ifNull: ['$$this.value', '-'] }] }
                    ]
                  }
                }
              },
              null
            ]
          }
        }
      },
      {
        $project: {
          wo_id: '$work_order',
          wo: '$workOrderDetails.workOrderNumber',
          client_name: '$workOrderDetails.client_name',
          project_name: '$workOrderDetails.project_name',
          job_order_number: '$workOrderDetails.job_order_number',
          shape: '$shapeDetails.shape_code',
          shape_id: '$shapeDetails._id',
          status: '$delivery_stage',
          time: '$createdAt',
          created_by: '$userDetails.username',
          qr_code: '$qr_code',
          qr_code_url: '$qr_code_url',
          product_quantity: '$product_quantity',
          member: { $ifNull: ['$productDetails.member', 'N/A'] },
          description: { $ifNull: ['$productDetails.description', '$shapeDetails.description'] },
          barMark: { $ifNull: ['$productDetails.barMark', 'N/A'] },
          dia: { $ifNull: ['$productDetails.dia', 'N/A'] },
          cutting_length: { $ifNull: ['$cutting_length', 'N/A'] },
          weight_kgs: { $ifNull: ['$productDetails.weight_kgs', '$shapeDetails.weight'] }
        },
      },
    ]);

    if (!packingDetails.length) {
      return res.status(200).json({
        success: true,
        message: 'No packing records found for the given IDs',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Packing details retrieved successfully',
      data: packingDetails,
    });
  } catch (error) {
    console.error('Error retrieving packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const updatePackingDetails = async (req, res) => {
  try {
    const { packingId } = req.params;
    const { product_quantity, weight, bundle_size } = req.body;

    // Validate input parameters
    if (!packingId) {
      throw new ApiError(400, 'packingId is required');
    }

    // Find the existing packing record
    const packingRecord = await iornPacking.findById(packingId);
    if (!packingRecord) {
      throw new ApiError(404, 'Packing record not found');
    }

    // Validate numeric fields
    if (product_quantity && isNaN(product_quantity)) {
      throw new ApiError(400, 'product_quantity must be a number');
    }
    if (weight && isNaN(weight)) {
      throw new ApiError(400, 'weight must be a number');
    }
    if (bundle_size && isNaN(bundle_size)) {
      throw new ApiError(400, 'bundle_size must be a number');
    }

    // Update the record
    if (bundle_size) {
      packingRecord.bundle_size = bundle_size;
      // If bundle_size changes, adjust product_quantity to match (no recalculation of bundles for a single record)
      packingRecord.product_quantity = bundle_size; // Ensure consistency for a single record
    }
    if (product_quantity) {
      packingRecord.product_quantity = product_quantity;
    }
    if (weight) {
      packingRecord.weight = weight;
    }

    const updatedRecord = await packingRecord.save();

    res.status(200).json({
      success: true,
      message: 'Packing details updated successfully',
      data: updatedRecord,
    });
  } catch (error) {
    console.error('Error updating packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const deletePackingDetails = async (req, res) => {
  try {
    const { packingId } = req.params;
    const { wo_id, shape_id } = req.query;

    // Validate input
    if (!packingId && (!wo_id || !shape_id)) {
      throw new ApiError(400, 'Either packingId or both work_order ID and shape ID are required');
    }

    let deleteResult;

    if (packingId) {
      // Delete a single record by packingId
      const deletedRecord = await iornPacking.findByIdAndDelete(packingId);
      if (!deletedRecord) {
        throw new ApiError(404, 'Packing record not found');
      }
      deleteResult = { deletedCount: 1, deletedRecord };
    } else {
      // Delete all records for the given work_order and shape_id
      deleteResult = await iornPacking.deleteMany({
        work_order: mongoose.Types.ObjectId(wo_id),
        shape_id: mongoose.Types.ObjectId(shape_id),
      });
      if (deleteResult.deletedCount === 0) {
        throw new ApiError(404, 'No packing records found for the given work_order and shape_id');
      }
    }

    res.status(200).json({
      success: true,
      message: packingId ? 'Packing record deleted successfully' : 'Packing records deleted successfully',
      data: { deletedCount: deleteResult.deletedCount, ...(packingId ? { deletedRecord: deleteResult.deletedRecord } : {}) },
    });
  } catch (error) {
    console.error('Error deleting packing details:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const getShapesByWorkOrderId_25_09_2025 = async (req, res) => {
  try {
    const { work_order_id } = req.query;
    console.log("work_order_id",work_order_id);
    // Validate input parameter
    if (!work_order_id) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id is required',
      });
    }

    // Debug: Check if there's any production data for this work order
    console.log('=== DEBUGGING PRODUCTION DATA ===');
    console.log('Work Order ID:', work_order_id);
    
    // Check raw production data first
    const rawProductionData = await mongoose.connection.db.collection('irondailyproductions').find({
      work_order: new mongoose.Types.ObjectId(work_order_id)
    }).toArray();
    console.log('Raw production data count:', rawProductionData.length);
    if (rawProductionData.length > 0) {
      console.log('Sample production record:', JSON.stringify(rawProductionData[0], null, 2));
    } else {
      // Check if there are any production records at all
      const allProductionData = await mongoose.connection.db.collection('irondailyproductions').find({}).limit(1).toArray();
      console.log('Total production records in collection:', await mongoose.connection.db.collection('irondailyproductions').countDocuments());
      if (allProductionData.length > 0) {
        console.log('Sample production record structure:', JSON.stringify(allProductionData[0], null, 2));
      }
    }

    // Aggregation pipeline
    const shapes = await ironWorkOrder.aggregate([
      {
        $match: {
          _id:new mongoose.Types.ObjectId(work_order_id),
        },
      },
      {
        $unwind: '$products',
      },
      { 
        $group: {
          _id: {
            shapeId: '$products.shapeId',
            diameter: '$products.diameter'
          },
          po_quantity: { $first: '$products.quantity' },
          diameter: { $first: '$products.diameter' },
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: '_id.shapeId',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: '$shapeDetails',
      },
      {
        $lookup: {
          from: 'irondailyproductions',
          let: { 
            workOrderId: new mongoose.Types.ObjectId(work_order_id),
            shapeId: '$_id.shapeId',
            diameter: '$_id.diameter'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$work_order', '$$workOrderId'] }
                  ]
                }
              }
            },
            {
              $unwind: '$products'
            },
            {
              $lookup: {
                from: 'ironjoborders',
                let: { objectId: '$products.object_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $in: ['$$objectId', '$products._id']
                      }
                    }
                  },
                  {
                    $unwind: '$products'
                  },
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$products._id', '$$objectId'] },
                          { $eq: ['$products.shape', '$$shapeId'] },
                          { $eq: ['$products.dia', '$$diameter'] }
                        ]
                      }
                    }
                  }
                ],
                as: 'jobOrderProduct'
              }
            },
            {
              $match: {
                'jobOrderProduct.0': { $exists: true }
              }
            },
            {
              $group: {
                _id: null,
                totalAchieved: { $sum: '$products.achieved_quantity' }
              }
            }
          ],
          as: 'productionData',
        },
      },
      {
        $project: {
          _id: 0,
          shape_id: '$shapeDetails._id',
          shape_code: '$shapeDetails.shape_code',
          po_quantity: 1,
          diameter: 1,
          achieved_quantity: { 
            $ifNull: [{ $arrayElemAt: ['$productionData.totalAchieved', 0] }, 0] 
          },
        },
      },
    ]);

    console.log('Aggregation result - shapes found:', shapes.length);
    console.log('Shapes data:', JSON.stringify(shapes, null, 2));

    if (!shapes.length) {
      return res.status(200).json({
        success: true,
        message: 'No shapes found for the given work_order_id',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Shapes retrieved successfully',
      data: shapes,
    });
  } catch (error) {
    console.error('Error retrieving shapes:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const getShapesByWorkOrderId_25_09_2025_6_PM = async (req, res) => {
  try {
    const { work_order_id } = req.query;

    // Validate input parameter
    if (!work_order_id) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(work_order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid work_order_id format',
      });
    }

    // Aggregation pipeline
    const shapes = await ironWorkOrder.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(work_order_id),
        },
      },
      {
        $unwind: '$products',
      },
      {
        $lookup: {
          from: 'ironjoborders',
          localField: '_id',
          foreignField: 'work_order',
          as: 'jobOrders',
        },
      },
      {
        $unwind: {
          path: '$jobOrders',
          preserveNullAndEmptyArrays: true, // Allow for cases with no job orders
        },
      },
      {
        $unwind: {
          path: '$jobOrders.products',
          preserveNullAndEmptyArrays: true, // Allow for cases with no products
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ['$jobOrders.products.shape', '$products.shapeId'] },
              { $eq: ['$jobOrders.products.dia', '$products.diameter'] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'irondailyproductions',
          let: {
            jobOrderId: '$jobOrders._id',
            shapeId: '$products.shapeId',
            objectId: '$jobOrders.products._id',
            diameter: '$products.diameter',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$job_order', '$$jobOrderId'],
                },
              },
            },
            {
              $unwind: '$products',
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$products.shape_id', '$$shapeId'] },
                    { $eq: ['$products.object_id', '$$objectId'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalAchieved: { $sum: '$products.achieved_quantity' },
                totalRejected: { $sum: '$products.rejected_quantity' },
                totalRecycled: { $sum: '$products.recycled_quantity' },
              },
            },
          ],
          as: 'productionData',
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'products.shapeId',
          foreignField: '_id',
          as: 'shapeDetails',
        },
      },
      {
        $unwind: {
          path: '$shapeDetails',
          preserveNullAndEmptyArrays: false, // Ensure shape exists
        },
      },
      {
        $group: {
          _id: {
            barMark: '$products.barMark',
            jobOrderNumber: '$jobOrders.job_order_number',
            shapeId: '$products.shapeId',
            diameter: '$products.diameter',
          },
          shapeCode: { $first: '$shapeDetails.shape_code' },
          po_quantity: { $first: '$products.quantity' },
          achieved_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalAchieved', 0] }, 0],
            },
          },
          rejected_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalRejected', 0] }, 0],
            },
          },
          recycled_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalRecycled', 0] }, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          barMark: '$_id.barMark',
          job_order_number: '$_id.jobOrderNumber',
          shape_id: '$_id.shapeId',
          shape_code: '$shapeCode',
          diameter: '$_id.diameter',
          po_quantity: 1,
          achieved_quantity: 1,
          rejected_quantity: 1,
          recycled_quantity: 1,
        },
      },
      {
        $sort: {
          job_order_number: 1,
          barMark: 1,
          shape_id: 1,
          diameter: 1,
        },
      },
    ]);

    console.log('Aggregation result - shapes found:', shapes.length);
    console.log('Shapes data:', JSON.stringify(shapes, null, 2));

    if (!shapes.length) {
      return res.status(200).json({
        success: true,
        message: 'No shapes found for the given work_order_id',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Shapes retrieved successfully',
      data: shapes,
    });
  } catch (error) {
    console.error('Error retrieving shapes:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};



const getShapesByWorkOrderId_26_09_2025_11_PM = async (req, res) => {
  try {
    const { work_order_id } = req.query;

    // Validate input parameter
    if (!work_order_id) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(work_order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid work_order_id format',
      });
    }

    // Aggregation pipeline
    const shapes = await ironWorkOrder.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(work_order_id),
        },
      },
      {
        $unwind: '$products',
      },
      {
        $lookup: {
          from: 'ironjoborders',
          localField: '_id',
          foreignField: 'work_order',
          as: 'jobOrders',
        },
      },
      {
        $unwind: {
          path: '$jobOrders',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$jobOrders.products',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ['$jobOrders.products.shape', '$products.shapeId'] },
              { $eq: ['$jobOrders.products.dia', '$products.diameter'] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'irondailyproductions',
          let: {
            jobOrderId: '$jobOrders._id',
            shapeId: '$products.shapeId',
            objectId: '$jobOrders.products._id',
            diameter: '$products.diameter',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$job_order', '$$jobOrderId'],
                },
              },
            },
            {
              $unwind: '$products',
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$products.shape_id', '$$shapeId'] },
                    { $eq: ['$products.object_id', '$$objectId'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalAchieved: { $sum: '$products.achieved_quantity' },
                totalRejected: { $sum: '$products.rejected_quantity' },
                totalRecycled: { $sum: '$products.recycled_quantity' },
              },
            },
          ],
          as: 'productionData',
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'products.shapeId',
          foreignField: '_id',
          pipeline: [
            { $match: { isDeleted: false } }, // Exclude deleted shapes
          ],
          as: 'shapeDetails',
        },
      },
      {
        $unwind: {
          path: '$shapeDetails',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            barMark: '$products.barMark',
            jobOrderId: '$jobOrders._id',
            jobOrderNumber: '$jobOrders.job_order_number',
            shapeId: '$products.shapeId',
            diameter: '$products.diameter',
            objectId: '$jobOrders.products._id', // Add object_id from ironJobOrder.products
          },
          shapeCode: { $first: '$shapeDetails.shape_code' },
          po_quantity: { $first: '$products.quantity' },
          achieved_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalAchieved', 0] }, 0],
            },
          },
          rejected_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalRejected', 0] }, 0],
            },
          },
          recycled_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalRecycled', 0] }, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          barMark: '$_id.barMark',
          job_order_id: '$_id.jobOrderId', // Include job_order_id
          job_order_number: '$_id.jobOrderNumber',
          shape_id: '$_id.shapeId',
          shape_code: '$shapeCode',
          diameter: '$_id.diameter',
          object_id: '$_id.objectId', // Include object_id
          po_quantity: 1,
          achieved_quantity: 1,
          rejected_quantity: 1,
          recycled_quantity: 1,
        },
      },
      {
        $sort: {
          job_order_number: 1,
          barMark: 1,
          shape_id: 1,
          diameter: 1,
        },
      },
    ]);

    console.log('Aggregation result - shapes found:', shapes.length);
    console.log('Shapes data:', JSON.stringify(shapes, null, 2));

    if (!shapes.length) {
      return res.status(200).json({
        success: true,
        message: 'No shapes found for the given work_order_id',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Shapes retrieved successfully',
      data: shapes,
    });
  } catch (error) {
    console.error('Error retrieving shapes:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


const getShapesByWorkOrderId = async (req, res) => {
  try {
    const { work_order_id } = req.query;
    if (!work_order_id) {
      return res.status(400).json({
        success: false,
        message: 'work_order_id is required',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(work_order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid work_order_id format',
      });
    }

    const shapes = await ironWorkOrder.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(work_order_id),
        },
      },
      {
        $unwind: '$products',
      },
      {
        $lookup: {
          from: 'ironjoborders',
          localField: '_id',
          foreignField: 'work_order',
          as: 'jobOrders',
        },
      },
      {
        $unwind: {
          path: '$jobOrders',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$jobOrders.products',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ['$jobOrders.products.shape', '$products.shapeId'] },
              { $eq: ['$jobOrders.products.dia', '$products.diameter'] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'irondailyproductions',
          let: {
            jobOrderId: '$jobOrders._id',
            shapeId: '$products.shapeId',
            objectId: '$jobOrders.products._id',
            diameter: '$products.diameter',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$job_order', '$$jobOrderId'],
                },
              },
            },
            {
              $unwind: '$products',
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$products.shape_id', '$$shapeId'] },
                    { $eq: ['$products.object_id', '$$objectId'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalAchieved: { $sum: '$products.achieved_quantity' },
                totalRejected: { $sum: '$products.rejected_quantity' },
                totalRecycled: { $sum: '$products.recycled_quantity' },
              },
            },
          ],
          as: 'productionData',
        },
      },
      {
        $lookup: {
          from: 'ironshapes',
          localField: 'products.shapeId',
          foreignField: '_id',
          pipeline: [
            { $match: { isDeleted: false } },
          ],
          as: 'shapeDetails',
        },
      },
      {
        $unwind: {
          path: '$shapeDetails',
          preserveNullAndEmptyArrays: false,
        },
      },
      // --- NEW: Lookup for total packed quantity ---
      {
        $lookup: {
          from: 'ironpackings',
          let: {
            objectId: '$jobOrders.products._id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$object_id', '$$objectId'],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalPacked: { $sum: '$product_quantity' },
              },
            },
          ],
          as: 'packingData',
        },
      },
      // --- END NEW ---
      {
        $group: {
          _id: {
            barMark: '$products.barMark',
            jobOrderId: '$jobOrders._id',
            jobOrderNumber: '$jobOrders.job_order_number',
            shapeId: '$products.shapeId',
            diameter: '$products.diameter',
            objectId: '$jobOrders.products._id',
          },
          shapeCode: { $first: '$shapeDetails.shape_code' },
          po_quantity: { $first: '$products.quantity' },
          achieved_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalAchieved', 0] }, 0],
            },
          },
          rejected_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalRejected', 0] }, 0],
            },
          },
          recycled_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$productionData.totalRecycled', 0] }, 0],
            },
          },
          // --- NEW: Calculate total packed quantity ---
          total_packed_quantity: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$packingData.totalPacked', 0] }, 0],
            },
          },
          // --- END NEW ---
        },
      },
      {
        $project: {
          _id: 0,
          barMark: '$_id.barMark',
          job_order_id: '$_id.jobOrderId',
          job_order_number: '$_id.jobOrderNumber',
          shape_id: '$_id.shapeId',
          shape_code: '$shapeCode',
          diameter: '$_id.diameter',
          object_id: '$_id.objectId',
          po_quantity: 1,
          achieved_quantity: 1,
          rejected_quantity: 1,
          recycled_quantity: 1,
          total_packed_quantity: 1, // Include total_packed_quantity
          // --- NEW: Calculate available quantity ---
          available_quantity: {
            $subtract: ['$achieved_quantity', '$total_packed_quantity'],
          },
          // --- END NEW ---
        },
      },
      {
        $sort: {
          job_order_number: 1,
          barMark: 1,
          shape_id: 1,
          diameter: 1,
        },
      },
    ]);

    console.log('Aggregation result - shapes found:', shapes.length);
    console.log('Shapes data:', JSON.stringify(shapes, null, 2));

    if (!shapes.length) {
      return res.status(200).json({
        success: true,
        message: 'No shapes found for the given work_order_id',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Shapes retrieved successfully',
      data: shapes,
    });
  } catch (error) {
    console.error('Error retrieving shapes:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};



export { createPackingBundle, generatePackingQRCode, getAllPackingDetails, getPackingDetailsById , updatePackingDetails, getShapesByWorkOrderId};