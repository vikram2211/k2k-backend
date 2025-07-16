import { ironWorkOrder } from "../../models/ironSmith/workOrder.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { putObject } from "../../../util/putObject.js";
import fs from 'fs';
import path from 'path';

const createIronWorkOrder = asyncHandler(async (req, res) => {
    const { clientId, projectId, workOrderNumber, workOrderDate, products } = req.body;
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('Products raw value length:', products ? products.length : 0);
    console.log('Products raw value:', products);

    // Validate required fields
    if (!clientId || !projectId || !workOrderNumber || !workOrderDate || !products) {
        throw new ApiError(400, 'Missing required fields');
    }

    // Parse products array with error handling
    let parsedProducts;
    try {
        console.log('Attempting to parse products:', products);
        parsedProducts = JSON.parse(products).map((product) => ({
            shapeId: product.shapeId,
            uom: product.uom,
            quantity: parseInt(product.quantity),
            plantCode: product.plantCode,
            deliveryDate: product.deliveryDate ? new Date(product.deliveryDate) : null,
            barMark: product.barMark || '',
            memberDetails: product.memberDetails || '',
            dimensions: product.dimensions || [],
        }));
        console.log('Parsed products:', parsedProducts);
    } catch (error) {
        console.error('JSON Parse error details:', {
            message: error.message,
            position: error.position,
            input: products,
        });
        throw new ApiError(400, 'Invalid products JSON format');
    }

    // Handle file uploads
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const tempFilePath = path.join('./public/temp', file.filename);
            const fileBuffer = fs.readFileSync(tempFilePath);

            // Upload to S3
            const { url } = await putObject(
                { data: fileBuffer, mimetype: file.mimetype },
                `iron-work-orders/${Date.now()}-${file.originalname}`
            );

            // Delete temp file
            fs.unlinkSync(tempFilePath);

            uploadedFiles.push({
                file_name: file.originalname,
                file_url: url,
            });
        }
    }

    const workOrder = new ironWorkOrder({
        clientId,
        projectId,
        workOrderNumber,
        workOrderDate: new Date(workOrderDate),
        products: parsedProducts,
        files: uploadedFiles,
    });

    await workOrder.save();
    return res.status(201).json(new ApiResponse(201, workOrder, 'Work order created successfully'));
});

export { createIronWorkOrder };