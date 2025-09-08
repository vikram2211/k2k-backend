import { falconWorkOrder } from '../../models/falconFacade/falconWorkOrder.model.js'
import { falconJobOrder } from "../../models/falconFacade/falconJobOrder.model.js";
import { falconProductSystem } from "../../models/falconFacade/helpers/falconProductSystem.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";
import fs from 'fs';
import path from 'path';
import { putObject } from "../../../util/putObject.js";
import { deleteObject } from "../../../util/deleteObject.js";
import { falconInternalWorkOrder } from "../../models/falconFacade/falconInternalWorder.model.js";
import { falconProject } from '../../models/falconFacade/helpers/falconProject.model.js';
import { falconClient } from '../../models/falconFacade/helpers/falconClient.model.js';
import { falconProduct } from '../../models/falconFacade/helpers/falconProduct.model.js';
import { Employee } from "../../models/employee.model.js";
import { falconProduction } from '../../models/falconFacade/falconProduction.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';


// Helper function to format date to DD-MM-YYYY
const formatDateOnly = (date) => {
    if (!date) return null;
    const istDate = new Date(date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const [day, month, year] = istDate.split('/');
    return `${day}-${month}-${year}`;
};


const getJobOrderAutoFetch = asyncHandler(async (req, res) => {
    // 1. Get job order ID from query
    const { joId } = req.query;
    console.log("joId", joId);

    // Validate joId
    if (!joId) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID (joId) is required in query parameters',
        });
    }

    // 2. Fetch job order with populated fields
    const jobOrder = await falconJobOrder
        .findOne({ _id: joId })
        // .populate({
        //     path: 'client_id',
        //     select: 'name',
        //     match: { isDeleted: false },
        // })
        // .populate({
        //     path: 'products',
        //     select: 'name',
        //     // match: { isDeleted: false },
        // })
        .populate({
            path: 'work_order_number',
            select: 'client_id project_id work_order_number',
            populate: [
                {
                    path: 'client_id',
                    select: 'name address',
                },
                {
                    path: 'project_id',
                    select: 'name address',
                },
            ],
        })
        .populate({
            path: 'products.product',
            select: 'name',
            model: 'falconProduct',
        })
        .lean();

    // Check if job order exists
    if (!jobOrder) {
        return res.status(404).json({
            success: false,
            message: `Job order not found with ID: ${joId}`,
        });
    }
    console.log("jobOrder", jobOrder);
    // jobOrder.products.map(product => (console.log("product",product)))

    // 3. Format the response
    const formattedResponse = {
        workOrderId: jobOrder.work_order_number._id,
        workOrderNumber: jobOrder.work_order_number.work_order_number,
        clientName: jobOrder.work_order_number.client_id?.name || 'N/A',
        clientAddress: jobOrder.work_order_number.client_id?.address || 'N/A',
        projectName: jobOrder.work_order_number.project_id?.name || 'N/A',
        products: jobOrder.products.map(product => ({
            productId: product.product._id,
            productName: product.product.name,
            code: product.code,
            colorCode: product.color_code,
            height: product.height,
            width: product.width,
        })),
        productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
        productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
    };

    // 4. Send response
    return res.status(200).json({
        success: true,
        message: 'Job order details fetched successfully',
        data: formattedResponse,
    });
});

const getJobOrderProductDetails = asyncHandler(async (req, res) => {
    // 1. Get job order ID and product ID from query
    const { joId, prId } = req.query;

    // Validate inputs
    if (!joId || !prId) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID (joId) and product ID (prId) are required in query parameters',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(prId)) {
        return res.status(400).json({
            success: false,
            message: `Invalid product ID: ${prId}`,
        });
    }

    // 2. Fetch job order with populated fields
    const jobOrder = await falconJobOrder
        .findOne({ _id: joId })
        .populate({
            path: 'client_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .populate({
            path: 'project_id',
            select: 'name',
            match: { isDeleted: false },
        })
        .lean();

    // Check if job order exists
    if (!jobOrder) {
        return res.status(404).json({
            success: false,
            message: `Job order not found with ID: ${joId}`,
        });
    }

    // 3. Find the product in the products array
    const product = jobOrder.products.find(p => p.product.toString() === prId);
    if (!product) {
        return res.status(404).json({
            success: false,
            message: `Product not found with ID: ${prId} in job order ${joId}`,
        });
    }

    // 4. Format the response
    const formattedResponse = {
        //   workOrderNumber: jobOrder.work_order_number,
        //   clientName: jobOrder.client_id?.name || 'N/A',
        //   projectName: jobOrder.project_id?.name || 'N/A',

        code: product.code,
        colorCode: product.color_code,
        height: product.height,
        width: product.width,

        //   productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
        //   productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
    };

    // 5. Send response
    return res.status(200).json({
        success: true,
        message: 'Job order product details fetched successfully',
        data: formattedResponse,
    });
});


const getJobOrderTotalProductDetail_22_07_2025 = asyncHandler(async (req, res) => {
    console.log("came here ...");
    const { joId } = req.query;

    // Validate inputs
    if (!joId) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID (joId)  required in query parameters',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(joId)) {
        return res.status(400).json({
            success: false,
            message: `Invalid job Order ID: ${joId}`,
        });
    }

    const jobOrder = await falconJobOrder
        .findOne({ _id: joId })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .lean();
    console.log("jobOrder111", jobOrder);

    // Check if job order exists
    if (!jobOrder) {
        return res.status(404).json({
            success: false,
            message: `Job order not found with ID: ${joId}`,
        });
    }


    // 4. Format the response
    const formattedResponse = {
        products: jobOrder.products
            .filter(product => product.product) // Filter out products where the referenced product is null (e.g., deleted)
            .map(product => ({
                product: product.product._id.toString(),
                productName: product.product.name,
                poQuantity: product.po_quantity,
                code: product.code,
                colorCode: product.color_code,
                height: product.height,
                width: product.width,
            })),
    };

    // 5. Send response
    return res.status(200).json({
        success: true,
        message: 'Job order product details fetched successfully',
        data: formattedResponse,
    });
});




const getJobOrderTotalProductDetail = asyncHandler(async (req, res) => {
    console.log("came here ...");
    const { joId } = req.query;

    // Validate inputs
    if (!joId) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID (joId) required in query parameters',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(joId)) {
        return res.status(400).json({
            success: false,
            message: `Invalid job Order ID: ${joId}`,
        });
    }

    // Fetch job order with populated product details
    const jobOrder = await falconJobOrder
        .findOne({ _id: joId })
        .populate({
            path: 'products.product',
            select: 'name',
            match: { isDeleted: false },
        })
        .lean();
    console.log("jobOrder111", jobOrder);

    // Check if job order exists
    if (!jobOrder) {
        return res.status(404).json({
            success: false,
            message: `Job order not found with ID: ${joId}`,
        });
    }

    // Fetch existing internal work orders for this job order
    const existingIWOs = await falconInternalWorkOrder.find({ job_order_id: joId }).lean();
    const allocatedQuantities = {};
    existingIWOs.forEach((iwo) => {
        iwo.products.forEach((prod) => {
            const key = `${prod.product.toString()}-${prod.code}`;
            allocatedQuantities[key] = (allocatedQuantities[key] || 0) + prod.po_quantity;
        });
    });

    // Format the response
    const formattedResponse = {
        products: jobOrder.products
            .filter(product => product.product) // Filter out products where the referenced product is null (e.g., deleted)
            .map(product => ({
                product: product.product._id.toString(),
                productName: product.product.name,
                poQuantity: product.po_quantity,
                code: product.code,
                colorCode: product.color_code,
                height: product.height,
                width: product.width,
                remainingQuantity: product.po_quantity - (allocatedQuantities[`${product.product._id.toString()}-${product.code}`] || 0),
            })),
    };

    // Send response
    return res.status(200).json({
        success: true,
        message: 'Job order product details fetched successfully',
        data: formattedResponse,
    });
});





const getProductSystem = asyncHandler(async (req, res) => {
    const { systemId } = req.query;

    // Validate inputs
    if (!systemId) {
        return res.status(400).json({
            success: false,
            message: 'System ID required in query parameters',
        });
    }

    if (!mongoose.Types.ObjectId.isValid(systemId)) {
        return res.status(400).json({
            success: false,
            message: `Invalid system ID: ${systemId}`,
        });
    }

    // Fetch product systems with populated system field
    const productSystems = await falconProductSystem
        .find({ system: systemId, isDeleted: false })
        .populate({
            path: 'system',
            select: 'name',
            match: { isDeleted: false, status: 'Active' },
        })
        .lean();


    // Check if any product systems exist and have a valid (populated) system
    const validProductSystems = productSystems.filter(ps => ps.system); // Filter out entries where system didn't match criteria
    if (!validProductSystems.length) {
        return res.status(404).json({
            success: false,
            message: `No active product systems found for system ID: ${systemId}`,
        });
    }

    // Format the response
    const formattedResponse = validProductSystems.map(ps => ({
        productSystemId: ps._id,
        name: ps.name,
        systemId: ps.system._id.toString(),
        systemName: ps.system.name,
        status: ps.status,
        createdAt: formatDateOnly(ps.createdAt),
    }));

    // Send response
    return res.status(200).json({
        success: true,
        message: 'Product systems fetched successfully',
        data: formattedResponse,
    });
});




const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

// Helper function to parse and validate date strings
const parseDate = (dateString, fieldName) => {
    if (!dateString) {
        throw new Error(`${fieldName} is required`);
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format for ${fieldName}: ${dateString}. Expected format: YYYY-MM-DD`);
    }
    return date;
};

// Helper function to validate ObjectId
const validateObjectId = (id, fieldName) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ${fieldName}: ${id}`);
    }
    return id;
};

// API to create an internal work order with nested files
//Ws working fine - 
const createInternalWorkOrder1 = asyncHandler(async (req, res) => {
    // 1. Validate job_order_id
    const { job_order_id } = req.body;
    if (!job_order_id) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }

    // 2. Parse the form-data body
    const bodyData = req.body;
    console.log("bodyData", bodyData);

    // Debug: Log date fields to confirm their structure
    console.log("date[from]:", bodyData['date[from]']);
    console.log("date[to]:", bodyData['date[to]']);
    console.log("bodyData.date:", bodyData.date);

    // Parse stringified fields if needed (e.g., products)
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new Error('Invalid products JSON format');
        }
    }

    // 3. Validate required top-level fields
    if (!bodyData.sales_order_no) {
        throw new Error('Sales order number is required');
    }


    // 4. Extract and validate date fields
    let dateFrom, dateTo;
    if (bodyData.date && bodyData.date.from && bodyData.date.to) {
        // If date is parsed as an object (e.g., bodyData.date = { from: '...', to: '...' })
        dateFrom = bodyData.date.from;
        dateTo = bodyData.date.to;
    } else if (bodyData['date[from]'] && bodyData['date[to]']) {
        // If date is sent as separate form-data keys
        dateFrom = bodyData['date[from]'];
        dateTo = bodyData['date[to]'];
    } else {
        throw new Error('Date range (from and to) is required');
    }

    // 5. Parse and validate dates
    const parsedDateFrom = parseDate(dateFrom, 'date.from');
    const parsedDateTo = parseDate(dateTo, 'date.to');

    // 6. Map files to their respective fields
    const filesMap = {};
    req.files.forEach(file => {
        const fieldName = file.fieldname; // e.g., products[0][semifinished_details][0][file]
        filesMap[fieldName] = file;
    });


    // bodyData.products.map((product) => { console.log("product", product) });

    // bodyData.products.forEach(product => {

    //     product.semifinished_details.forEach(semifinished => {
    //         console.log(`Semifinished ID: ${semifinished.semifinished_id}`);
    //         console.log("process", semifinished.processes);
    //     });
    // });
    // 7. Construct the job order data
    const jobOrderData = {
        job_order_id: bodyData.job_order_id,
        sales_order_no: bodyData.sales_order_no,
        date: {
            from: parsedDateFrom,
            to: parsedDateTo,
        },
        products: await Promise.all(bodyData.products.map(async (product, productIndex) => {
            // Validate product fields
            if (!product.product) throw new Error(`Product ID is required for product at index ${productIndex}`);
            if (!product.system) throw new Error(`System is required for product at index ${productIndex}`);
            if (!product.product_system) throw new Error(`Product system is required for product at index ${productIndex}`);
            if (!product.po_quantity) throw new Error(`PO quantity is required for product at index ${productIndex}`);


            // Validate ObjectId for product, system, and product_system
            validateObjectId(product.product, `product at index ${productIndex}`);
            validateObjectId(product.system, `system at index ${productIndex}`);
            validateObjectId(product.product_system, `product_system at index ${productIndex}`);

            return {
                product: product.product,
                system: product.system,
                product_system: product.product_system,
                po_quantity: parseInt(product.po_quantity),

                semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                    // Validate semifinished detail fields
                    if (!sfDetail.semifinished_id) throw new Error(`Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);
                    if (!sfDetail.remarks) throw new Error(`Remarks is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                    // Validate ObjectId for semifinished_id
                    // validateObjectId(sfDetail.semifinished_id, `semifinished_id at index ${sfIndex} in product ${productIndex}`);

                    const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                    const sfFile = filesMap[sfFileField];

                    if (!sfFile) {
                        throw new Error(`File missing for semifinished_details at index ${sfIndex} in product ${productIndex}`);
                    }

                    // Prepare file for S3 upload
                    const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                    const sfFileData = {
                        data: fs.readFileSync(sfFile.path), // Read file buffer
                        mimetype: sfFile.mimetype,
                    };
                    const sfUploadResult = await putObject(sfFileData, sfFileName);

                    return {
                        semifinished_id: sfDetail.semifinished_id,
                        file_url: sfUploadResult.url, // S3 URL
                        remarks: sfDetail.remarks,
                        processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                            // Validate process fields
                            if (!process.name) throw new Error(`Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);
                            if (!process.remarks) throw new Error(`Process remarks is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                            const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                            const processFile = filesMap[processFileField];

                            if (!processFile) {
                                throw new Error(`File missing for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);
                            }

                            // Prepare file for S3 upload
                            const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                            const processFileData = {
                                data: fs.readFileSync(processFile.path), // Read file buffer
                                mimetype: processFile.mimetype,
                            };
                            const processUploadResult = await putObject(processFileData, processFileName);

                            return {
                                name: process.name,
                                file_url: processUploadResult.url, // S3 URL
                                remarks: process.remarks,
                            };
                        })),
                    };
                })),
            };
        })),
    };

    // 8. Save to MongoDB

    try {
        const jobOrder = await falconInternalWorkOrder.create(jobOrderData);
        return res.status(201).json({
            success: true,
            message: 'Internal Work order created successfully',
            data: jobOrder,
        });
    } catch (error) {
        // Multer handles temp file cleanup automatically
        console.log("error", error);
        return res.status(500).json({
            success: false,
            message: `Error creating job order: ${error.message}`,
        });
    }
});


const createInternalWorkOrder_16_07_25 = asyncHandler(async (req, res) => {
    // 1. Validate job_order_id
    const { job_order_id } = req.body;
    console.log("job_order_id", job_order_id);
    if (!job_order_id) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }
    // console.log("hiiiiii there");

    // 2. Validate job_order_id exists in falconJobOrder and is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(job_order_id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid job_order_id format',
        });
    }
    const jobOrder = await falconJobOrder.findById(job_order_id);
    if (!jobOrder) {
        return res.status(400).json({
            success: false,
            message: 'Job order not found',
        });
    }

    // 3. Parse the form-data body
    const bodyData = req.body;

    // Debug: Log date fields to confirm their structure
    console.log("date[from]:", bodyData['date[from]']);
    console.log("date[to]:", bodyData['date[to]']);
    console.log("bodyData.date:", bodyData.date);

    // Parse stringified fields if needed (e.g., products)
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new Error('Invalid products JSON format');
        }
    }

    // 4. Validate required top-level fields
    if (!bodyData.sales_order_no) {
        throw new Error('Sales order number is required');
    }

    // 5. Extract and validate date fields
    let dateFrom, dateTo;
    if (bodyData.date && bodyData.date.from && bodyData.date.to) {
        dateFrom = bodyData.date.from;
        dateTo = bodyData.date.to;
    } else if (bodyData['date[from]'] && bodyData['date[to]']) {
        dateFrom = bodyData['date[from]'];
        dateTo = bodyData['date[to]'];
    } else {
        throw new Error('Date range (from and to) is required');
    }

    // 6. Parse and validate dates
    const parsedDateFrom = parseDate(dateFrom, 'date.from');
    const parsedDateTo = parseDate(dateTo, 'date.to');

    // 7. Map files to their respective fields
    const filesMap = {};
    req.files.forEach(file => {
        const fieldName = file.fieldname;
        filesMap[fieldName] = file;
    });

    // 8. Construct the internal work order data
    const jobOrderData = {
        job_order_id: bodyData.job_order_id,
        sales_order_no: bodyData.sales_order_no,
        date: {
            from: parsedDateFrom,
            to: parsedDateTo,
        },
        products: await Promise.all(bodyData.products.map(async (product, productIndex) => {
            // Validate product fields
            if (!product.product) throw new Error(`Product ID is required for product at index ${productIndex}`);
            if (!product.system) throw new Error(`System is required for product at index ${productIndex}`);
            if (!product.product_system) throw new Error(`Product system is required for product at index ${productIndex}`);
            if (!product.po_quantity) throw new Error(`PO quantity is required for product at index ${productIndex}`);

            // Validate ObjectId for product, system, and product_system
            validateObjectId(product.product, `product at index ${productIndex}`);
            validateObjectId(product.system, `system at index ${productIndex}`);
            validateObjectId(product.product_system, `product_system at index ${productIndex}`);

            return {
                product: product.product,
                system: product.system,
                product_system: product.product_system,
                po_quantity: parseInt(product.po_quantity),
                semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                    console.log("sfDetail", sfDetail);
                    // Validate semifinished detail fields
                    if (!sfDetail.semifinished_id) throw new Error(`Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);
                    if (!sfDetail.remarks) throw new Error(`Remarks is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                    const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                    console.log("sfFileField", sfFileField);
                    const sfFile = filesMap[sfFileField];
                    console.log("sfFile", sfFile);


                    if (!sfFile) {
                        throw new Error(`File missing for semifinished_details at index ${sfIndex} in product ${productIndex}`);
                    }

                    // Prepare file for S3 upload
                    const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                    const sfFileData = {
                        data: fs.readFileSync(sfFile.path),
                        mimetype: sfFile.mimetype,
                    };
                    const sfUploadResult = await putObject(sfFileData, sfFileName);

                    return {
                        semifinished_id: sfDetail.semifinished_id,
                        file_url: sfUploadResult.url,
                        remarks: sfDetail.remarks,
                        processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                            // Validate process fields
                            if (!process.name) throw new Error(`Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);
                            if (!process.remarks) throw new Error(`Process remarks is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                            const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                            const processFile = filesMap[processFileField];

                            if (!processFile) {
                                throw new Error(`File missing for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);
                            }

                            // Prepare file for S3 upload
                            const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                            const processFileData = {
                                data: fs.readFileSync(processFile.path),
                                mimetype: processFile.mimetype,
                            };
                            const processUploadResult = await putObject(processFileData, processFileName);
                            console.log("process", process);

                            return {
                                name: process.name,
                                file_url: processUploadResult.url,
                                remarks: process.remarks,
                            };
                        })),
                    };
                })),
            };
        })),
    };

    // 9. Save internal work order to MongoDB
    let internalWorkOrder;
    try {
        internalWorkOrder = await falconInternalWorkOrder.create(jobOrderData);
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({
            success: false,
            message: `Error creating internal work order: ${error.message}`,
        });
    }

    // 10. Construct and save falconProduction documents (one per semifinished_id)
    try {
        const productionDocs = [];
        for (const product of jobOrderData.products) {
            for (const sfDetail of product.semifinished_details) {
                // Create a separate document for each process in the processes array
                for (const process of sfDetail.processes) {
                    const productionData = {
                        job_order: job_order_id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            po_quantity: product.po_quantity,
                            achieved_quantity: 0,
                            rejected_quantity: 0,
                            recycled_quantity: 0,
                        },
                        process_name: process.name.toLowerCase(), // Store a single process name
                        date: parsedDateFrom,
                        status: 'Pending',
                        created_by: req.user?._id || null,
                        updated_by: req.user?._id || null,
                    };
                    productionDocs.push(productionData);
                }
            }
        }

        // Create all falconProduction documents
        const productions = await falconProduction.insertMany(productionDocs);
        console.log('Production documents created:', productions);
    } catch (error) {
        console.log('Error creating production documents:', error);
        // Rollback internal work order creation
        await falconInternalWorkOrder.deleteOne({ _id: internalWorkOrder._id });
        return res.status(500).json({
            success: false,
            message: `Error creating production documents: ${error.message}`,
        });
    }

    // 11. Return success response
    return res.status(201).json({
        success: true,
        message: 'Internal Work order and Production documents created successfully',
        data: internalWorkOrder,
    });
});

//////UPDATED ON 16-07-2025 ---



const createInternalWorkOrder_21_07_25 = asyncHandler(async (req, res) => {
    // 1. Validate job_order_id
    const { job_order_id } = req.body;
    console.log("job_order_id", job_order_id);
    if (!job_order_id) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }

    // 2. Validate job_order_id exists in falconJobOrder and is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(job_order_id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid job_order_id format',
        });
    }
    const jobOrder = await falconJobOrder.findById(job_order_id);
    if (!jobOrder) {
        return res.status(400).json({
            success: false,
            message: 'Job order not found',
        });
    }

    // 3. Parse the form-data body
    const bodyData = req.body;

    // Debug: Log date fields to confirm their structure
    console.log("date[from]:", bodyData['date[from]']);
    console.log("date[to]:", bodyData['date[to]']);
    console.log("bodyData.date:", bodyData.date);

    // Parse stringified fields if needed (e.g., products)
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 4. Extract and validate date fields
    let dateFrom, dateTo;
    if (bodyData.date && bodyData.date.from && bodyData.date.to) {
        dateFrom = bodyData.date.from;
        dateTo = bodyData.date.to;
    } else if (bodyData['date[from]'] && bodyData['date[to]']) {
        dateFrom = bodyData['date[from]'];
        dateTo = bodyData['date[to]'];
    } else {
        throw new ApiError(400, 'Date range (from and to) is required');
    }

    // 5. Parse and validate dates
    const parsedDateFrom = parseDate(dateFrom, 'date.from');
    const parsedDateTo = parseDate(dateTo, 'date.to');

    // 6. Map files to their respective fields
    const filesMap = {};
    if (req.files) {
        req.files.forEach(file => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });
    }





    // 7. Construct the internal work order data
    const jobOrderData = {
        job_order_id: bodyData.job_order_id,
        sales_order_no: bodyData.sales_order_no || undefined, // Optional
        date: {
            from: parsedDateFrom,
            to: parsedDateTo,
        },
        products: await Promise.all(bodyData.products.map(async (product, productIndex) => {
            // Validate product fields
            if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
            if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
            if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
            if (!product.po_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);

            // Validate ObjectId for product, system, and product_system
            validateObjectId(product.product, `product at index ${productIndex}`);
            validateObjectId(product.system, `system at index ${productIndex}`);
            validateObjectId(product.product_system, `product_system at index ${productIndex}`);

            return {
                product: product.product,
                system: product.system,
                product_system: product.product_system,
                po_quantity: parseInt(product.po_quantity),
                semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                    console.log("sfDetail", sfDetail);
                    // Validate semifinished detail fields
                    if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                    const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                    const sfFile = filesMap[sfFileField];
                    let sfFileUrl = undefined;
                    if (sfFile) {
                        const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                        const sfFileData = {
                            data: fs.readFileSync(sfFile.path),
                            mimetype: sfFile.mimetype,
                        };
                        const sfUploadResult = await putObject(sfFileData, sfFileName);
                        sfFileUrl = sfUploadResult.url;
                    }
                    console.log("sfDetail.processes", sfDetail.processes);
                    if (!sfDetail.processes || sfDetail.processes === undefined) {
                        return res.status(400).json({ success: false, message: "Please provide process!" });
                    }

                    return {
                        semifinished_id: sfDetail.semifinished_id,
                        file_url: sfFileUrl,
                        remarks: sfDetail.remarks || undefined,
                        processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                            // Validate process fields
                            if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                            const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                            const processFile = filesMap[processFileField];
                            let processFileUrl = undefined;
                            if (processFile) {
                                const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                const processFileData = {
                                    data: fs.readFileSync(processFile.path),
                                    mimetype: processFile.mimetype,
                                };
                                const processUploadResult = await putObject(processFileData, processFileName);
                                processFileUrl = processUploadResult.url;
                            }

                            return {
                                name: process.name,
                                file_url: processFileUrl,
                                remarks: process.remarks || undefined,
                            };
                        })),
                    };
                })),
            };
        })),
    };

    // 8. Save internal work order to MongoDB
    let internalWorkOrder;
    try {
        internalWorkOrder = await falconInternalWorkOrder.create(jobOrderData);
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({
            success: false,
            message: `Error creating internal work order: ${error.message}`,
        });
    }

    // 9. Construct and save falconProduction documents (one per semifinished_id)
    try {
        const productionDocs = [];
        for (const product of jobOrderData.products) {
            for (const sfDetail of product.semifinished_details) {
                // Create a separate document for each process in the processes array
                for (const process of sfDetail.processes) {
                    const productionData = {
                        job_order: job_order_id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            po_quantity: product.po_quantity,
                            achieved_quantity: 0,
                            rejected_quantity: 0,
                            recycled_quantity: 0,
                        },
                        process_name: process.name.toLowerCase(), // Store a single process name
                        date: parsedDateFrom,
                        status: 'Pending',
                        created_by: req.user?._id || null,
                        updated_by: req.user?._id || null,
                    };
                    productionDocs.push(productionData);
                }
            }
        }

        // Create all falconProduction documents
        const productions = await falconProduction.insertMany(productionDocs);
        console.log('Production documents created:', productions);
    } catch (error) {
        console.log('Error creating production documents:', error);
        // Rollback internal work order creation
        await falconInternalWorkOrder.deleteOne({ _id: internalWorkOrder._id });
        return res.status(500).json({
            success: false,
            message: `Error creating production documents: ${error.message}`,
        });
    }

    // 10. Return success response
    return res.status(201).json({
        success: true,
        message: 'Internal Work order and Production documents created successfully',
        data: internalWorkOrder,
    });
});

const createInternalWorkOrder22_07_2025_8AM = asyncHandler(async (req, res) => {
    // 1. Validate job_order_id
    const { job_order_id } = req.body;
    if (!job_order_id) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }

    // 2. Validate job_order_id exists and is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(job_order_id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid job_order_id format',
        });
    }
    const jobOrder = await falconJobOrder.findById(job_order_id).populate('products.product');
    if (!jobOrder) {
        return res.status(400).json({
            success: false,
            message: 'Job order not found',
        });
    }

    // 3. Parse the form-data body
    const bodyData = req.body;
    console.log("bodyData", bodyData);
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 4. Extract and validate date fields
    let dateFrom, dateTo;
    if (bodyData.date && bodyData.date.from && bodyData.date.to) {
        dateFrom = bodyData.date.from;
        dateTo = bodyData.date.to;
    } else if (bodyData['date[from]'] && bodyData['date[to]']) {
        dateFrom = bodyData['date[from]'];
        dateTo = bodyData['date[to]'];
    } else {
        throw new ApiError(400, 'Date range (from and to) is required');
    }
    const parsedDateFrom = parseDate(dateFrom, 'date.from');
    const parsedDateTo = parseDate(dateTo, 'date.to');

    // 5. Validate product quantities against job order
    const productQuantitiesInJobOrder = {};
    jobOrder.products.forEach((prod) => {
        productQuantitiesInJobOrder[prod.product._id.toString()] = prod.po_quantity;
    });
    console.log("productQuantitiesInJobOrder", productQuantitiesInJobOrder);

    // Fetch all existing internal work orders for this job_order_id
    const existingIWOs = await falconInternalWorkOrder.find({ job_order_id }).lean();
    console.log("existingIWOs", existingIWOs);
    const allocatedQuantities = {};

    // Calculate total allocated quantities for each product
    existingIWOs.forEach((iwo) => {
        iwo.products.forEach((prod) => {
            console.log("prod", prod);
            const productId = prod.product.toString();
            allocatedQuantities[productId] = (allocatedQuantities[productId] || 0) + prod.po_quantity;
        });
    });
    console.log("allocatedQuantities", allocatedQuantities);

    // Validate requested quantities in the new IWO
    for (const product of bodyData.products) {
        const productId = product.product;
        if (!productQuantitiesInJobOrder[productId]) {
            throw new ApiError(400, `Product ${productId} is not part of the job order`);
        }
        const requestedQty = parseInt(product.po_quantity);
        const allocatedQty = allocatedQuantities[productId] || 0;
        const maxAllowedQty = productQuantitiesInJobOrder[productId];
        console.log("maxAllowedQty", maxAllowedQty);

        if (allocatedQty + requestedQty > maxAllowedQty) {
            throw new ApiError(
                400,
                `Requested quantity (${requestedQty}) for product ${productId} exceeds remaining quantity. ` +
                `Already allocated: ${allocatedQty}, Max allowed: ${maxAllowedQty}, Remaining: ${maxAllowedQty - allocatedQty}`
            );
        }
    }

    // 6. Map files to their respective fields
    const filesMap = {};
    if (req.files) {
        req.files.forEach((file) => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });
    }

    // 7. Construct the internal work order data
    const jobOrderData = {
        job_order_id: bodyData.job_order_id,
        sales_order_no: bodyData.sales_order_no || undefined,
        date: {
            from: parsedDateFrom,
            to: parsedDateTo,
        },
        products: await Promise.all(
            bodyData.products.map(async (product, productIndex) => {
                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);
                return {
                    product: product.product,
                    system: product.system,
                    product_system: product.product_system,
                    po_quantity: parseInt(product.po_quantity),
                    semifinished_details: await Promise.all(
                        product.semifinished_details.map(async (sfDetail, sfIndex) => {
                            if (!sfDetail.semifinished_id) {
                                throw new ApiError(
                                    400,
                                    `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                );
                            }
                            const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                            const sfFile = filesMap[sfFileField];
                            let sfFileUrl = undefined;
                            if (sfFile) {
                                const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(
                                    sfFile.originalname
                                )}`;
                                const sfFileData = {
                                    data: fs.readFileSync(sfFile.path),
                                    mimetype: sfFile.mimetype,
                                };
                                const sfUploadResult = await putObject(sfFileData, sfFileName);
                                sfFileUrl = sfUploadResult.url;
                            }
                            if (!sfDetail.processes || sfDetail.processes.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Processes are required for semifinished_details at index ${sfIndex} in product ${productIndex}`,
                                });
                            }
                            return {
                                semifinished_id: sfDetail.semifinished_id,
                                file_url: sfFileUrl,
                                remarks: sfDetail.remarks || undefined,
                                processes: await Promise.all(
                                    sfDetail.processes.map(async (process, processIndex) => {
                                        if (!process.name) {
                                            throw new ApiError(
                                                400,
                                                `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`
                                            );
                                        }
                                        const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                        const processFile = filesMap[processFileField];
                                        let processFileUrl = undefined;
                                        if (processFile) {
                                            const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(
                                                processFile.originalname
                                            )}`;
                                            const processFileData = {
                                                data: fs.readFileSync(processFile.path),
                                                mimetype: processFile.mimetype,
                                            };
                                            const processUploadResult = await putObject(
                                                processFileData,
                                                processFileName
                                            );
                                            processFileUrl = processUploadResult.url;
                                        }
                                        return {
                                            name: process.name,
                                            file_url: processFileUrl,
                                            remarks: process.remarks || undefined,
                                        };
                                    })
                                ),
                            };
                        })
                    ),
                };
            })
        ),
    };

    // 8. Save internal work order to MongoDB
    let internalWorkOrder;
    try {
        internalWorkOrder = await falconInternalWorkOrder.create(jobOrderData);
    } catch (error) {
        console.log('error', error);
        return res.status(500).json({
            success: false,
            message: `Error creating internal work order: ${error.message}`,
        });
    }

    // 9. Construct and save falconProduction documents
    try {
        const productionDocs = [];
        for (const product of jobOrderData.products) {
            console.log("product***", product);
            for (const sfDetail of product.semifinished_details) {
                for (const process of sfDetail.processes) {
                    const productionData = {
                        job_order: job_order_id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code, // Include code
                            width: product.width ? parseFloat(product.width) : undefined, // Include width (optional)
                            height: product.height ? parseFloat(product.height) : undefined, // Include height (optional)
                            po_quantity: product.po_quantity,
                            achieved_quantity: 0,
                            rejected_quantity: 0,
                            recycled_quantity: 0,
                        },
                        process_name: process.name.toLowerCase(),
                        date: parsedDateFrom,
                        status: 'Pending',
                        created_by: req.user?._id || null,
                        updated_by: req.user?._id || null,
                    };
                    productionDocs.push(productionData);
                }
            }
        }
        const productions = await falconProduction.insertMany(productionDocs);
        console.log('Production documents created:', productions);
    } catch (error) {
        console.log('Error creating production documents:', error);
        await falconInternalWorkOrder.deleteOne({ _id: internalWorkOrder._id });
        return res.status(500).json({
            success: false,
            message: `Error creating production documents: ${error.message}`,
        });
    }

    // 10. Return success response
    return res.status(201).json({
        success: true,
        message: 'Internal Work order and Production documents created successfully',
        data: internalWorkOrder,
    });
});

const createInternalWorkOrder_22_07_2025_11AM = asyncHandler(async (req, res) => {
    // 1. Validate job_order_id
    const { job_order_id } = req.body;
    if (!job_order_id) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }

    // 2. Validate job_order_id exists and is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(job_order_id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid job_order_id format',
        });
    }
    const jobOrder = await falconJobOrder.findById(job_order_id).populate('products.product');
    if (!jobOrder) {
        return res.status(400).json({
            success: false,
            message: 'Job order not found',
        });
    }

    // 3. Parse the form-data body
    const bodyData = req.body;
    console.log("bodyData", bodyData);
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 4. Extract and validate date fields
    let dateFrom, dateTo;
    if (bodyData.date && bodyData.date.from && bodyData.date.to) {
        dateFrom = bodyData.date.from;
        dateTo = bodyData.date.to;
    } else if (bodyData['date[from]'] && bodyData['date[to]']) {
        dateFrom = bodyData['date[from]'];
        dateTo = bodyData['date[to]'];
    } else {
        throw new ApiError(400, 'Date range (from and to) is required');
    }
    const parsedDateFrom = parseDate(dateFrom, 'date.from');
    const parsedDateTo = parseDate(dateTo, 'date.to');

    // 5. Validate product quantities against job order
    const productQuantitiesInJobOrder = {};
    jobOrder.products.forEach((prod) => {
        productQuantitiesInJobOrder[prod.product._id.toString()] = prod.po_quantity;
    });
    console.log("productQuantitiesInJobOrder", productQuantitiesInJobOrder);

    // Fetch all existing internal work orders for this job_order_id
    const existingIWOs = await falconInternalWorkOrder.find({ job_order_id }).lean();
    console.log("existingIWOs", existingIWOs);
    const allocatedQuantities = {};

    // Calculate total allocated quantities for each product
    existingIWOs.forEach((iwo) => {
        iwo.products.forEach((prod) => {
            console.log("prod", prod);
            const productId = prod.product.toString();
            allocatedQuantities[productId] = (allocatedQuantities[productId] || 0) + prod.po_quantity;
        });
    });
    console.log("allocatedQuantities", allocatedQuantities);

    // Validate requested quantities in the new IWO
    // for (const product of bodyData.products) {
    //   const productId = product.product;
    //   if (!productQuantitiesInJobOrder[productId]) {
    //     throw new ApiError(400, `Product ${productId} is not part of the job order`);
    //   }
    //   const requestedQty = parseInt(product.po_quantity);
    //   const allocatedQty = allocatedQuantities[productId] || 0;
    //   const maxAllowedQty = productQuantitiesInJobOrder[productId];
    //   console.log("maxAllowedQty", maxAllowedQty);

    //   if (allocatedQty + requestedQty > maxAllowedQty) {
    //     throw new ApiError(
    //       400,
    //       `Requested quantity (${requestedQty}) for product ${productId} exceeds remaining quantity. ` +
    //       `Already allocated: ${allocatedQty}, Max allowed: ${maxAllowedQty}, Remaining: ${maxAllowedQty - allocatedQty}`
    //     );
    //   }
    // }

    // 6. Map files to their respective fields
    const filesMap = {};
    if (req.files) {
        req.files.forEach((file) => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });
    }

    // 7. Construct the internal work order data
    const jobOrderData = {
        job_order_id: bodyData.job_order_id,
        sales_order_no: bodyData.sales_order_no || undefined,
        date: {
            from: parsedDateFrom,
            to: parsedDateTo,
        },
        products: await Promise.all(
            bodyData.products.map(async (product, productIndex) => {
                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);
                return {
                    product: product.product,
                    code: product.code, // Include code
                    width: product.width ? parseFloat(product.width) : undefined, // Include width (optional)
                    height: product.height ? parseFloat(product.height) : undefined, // Include height (optional)
                    system: product.system,
                    product_system: product.product_system,
                    po_quantity: parseInt(product.po_quantity),
                    semifinished_details: await Promise.all(
                        product.semifinished_details.map(async (sfDetail, sfIndex) => {
                            if (!sfDetail.semifinished_id) {
                                throw new ApiError(
                                    400,
                                    `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                );
                            }
                            const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                            const sfFile = filesMap[sfFileField];
                            let sfFileUrl = undefined;
                            if (sfFile) {
                                const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(
                                    sfFile.originalname
                                )}`;
                                const sfFileData = {
                                    data: fs.readFileSync(sfFile.path),
                                    mimetype: sfFile.mimetype,
                                };
                                const sfUploadResult = await putObject(sfFileData, sfFileName);
                                sfFileUrl = sfUploadResult.url;
                            }
                            if (!sfDetail.processes || sfDetail.processes.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Processes are required for semifinished_details at index ${sfIndex} in product ${productIndex}`,
                                });
                            }
                            return {
                                semifinished_id: sfDetail.semifinished_id,
                                file_url: sfFileUrl,
                                remarks: sfDetail.remarks || undefined,
                                processes: await Promise.all(
                                    sfDetail.processes.map(async (process, processIndex) => {
                                        if (!process.name) {
                                            throw new ApiError(
                                                400,
                                                `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`
                                            );
                                        }
                                        const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                        const processFile = filesMap[processFileField];
                                        let processFileUrl = undefined;
                                        if (processFile) {
                                            const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(
                                                processFile.originalname
                                            )}`;
                                            const processFileData = {
                                                data: fs.readFileSync(processFile.path),
                                                mimetype: processFile.mimetype,
                                            };
                                            const processUploadResult = await putObject(
                                                processFileData,
                                                processFileName
                                            );
                                            processFileUrl = processUploadResult.url;
                                        }
                                        return {
                                            name: process.name,
                                            file_url: processFileUrl,
                                            remarks: process.remarks || undefined,
                                        };
                                    })
                                ),
                            };
                        })
                    ),
                };
            })
        ),
    };

    // 8. Save internal work order to MongoDB
    let internalWorkOrder;
    try {
        internalWorkOrder = await falconInternalWorkOrder.create(jobOrderData);
    } catch (error) {
        console.log('error', error);
        return res.status(500).json({
            success: false,
            message: `Error creating internal work order: ${error.message}`,
        });
    }

    // 9. Construct and save falconProduction documents
    try {
        const productionDocs = [];
        for (const product of jobOrderData.products) {
            console.log("product***", product);
            for (const sfDetail of product.semifinished_details) {
                for (const process of sfDetail.processes) {
                    const productionData = {
                        job_order: job_order_id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code, // Include code
                            width: product.width ? parseFloat(product.width) : undefined, // Include width (optional)
                            height: product.height ? parseFloat(product.height) : undefined, // Include height (optional)
                            po_quantity: product.po_quantity,
                            achieved_quantity: 0,
                            rejected_quantity: 0,
                            recycled_quantity: 0,
                        },
                        process_name: process.name.toLowerCase(),
                        date: parsedDateFrom,
                        status: 'Pending',
                        created_by: req.user?._id || null,
                        updated_by: req.user?._id || null,
                    };
                    productionDocs.push(productionData);
                }
            }
        }
        const productions = await falconProduction.insertMany(productionDocs);
        console.log('Production documents created:', productions);
    } catch (error) {
        console.log('Error creating production documents:', error);
        await falconInternalWorkOrder.deleteOne({ _id: internalWorkOrder._id });
        return res.status(500).json({
            success: false,
            message: `Error creating production documents: ${error.message}`,
        });
    }

    // 10. Return success response
    return res.status(201).json({
        success: true,
        message: 'Internal Work order and Production documents created successfully',
        data: internalWorkOrder,
    });
});






const createInternalWorkOrder_22_07_2025_11PM = asyncHandler(async (req, res) => {
    // 1. Validate job_order_id
    const { job_order_id } = req.body;
    if (!job_order_id) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }

    // 2. Validate job_order_id exists and is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(job_order_id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid job_order_id format',
        });
    }
    const jobOrder = await falconJobOrder.findById(job_order_id).populate('products.product');
    if (!jobOrder) {
        return res.status(400).json({
            success: false,
            message: 'Job order not found',
        });
    }

    // 3. Parse the form-data body
    const bodyData = req.body;
    console.log("bodyData", bodyData);
    if (typeof bodyData.products === 'string') {
        try {
            bodyData.products = JSON.parse(bodyData.products);
        } catch (err) {
            throw new ApiError(400, 'Invalid products JSON format');
        }
    }

    // 4. Extract and validate date fields
    let dateFrom, dateTo;
    if (bodyData.date && bodyData.date.from && bodyData.date.to) {
        dateFrom = bodyData.date.from;
        dateTo = bodyData.date.to;
    } else if (bodyData['date[from]'] && bodyData['date[to]']) {
        dateFrom = bodyData['date[from]'];
        dateTo = bodyData['date[to]'];
    } else {
        throw new ApiError(400, 'Date range (from and to) is required');
    }
    const parsedDateFrom = parseDate(dateFrom, 'date.from');
    const parsedDateTo = parseDate(dateTo, 'date.to');

    // 5. Validate product quantities against job order
    const productQuantitiesInJobOrder = {};
    jobOrder.products.forEach((prod) => {
        const key = `${prod.product._id.toString()}-${prod.code}`;
        productQuantitiesInJobOrder[key] = prod.po_quantity;
    });
    console.log("productQuantitiesInJobOrder", productQuantitiesInJobOrder);

    // Fetch all existing internal work orders for this job_order_id
    const existingIWOs = await falconInternalWorkOrder.find({ job_order_id }).lean();
    console.log("existingIWOs", existingIWOs);
    const allocatedQuantities = {};

    // Calculate total allocated quantities for each product and code combination
    existingIWOs.forEach((iwo) => {
        iwo.products.forEach((prod) => {
            const key = `${prod.product.toString()}-${prod.code}`;
            allocatedQuantities[key] = (allocatedQuantities[key] || 0) + prod.po_quantity;
        });
    });
    console.log("allocatedQuantities", allocatedQuantities);

    // Validate requested quantities in the new IWO
    for (const product of bodyData.products) {
        const productId = product.product;
        const productCode = product.code;
        const key = `${productId}-${productCode}`;
        if (!productQuantitiesInJobOrder[key]) {
            throw new ApiError(400, `Product ${productId} with code ${productCode} is not part of the job order`);
        }
        const requestedQty = parseInt(product.po_quantity);
        const allocatedQty = allocatedQuantities[key] || 0;
        const maxAllowedQty = productQuantitiesInJobOrder[key];
        console.log("maxAllowedQty", maxAllowedQty);

        if (allocatedQty + requestedQty > maxAllowedQty) {
            throw new ApiError(
                400,
                `Requested quantity (${requestedQty}) for product ${productId} (code: ${productCode}) exceeds remaining quantity. ` +
                `Already allocated: ${allocatedQty}, Max allowed: ${maxAllowedQty}, Remaining: ${maxAllowedQty - allocatedQty}`
            );
        }
    }

    // 6. Map files to their respective fields
    const filesMap = {};
    if (req.files) {
        req.files.forEach((file) => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });
    }

    // 7. Construct the internal work order data
    const jobOrderData = {
        job_order_id: bodyData.job_order_id,
        sales_order_no: bodyData.sales_order_no || undefined,
        date: {
            from: parsedDateFrom,
            to: parsedDateTo,
        },
        products: await Promise.all(
            bodyData.products.map(async (product, productIndex) => {
                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);
                return {
                    product: product.product,
                    code: product.code,
                    width: product.width ? parseFloat(product.width) : undefined,
                    height: product.height ? parseFloat(product.height) : undefined,
                    system: product.system,
                    product_system: product.product_system,
                    po_quantity: parseInt(product.po_quantity),
                    semifinished_details: await Promise.all(
                        product.semifinished_details.map(async (sfDetail, sfIndex) => {
                            if (!sfDetail.semifinished_id) {
                                throw new ApiError(
                                    400,
                                    `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                );
                            }
                            const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                            const sfFile = filesMap[sfFileField];
                            let sfFileUrl = undefined;
                            if (sfFile) {
                                const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(
                                    sfFile.originalname
                                )}`;
                                const sfFileData = {
                                    data: fs.readFileSync(sfFile.path),
                                    mimetype: sfFile.mimetype,
                                };
                                const sfUploadResult = await putObject(sfFileData, sfFileName);
                                sfFileUrl = sfUploadResult.url;
                            }
                            if (!sfDetail.processes || sfDetail.processes.length === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Processes are required for semifinished_details at index ${sfIndex} in product ${productIndex}`,
                                });
                            }
                            return {
                                semifinished_id: sfDetail.semifinished_id,
                                file_url: sfFileUrl,
                                remarks: sfDetail.remarks || undefined,
                                processes: await Promise.all(
                                    sfDetail.processes.map(async (process, processIndex) => {
                                        if (!process.name) {
                                            throw new ApiError(
                                                400,
                                                `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`
                                            );
                                        }
                                        const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                        const processFile = filesMap[processFileField];
                                        let processFileUrl = undefined;
                                        if (processFile) {
                                            const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(
                                                processFile.originalname
                                            )}`;
                                            const processFileData = {
                                                data: fs.readFileSync(processFile.path),
                                                mimetype: processFile.mimetype,
                                            };
                                            const processUploadResult = await putObject(
                                                processFileData,
                                                processFileName
                                            );
                                            processFileUrl = processUploadResult.url;
                                        }
                                        return {
                                            name: process.name,
                                            file_url: processFileUrl,
                                            remarks: process.remarks || undefined,
                                        };
                                    })
                                ),
                            };
                        })
                    ),
                };
            })
        ),
    };

    // 8. Save internal work order to MongoDB
    let internalWorkOrder;
    try {
        internalWorkOrder = await falconInternalWorkOrder.create(jobOrderData);
    } catch (error) {
        console.log('error', error);
        return res.status(500).json({
            success: false,
            message: `Error creating internal work order: ${error.message}`,
        });
    }

    // 9. Construct and save falconProduction documents
    try {
        const productionDocs = [];
        for (const product of jobOrderData.products) {
            console.log("product***", product);
            for (const sfDetail of product.semifinished_details) {
                for (const process of sfDetail.processes) {
                    const productionData = {
                        job_order: job_order_id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            width: product.width ? parseFloat(product.width) : undefined,
                            height: product.height ? parseFloat(product.height) : undefined,
                            po_quantity: product.po_quantity,
                            achieved_quantity: 0,
                            rejected_quantity: 0,
                            recycled_quantity: 0,
                        },
                        process_name: process.name.toLowerCase(),
                        date: parsedDateFrom,
                        status: 'Pending',
                        created_by: req.user?._id || null,
                        updated_by: req.user?._id || null,
                    };
                    productionDocs.push(productionData);
                }
            }
        }
        const productions = await falconProduction.insertMany(productionDocs);
        console.log('Production documents created:', productions);
    } catch (error) {
        console.log('Error creating production documents:', error);
        await falconInternalWorkOrder.deleteOne({ _id: internalWorkOrder._id });
        return res.status(500).json({
            success: false,
            message: `Error creating production documents: ${error.message}`,
        });
    }

    // 10. Return success response
    return res.status(201).json({
        success: true,
        message: 'Internal Work order and Production documents created successfully',
        data: internalWorkOrder,
    });
});


const createInternalWorkOrder_07_08_2025 = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Validate job_order_id
        const { job_order_id } = req.body;
        if (!job_order_id) {
            throw new ApiError(400, 'Job order ID is required');
        }

        validateObjectId(job_order_id, 'job_order_id');

        // 2. Check if job order exists
        const jobOrder = await falconJobOrder.findById(job_order_id).session(session).populate('products.product');
        if (!jobOrder) {
            throw new ApiError(404, 'Job order not found');
        }

        // 3. Parse the form-data body
        const bodyData = req.body;
        if (typeof bodyData.products === 'string') {
            try {
                bodyData.products = JSON.parse(bodyData.products);
            } catch (err) {
                throw new ApiError(400, 'Invalid products JSON format');
            }
        }

        // 4. Extract and validate date fields
        let dateFrom, dateTo;
        if (bodyData.date && bodyData.date.from && bodyData.date.to) {
            dateFrom = parseDate(bodyData.date.from, 'date.from');
            dateTo = parseDate(bodyData.date.to, 'date.to');
        } else if (bodyData['date[from]'] && bodyData['date[to]']) {
            dateFrom = parseDate(bodyData['date[from]'], 'date.from');
            dateTo = parseDate(bodyData['date[to]'], 'date.to');
        } else {
            throw new ApiError(400, 'Date range (from and to) is required');
        }

        // 5. Validate product quantities against job order
        const productQuantitiesInJobOrder = {};
        jobOrder.products.forEach((prod) => {
            const key = `${prod.product._id.toString()}-${prod.code}`;
            productQuantitiesInJobOrder[key] = prod.po_quantity;
        });

        // Calculate allocated quantities
        const existingIWOs = await falconInternalWorkOrder.find({ job_order_id }).session(session).lean();
        const allocatedQuantities = {};

        existingIWOs.forEach((iwo) => {
            iwo.products.forEach((prod) => {
                const key = `${prod.product.toString()}-${prod.code}`;
                allocatedQuantities[key] = (allocatedQuantities[key] || 0) + prod.po_quantity;
            });
        });
        ///
        // Validate requested quantities
        for (const product of bodyData.products) {
            const productId = product.product;
            const productCode = product.code;
            const key = `${productId}-${productCode}`;

            if (!productQuantitiesInJobOrder[key]) {
                throw new ApiError(400, `Product ${productId} with code ${productCode} is not part of the job order`);
            }

            const requestedQty = parseInt(product.po_quantity);
            const allocatedQty = allocatedQuantities[key] || 0;
            const maxAllowedQty = productQuantitiesInJobOrder[key];

            if (allocatedQty + requestedQty > maxAllowedQty) {
                throw new ApiError(
                    400,
                    `Requested quantity (${requestedQty}) for product ${productId} (code: ${productCode}) exceeds remaining quantity. ` +
                    `Already allocated: ${allocatedQty}, Max allowed: ${maxAllowedQty}, Remaining: ${maxAllowedQty - allocatedQty}`
                );
            }
        }

        // 6. Map files to their respective fields
        const filesMap = {};
        if (req.files) {
            req.files.forEach((file) => {
                const fieldName = file.fieldname;
                filesMap[fieldName] = file;
            });
        }

        // 7. Construct the internal work order data
        const jobOrderData = {
            job_order_id: bodyData.job_order_id,
            sales_order_no: bodyData.sales_order_no || undefined,
            date: {
                from: dateFrom,
                to: dateTo,
            },
            products: await Promise.all(
                bodyData.products.map(async (product, productIndex) => {
                    validateObjectId(product.product, `product at index ${productIndex}`);
                    validateObjectId(product.system, `system at index ${productIndex}`);
                    validateObjectId(product.product_system, `product_system at index ${productIndex}`);

                    return {
                        product: product.product,
                        code: product.code,
                        width: product.width ? parseFloat(product.width) : undefined,
                        height: product.height ? parseFloat(product.height) : undefined,
                        system: product.system,
                        product_system: product.product_system,
                        po_quantity: parseInt(product.po_quantity),
                        semifinished_details: await Promise.all(
                            product.semifinished_details.map(async (sfDetail, sfIndex) => {
                                if (!sfDetail.semifinished_id) {
                                    throw new ApiError(
                                        400,
                                        `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                    );
                                }

                                const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                                const sfFile = filesMap[sfFileField];
                                let sfFileUrl = undefined;

                                if (sfFile) {
                                    const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(
                                        sfFile.originalname
                                    )}`;
                                    const sfFileData = {
                                        data: fs.readFileSync(sfFile.path),
                                        mimetype: sfFile.mimetype,
                                    };
                                    const sfUploadResult = await putObject(sfFileData, sfFileName);
                                    sfFileUrl = sfUploadResult.url;
                                }

                                if (!sfDetail.processes || sfDetail.processes.length === 0) {
                                    throw new ApiError(
                                        400,
                                        `Processes are required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                    );
                                }

                                return {
                                    semifinished_id: sfDetail.semifinished_id,
                                    file_url: sfFileUrl,
                                    remarks: sfDetail.remarks || undefined,
                                    processes: await Promise.all(
                                        sfDetail.processes.map(async (process, processIndex) => {
                                            if (!process.name) {
                                                throw new ApiError(
                                                    400,
                                                    `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`
                                                );
                                            }

                                            const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                            const processFile = filesMap[processFileField];
                                            let processFileUrl = undefined;

                                            if (processFile) {
                                                const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(
                                                    processFile.originalname
                                                )}`;
                                                const processFileData = {
                                                    data: fs.readFileSync(processFile.path),
                                                    mimetype: processFile.mimetype,
                                                };
                                                const processUploadResult = await putObject(processFileData, processFileName);
                                                processFileUrl = processUploadResult.url;
                                            }

                                            return {
                                                name: process.name,
                                                file_url: processFileUrl,
                                                remarks: process.remarks || undefined,
                                            };
                                        })
                                    ),
                                };
                            })
                        ),
                    };
                })
            ),
        };

        // 8. Save internal work order
        const internalWorkOrder = await falconInternalWorkOrder.create([jobOrderData], { session });

        // 9. Create production records with proper sequencing
        const productionDocs = [];
        for (const product of jobOrderData.products) {
            for (const sfDetail of product.semifinished_details) {
                // Create production records with proper sequencing
                sfDetail.processes.forEach((process, index) => {
                    const productionData = {
                        job_order: job_order_id,
                        internal_work_order: internalWorkOrder[0]._id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            width: product.width,
                            height: product.height,
                            po_quantity: product.po_quantity,
                            achieved_quantity: 0,
                            rejected_quantity: 0,
                            recycled_quantity: 0,
                        },
                        process_name: process.name.toLowerCase(),
                        process_sequence: {
                            current: {
                                name: process.name.toLowerCase(),
                                index: index,
                            },
                            previous: index > 0 ? {
                                name: sfDetail.processes[index - 1].name.toLowerCase(),
                                index: index - 1,
                            } : null,
                            next: index < sfDetail.processes.length - 1 ? {
                                name: sfDetail.processes[index + 1].name.toLowerCase(),
                                index: index + 1,
                            } : null,
                        },
                        available_quantity: index === 0 ? product.po_quantity : 0,
                        status: index === 0 ? 'Pending' : 'Pending', //Blocked
                        date: dateFrom,
                        created_by: req.user._id,
                        updated_by: req.user._id,
                    };
                    productionDocs.push(productionData);
                });
            }
        }

        // 10. Save production records
        await falconProduction.insertMany(productionDocs, { session });

        await session.commitTransaction();

        return res.status(201).json({
            success: true,
            message: 'Internal Work order and Production documents created successfully',
            data: internalWorkOrder[0],
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in createInternalWorkOrder:', error);
        throw error;
    } finally {
        session.endSession();
    }
});

const createInternalWorkOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bodyData = req.body;
        console.log("bodyData", bodyData);

        const filesMap = {};
        if (req.files) {
            req.files.forEach(file => {
                const fieldName = file.fieldname;
                filesMap[fieldName] = file;
            });
        }

        const dateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : undefined;
        const dateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : undefined;

        if (!bodyData.job_order_id) {
            throw new ApiError(400, 'Job order ID is required');
        }

        validateObjectId(bodyData.job_order_id, 'job_order_id');

        // Define valid process transitions
        const validTransitions = {
            '': ['cutting', 'machining','assembling'], // Initial processes
            'cutting': ['machining', 'assembling', 'glass fixing / glazing'],
            'machining': ['assembling', 'glass fixing / glazing'],
            'assembling': ['glass fixing / glazing'],
            'glass fixing / glazing': [] // No further processes
        };



        // Inside your try block, after validateObjectId and before jobOrderData:
for (const product of bodyData.products) {
    // Fetch all existing IWOs for this job_order_id and product
    const existingIWOs = await falconInternalWorkOrder.aggregate([
        { $match: { job_order_id: bodyData.job_order_id } },
        { $unwind: "$products" },
        { $match: { "products.product": product.product } },
        { $group: { _id: "$products.product", totalQty: { $sum: "$products.po_quantity" } } }
    ]);

    // Fetch the original Job Order to get the product's quantity
    const jobOrder = await falconJobOrder.findById(bodyData.job_order_id);
    const jobOrderProduct = jobOrder.products.find(p => p.product.equals(product.product));
    const jobOrderQty = jobOrderProduct.po_quantity;

    // Calculate the total quantity already allocated in IWOs
    const existingQty = existingIWOs.find(iwo => iwo._id.equals(product.product))?.totalQty || 0;

    // Validate the new quantity
    if (existingQty + product.po_quantity > jobOrderQty) {
        throw new ApiError(
            400,
            `Cannot allocate ${product.po_quantity} for product ${product.code}. ` +
            `Only ${jobOrderQty - existingQty} remaining (Job Order Qty: ${jobOrderQty}, Allocated: ${existingQty}).`
        );
    }
}




        const jobOrderData = {
            job_order_id: bodyData.job_order_id,
            sales_order_no: bodyData.sales_order_no || undefined,
            date: {
                from: dateFrom,
                to: dateTo,
            },
            products: await Promise.all(
                bodyData.products.map(async (product, productIndex) => {
                    if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
                    if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
                    if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
                    if (!product.po_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);
                    if (!product.code) throw new ApiError(400, `Code is required for product at index ${productIndex}`);

                    validateObjectId(product.product, `product at index ${productIndex}`);
                    validateObjectId(product.system, `system at index ${productIndex}`);
                    validateObjectId(product.product_system, `product_system at index ${productIndex}`);

                    return {
                        product: product.product,
                        system: product.system,
                        product_system: product.product_system,
                        code: product.code,
                        po_quantity: parseInt(product.po_quantity),
                        semifinished_details: await Promise.all(
                            product.semifinished_details.map(async (sfDetail, sfIndex) => {
                                if (!sfDetail.semifinished_id) {
                                    throw new ApiError(
                                        400,
                                        `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                    );
                                }

                                if (!sfDetail.processes || sfDetail.processes.length === 0) {
                                    throw new ApiError(
                                        400,
                                        `Processes are required for semifinished_details at index ${sfIndex} in product ${productIndex}`
                                    );
                                }

                                const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                                const sfFile = filesMap[sfFileField];
                                let sfFileUrl = undefined;

                                // Validate process sequence
                                let lastProcess = '';
                                const processes = await Promise.all(
                                    sfDetail.processes.map(async (process, index) => {
                                        const processName = process.name.toLowerCase();
                                        const validNext = validTransitions[lastProcess];

                                        if (!validNext.includes(processName)) {
                                            throw new ApiError(
                                                400,
                                                `Invalid process '${processName}' at index ${index}. After '${lastProcess}', only ${validNext.join(', ')} are allowed.`
                                            );
                                        }

                                        const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${index}][file]`;
                                        const processFile = filesMap[processFileField];
                                        let processFileUrl = undefined;

                                        if (processFile) {
                                            const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                            // const processFileData = {
                                            //     data: fs.readFileSync(processFile.path),
                                            //     mimetype: processFile.mimetype,
                                            // };
                                            // const processUploadResult = await putObject(processFileData, processFileName);
                                            // processFileUrl = processUploadResult.url;
                                            const processUploadResult = await putObject(
                                                { data: processFile.buffer, mimetype: processFile.mimetype },
                                                processFileName
                                            );
                                            processFileUrl = processUploadResult.url;

                                        }


                                        lastProcess = processName;
                                        return {
                                            name: processName,
                                            file_url: processFileUrl,
                                            remarks: process.remarks || undefined,
                                        };
                                    })
                                );

                                return {
                                    semifinished_id: sfDetail.semifinished_id,
                                    file_url: sfFileUrl,
                                    remarks: sfDetail.remarks || undefined,
                                    processes: processes,
                                };
                            })
                        ),
                    };
                })
            ),
        };
        

        const internalWorkOrder = await falconInternalWorkOrder.create([jobOrderData], { session });

        // Create production records
        const productionDocs = [];
        for (const product of internalWorkOrder[0].products) {
            for (const sfDetail of product.semifinished_details) {
                sfDetail.processes.forEach((process, index) => {
                    const productionData = {
                        job_order: internalWorkOrder[0].job_order_id,
                        internal_work_order: internalWorkOrder[0]._id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            po_quantity: product.po_quantity,
                        },
                        process_name: process.name,
                        process_sequence: {
                            current: { name: process.name, index },
                            previous: index > 0 ? { name: sfDetail.processes[index - 1].name, index: index - 1 } : null,
                            next: index < sfDetail.processes.length - 1 ? { name: sfDetail.processes[index + 1].name, index: index + 1 } : null,
                        },
                        available_quantity: index === 0 ? product.po_quantity : 0,
                        status: 'Pending',
                        date: dateFrom,
                        created_by: req.user._id,
                        updated_by: req.user._id,
                    };
                    productionDocs.push(productionData);
                });
            }
        }

        await falconProduction.insertMany(productionDocs, { session });

        await session.commitTransaction();

        return res.status(201).json(new ApiResponse(201, internalWorkOrder[0], 'Internal work order created successfully'));
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in createInternalWorkOrder:', error);
        throw error;
    } finally {
        session.endSession();
    }
});


///////////////////////////////////////////////////////////////////////////////////////////////////

const getInternalWorkOrderDetailsss = asyncHandler(async (req, res) => {
    try {
        const internalWorkOrders = await falconInternalWorkOrder.find().select({ job_order_id: 1, date: 1 });

        const detailedInternalWorkOrders = await Promise.all(
            internalWorkOrders.map(async (internalOrder) => {
                const jobOrder = await falconJobOrder.findOne({ _id: internalOrder.job_order_id });

                if (jobOrder) {
                    const project = await falconProject.findById(jobOrder.project_id);

                    return {
                        job_order_id: jobOrder.job_order_id,
                        from_date: formatDateOnly(internalOrder.date.from),
                        to_date: formatDateOnly(internalOrder.date.to),
                        work_order_number: jobOrder.work_order_number,
                        project_name: project ? project.name : null,
                    };
                } else {
                    return {
                        job_order_id: null,
                        from_date: formatDateOnly(internalOrder.date.from),
                        to_date: formatDateOnly(internalOrder.date.to),
                        work_order_number: null,
                        project_name: null,
                    };
                }
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Internal work orders fetched successfully',
            data: detailedInternalWorkOrders,
        });

    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching internal work orders: ' + error.message,
        });
    }
});
// const getInternalWorkOrderDetails = asyncHandler(async (req, res) => {
//     try {
//         // Step 1: Fetch all internal work orders
//         const internalWorkOrders = await falconInternalWorkOrder.find().select({ job_order_id: 1, date: 1, _id: 1 });
//         console.log("internalWorkOrders", internalWorkOrders);

//         // Extract unique job_order_id values
//         const jobOrderIds = [...new Set(internalWorkOrders.map(order => order.job_order_id))];
//         console.log("jobOrderIds",jobOrderIds);

//         // Step 2: Fetch all corresponding job orders in a single query
//         const jobOrders = await falconJobOrder.find({ '_id': { $in: jobOrderIds } });

//         // Create a map for job orders for quick lookup
//         const jobOrderMap = new Map(jobOrders.map(jobOrder => [jobOrder._id.toString(), jobOrder]));

//         // Extract unique project_id values from job orders
//         const projectIds = [...new Set(jobOrders.map(jobOrder => jobOrder.project_id.toString()))];

//         // Step 3: Fetch all corresponding projects in a single query
//         const projects = await falconProject.find({ '_id': { $in: projectIds } });

//         // Create a map for projects for quick lookup
//         const projectMap = new Map(projects.map(project => [project._id.toString(), project]));

//         // Step 4: Combine and restructure the data
//         const detailedInternalWorkOrders = internalWorkOrders.map(internalOrder => {
//             const jobOrder = jobOrderMap.get(internalOrder.job_order_id.toString());
//             // console.log("jobOrder", jobOrder);
//             const project = jobOrder ? projectMap.get(jobOrder.project_id.toString()) : null;

//             return {
//                 _id: internalOrder._id.toString(), // Add internal work order ID
//                 job_order_id: jobOrder ? jobOrder.job_order_id : null,
//                 from_date: jobOrder ? formatDateOnly(internalOrder.date.from) : null,
//                 to_date: jobOrder ? formatDateOnly(internalOrder.date.to) : null,
//                 work_order_number: jobOrder ? jobOrder.work_order_number : null,
//                 project_name: project ? project.name : null,
//             };
//         });

//         return res.status(200).json({
//             success: true,
//             message: 'Internal work orders fetched successfully',
//             data: detailedInternalWorkOrders,
//         });

//     } catch (error) {
//         console.log('Error:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error fetching internal work orders: ' + error.message,
//         });
//     }
// });

const getInternalWorkOrderDetails = asyncHandler(async (req, res) => {
    try {
        // Step 1: Fetch all internal work orders with minimal fields
        const internalWorkOrders = await falconInternalWorkOrder
            .find()
            .select('job_order_id date _id')
            .lean();

        if (!internalWorkOrders.length) {
            return res.status(200).json({
                success: true,
                message: 'No internal work orders found',
                data: [],
            });
        }

        // Step 2: Populate job orders with work order and project details
        const jobOrderIds = [...new Set(internalWorkOrders.map(order => order.job_order_id.toString()))];

        const jobOrders = await falconJobOrder
            .find({ _id: { $in: jobOrderIds } })
            .populate({
                path: 'work_order_number',
                select: 'work_order_number project_id',
                populate: {
                    path: 'project_id',
                    model: 'falconProject',
                    select: 'name',
                    match: { isDeleted: false },
                },
            })
            .select('job_order_id work_order_number')
            .lean();

        // Create a map for job orders
        const jobOrderMap = new Map(jobOrders.map(jobOrder => [jobOrder._id.toString(), jobOrder]));

        // Step 3: Construct the response
        const detailedInternalWorkOrders = internalWorkOrders.map(internalOrder => {
            const jobOrder = jobOrderMap.get(internalOrder.job_order_id.toString());
            const workOrder = jobOrder?.work_order_number;
            const project = workOrder?.project_id;

            return {
                _id: internalOrder._id.toString(),
                job_order_id: jobOrder?.job_order_id || null,
                work_order_number: workOrder?.work_order_number || null,
                project_name: project?.name || null,
                from_date: internalOrder.date?.from ? formatDateOnly(internalOrder.date.from) : null,
                to_date: internalOrder.date?.to ? formatDateOnly(internalOrder.date.to) : null,
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Internal work orders fetched successfully',
            data: detailedInternalWorkOrders,
        });
    } catch (error) {
        console.error('Error fetching internal work orders:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching internal work orders: ${error.message}`,
        });
    }
});


// const getInternalWorkOrderById = asyncHandler(async (req, res) => {
//     try {
//         const { id } = req.params; // Assuming the _id is passed as a URL parameter

//         // Step 1: Fetch the internal work order by ID
//         const internalWorkOrder = await falconInternalWorkOrder.findById(id);
//         if (!internalWorkOrder) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Internal work order not found',
//             });
//         }
//         console.log("internalWorkOrder",internalWorkOrder);
//         internalWorkOrder.products.map(product => {
//             console.log("****product", product);
//             product.semifinished_details.map(sf => {
//                 console.log("****sf", sf);

//             })
//         })

//         // Step 2: Fetch the job order details
//         const jobOrder = await falconJobOrder.findById(internalWorkOrder.job_order_id);
//         if (!jobOrder) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Job order not found',
//             });
//         }
//         // console.log("jobOrder",jobOrder);
//         const woOrder = await falconWorkOrder.findById(jobOrder.work_order_number);
//         if (!woOrder) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Work order not found',
//             });
//         }
//         // console.log("woOrder",woOrder);


//         // Step 3: Fetch the client and project details
//         const client = await falconClient.findById(woOrder.client_id);
//         // console.log("client",client);
//         const project = await falconProject.findById(woOrder.project_id);
//         // console.log("project",project);

//         // Step 4: Fetch the employee details for approvedBy and receivedBy
//         const approvedBy = await Employee.findById(jobOrder.prod_issued_approved_by);
//         const receivedBy = await Employee.findById(jobOrder.prod_recieved_by);

//         // Step 5: Fetch the product details
//         const productsDetails = await Promise.all(
//             jobOrder.products.map(async (jobProduct) => {
//                 const productDetail = await falconProduct.findById(jobProduct.product);

//                 // Match with internalWorkOrder product
//                 const matchedInternalProduct = internalWorkOrder.products.find(
//                     p => String(p.product) === String(jobProduct.product)
//                 );

//                 return {
//                     product_name: productDetail ? productDetail.name : null,
//                     product_id: jobProduct.product,
//                     sales_order_no: internalWorkOrder.sales_order_no,
//                     // system: , 
//                     // system_id: ,
//                     // product_system: ,
//                     // product_system_id: ,
//                     po_quantity: jobProduct.po_quantity,
//                     from_date: formatDateOnly(internalWorkOrder.date.from),
//                     to_date: formatDateOnly(internalWorkOrder.date.to),
//                     uom: jobProduct.uom,
//                     code: jobProduct.code,
//                     color_code: jobProduct.color_code,
//                     width: jobProduct.width,
//                     height: jobProduct.height,
//                     semifinished_details: matchedInternalProduct?.semifinished_details || [] // ✅ Add semifinished_details
//                 };
//             })
//         );


//         // Step 6: Format the response
//         const responseData = {
//             clientProjectDetails: {
//                 clientName: client ? client.name : null,
//                 clientId: client ? client._id : null,
//                 address: client ? client.address : null,
//                 projectName: project ? project.name : null,
//                 projectId: project ? project._id : null,
//             },
//             workOrderDetails: {
//                 workOrderNumber: jobOrder.work_order_number,
//                 productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
//                 productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
//                 approvedBy: approvedBy ? approvedBy.name : null,
//                 approvedById: approvedBy ? approvedBy._id : null,
//                 receivedBy: receivedBy ? receivedBy.name : null,
//                 receivedById: receivedBy ? receivedBy._id : null,
//                 workOrderDate: formatDateOnly(jobOrder.date),
//                 file: jobOrder.files,
//                 createdAt: formatDateOnly(jobOrder.createdAt),
//                 createdBy: "admin", // Replace with actual createdBy data if available
//             },
//             jobOrderDetails: {
//                 job_order_id: jobOrder._id,
//                 jobOrderNumber: jobOrder.job_order_id,
//                 createdAt: formatDateOnly(jobOrder.createdAt),
//                 createdBy: "admin", // Replace with actual createdBy data if available
//                 status: jobOrder.status,
//             },
//             productsDetails: productsDetails,
//         };

//         return res.status(200).json({
//             success: true,
//             message: 'Internal work order fetched successfully',
//             data: responseData,
//         });

//     } catch (error) {
//         console.log('Error:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error fetching internal work order: ' + error.message,
//         });
//     }
// });
const getInternalWorkOrderById_07_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        console.log("id", id);
        console.log("came here in internal get by id");

        // Step 1: Fetch the internal work order by ID with populated system and product_system
        const internalWorkOrder = await falconInternalWorkOrder
            .findById(id)
            .populate({
                path: 'products.system',
                model: 'falconSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .populate({
                path: 'products.product_system',
                model: 'falconProductSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .lean();

        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal work order not found',
            });
        }

        // Step 2: Fetch the job order details
        const jobOrder = await falconJobOrder
            .findById(internalWorkOrder.job_order_id)
            .populate({
                path: 'work_order_number',
                model: 'falconWorkOrder',
                select: 'work_order_number client_id project_id',
                populate: [
                    {
                        path: 'client_id',
                        model: 'falconClient',
                        select: 'name address',
                        match: { isDeleted: false },
                    },
                    {
                        path: 'project_id',
                        model: 'falconProject',
                        select: 'name',
                        match: { isDeleted: false },
                    },
                ],
            })
            .populate({
                path: 'prod_issued_approved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'prod_recieved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'created_by',
                model: 'User',
                select: 'username',
            })
            .lean();

        console.log("jobOrder", jobOrder);

        if (!jobOrder) {
            return res.status(404).json({
                success: false,
                message: 'Job order not found',
            });
        }

        if (!jobOrder.work_order_number) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found',
            });
        }

        // Step 3: Fetch product details for job order products
        const productsDetails = await Promise.all(
            jobOrder.products.map(async (jobProduct) => {
                const productDetail = await falconProduct.findById(jobProduct.product).select('name').lean();

                // Match with internalWorkOrder product
                const matchedInternalProduct = internalWorkOrder.products.find(
                    p => String(p.product) === String(jobProduct.product)
                );
                console.log("matchedInternalProduct", matchedInternalProduct?.po_quantity);

                return {
                    product_name: productDetail ? productDetail.name : null,
                    product_id: jobProduct.product,
                    sales_order_no: internalWorkOrder.sales_order_no,
                    system_name: matchedInternalProduct?.system?.name || null,
                    system_id: matchedInternalProduct?.system?._id || null,
                    product_system_name: matchedInternalProduct?.product_system?.name || null,
                    product_system_id: matchedInternalProduct?.product_system?._id || null,
                    po_quantity: jobProduct.po_quantity,
                    planned_quantity: matchedInternalProduct?.po_quantity,
                    from_date: internalWorkOrder.date?.from ? formatDateOnly(internalWorkOrder.date.from) : null,
                    to_date: internalWorkOrder.date?.to ? formatDateOnly(internalWorkOrder.date.to) : null,
                    uom: jobProduct.uom,
                    code: jobProduct.code,
                    color_code: jobProduct.color_code,
                    width: jobProduct.width,
                    height: jobProduct.height,
                    semifinished_details: matchedInternalProduct?.semifinished_details || [],
                };
            })
        );

        // Step 4: Format the response
        const responseData = {
            clientProjectDetails: {
                clientName: jobOrder.work_order_number?.client_id?.name || null,
                clientId: jobOrder.work_order_number?.client_id?._id || null,
                address: jobOrder.work_order_number?.client_id?.address || null,
                projectName: jobOrder.work_order_number?.project_id?.name || null,
                projectId: jobOrder.work_order_number?.project_id?._id || null,
            },
            workOrderDetails: {
                workOrderNumber: jobOrder.work_order_number?.work_order_number || null,
                productionRequestDate: jobOrder.prod_requset_date ? formatDateOnly(jobOrder.prod_requset_date) : null,
                productionRequirementDate: jobOrder.prod_requirement_date ? formatDateOnly(jobOrder.prod_requirement_date) : null,
                approvedBy: jobOrder.prod_issued_approved_by?.name || null,
                approvedById: jobOrder.prod_issued_approved_by?._id || null,
                receivedBy: jobOrder.prod_recieved_by?.name || null,
                receivedById: jobOrder.prod_recieved_by?._id || null,
                workOrderDate: jobOrder.date ? formatDateOnly(jobOrder.date) : null,
                file: jobOrder.files || [],
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by.username,
            },
            jobOrderDetails: {
                job_order_id: jobOrder._id,
                jobOrderNumber: jobOrder.job_order_id,
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by.username,
                status: jobOrder.status,
            },
            productsDetails: productsDetails,
        };

        return res.status(200).json({
            success: true,
            message: 'Internal work order fetched successfully',
            data: responseData,
        });
    } catch (error) {
        console.error('Error fetching internal work order:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching internal work order: ${error.message}`,
        });
    }
});

const getInternalWorkOrderById_12_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        console.log("id", id);
        console.log("came here in internal get by id");

        // Step 1: Fetch the internal work order by ID with populated system and product_system
        const internalWorkOrder = await falconInternalWorkOrder
            .findById(id)
            .populate({
                path: 'products.system',
                model: 'falconSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .populate({
                path: 'products.product_system',
                model: 'falconProductSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .lean();

        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal work order not found',
            });
        }

        // Step 2: Fetch the job order details
        const jobOrder = await falconJobOrder
            .findById(internalWorkOrder.job_order_id)
            .populate({
                path: 'work_order_number',
                model: 'falconWorkOrder',
                select: 'work_order_number client_id project_id',
                populate: [
                    {
                        path: 'client_id',
                        model: 'falconClient',
                        select: 'name address',
                        match: { isDeleted: false },
                    },
                    {
                        path: 'project_id',
                        model: 'falconProject',
                        select: 'name',
                        match: { isDeleted: false },
                    },
                ],
            })
            .populate({
                path: 'prod_issued_approved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'prod_recieved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'created_by',
                model: 'User',
                select: 'username',
            })
            .lean();

        console.log("jobOrder", jobOrder);

        if (!jobOrder) {
            return res.status(404).json({
                success: false,
                message: 'Job order not found',
            });
        }

        if (!jobOrder.work_order_number) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found',
            });
        }

        // Step 3: Fetch product details for internal work order products
        const productsDetails = await Promise.all(
            internalWorkOrder.products.map(async (internalProduct) => {
                const jobProduct = jobOrder.products.find(
                    p => String(p.product) === String(internalProduct.product)
                );
                const productDetail = await falconProduct.findById(internalProduct.product).select('name').lean();

                return {
                    product_name: productDetail ? productDetail.name : null,
                    product_id: internalProduct.product,
                    sales_order_no: internalWorkOrder.sales_order_no,
                    system_name: internalProduct.system?.name || null,
                    system_id: internalProduct.system?._id || null,
                    product_system_name: internalProduct.product_system?.name || null,
                    product_system_id: internalProduct.product_system?._id || null,
                    po_quantity: jobProduct ? jobProduct.po_quantity : internalProduct.po_quantity,
                    planned_quantity: internalProduct.po_quantity,
                    from_date: internalWorkOrder.date?.from ? formatDateOnly(internalWorkOrder.date.from) : null,
                    to_date: internalWorkOrder.date?.to ? formatDateOnly(internalWorkOrder.date.to) : null,
                    uom: jobProduct ? jobProduct.uom : internalProduct.uom,
                    code: jobProduct ? jobProduct.code : internalProduct.code,
                    color_code: jobProduct ? jobProduct.color_code : internalProduct.color_code,
                    width: jobProduct ? jobProduct.width : internalProduct.width,
                    height: jobProduct ? jobProduct.height : internalProduct.height,
                    semifinished_details: internalProduct.semifinished_details || [],
                };
            })
        );

        // Step 4: Format the response
        const responseData = {
            clientProjectDetails: {
                clientName: jobOrder.work_order_number?.client_id?.name || null,
                clientId: jobOrder.work_order_number?.client_id?._id || null,
                address: jobOrder.work_order_number?.client_id?.address || null,
                projectName: jobOrder.work_order_number?.project_id?.name || null,
                projectId: jobOrder.work_order_number?.project_id?._id || null,
            },
            workOrderDetails: {
                workOrderNumber: jobOrder.work_order_number?.work_order_number || null,
                productionRequestDate: jobOrder.prod_requset_date ? formatDateOnly(jobOrder.prod_requset_date) : null,
                productionRequirementDate: jobOrder.prod_requirement_date ? formatDateOnly(jobOrder.prod_requirement_date) : null,
                approvedBy: jobOrder.prod_issued_approved_by?.name || null,
                approvedById: jobOrder.prod_issued_approved_by?._id || null,
                receivedBy: jobOrder.prod_recieved_by?.name || null,
                receivedById: jobOrder.prod_recieved_by?._id || null,
                workOrderDate: jobOrder.date ? formatDateOnly(jobOrder.date) : null,
                file: jobOrder.files || [],
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by.username,
            },
            jobOrderDetails: {
                job_order_id: jobOrder._id,
                jobOrderNumber: jobOrder.job_order_id,
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by.username,
                status: jobOrder.status,
            },
            productsDetails: productsDetails,
        };

        return res.status(200).json({
            success: true,
            message: 'Internal work order fetched successfully',
            data: responseData,
        });
    } catch (error) {
        console.error('Error fetching internal work order:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching internal work order: ${error.message}`,
        });
    }
});



const getInternalWorkOrderById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Step 1: Fetch the internal work order by ID with populated system and product_system
        const internalWorkOrder = await falconInternalWorkOrder
            .findById(id)
            .populate({
                path: 'products.system',
                model: 'falconSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .populate({
                path: 'products.product_system',
                model: 'falconProductSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .lean();

        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal work order not found',
            });
        }
        console.log("internalWorkOrder",internalWorkOrder);

        // Step 2: Fetch the job order details
        const jobOrder = await falconJobOrder
            .findById(internalWorkOrder.job_order_id)
            .populate({
                path: 'work_order_number',
                model: 'falconWorkOrder',
                select: 'work_order_number client_id project_id',
                populate: [
                    {
                        path: 'client_id',
                        model: 'falconClient',
                        select: 'name address',
                        match: { isDeleted: false },
                    },
                    {
                        path: 'project_id',
                        model: 'falconProject',
                        select: 'name',
                        match: { isDeleted: false },
                    },
                ],
            })
            .populate({
                path: 'prod_issued_approved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'prod_recieved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'created_by',
                model: 'User',
                select: 'username',
            })
            .lean();

        if (!jobOrder) {
            return res.status(404).json({
                success: false,
                message: 'Job order not found',
            });
        }

        if (!jobOrder.work_order_number) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found',
            });
        }

        // Step 3: Fetch product details and production quantities for the last process
        const productsDetails = await Promise.all(
            internalWorkOrder.products.map(async (internalProduct) => {
                // console.log("internalProduct",internalProduct);
                const jobProduct = jobOrder.products.find(
                    p => String(p.product) === String(internalProduct.product)
                );
                const productDetail = await falconProduct.findById(internalProduct.product).select('name');
                //.lean()

                // Fetch the production record for the last process for each semifinished_id
                const semifinishedIds = internalProduct.semifinished_details.map(s => s.semifinished_id);
                let achievedQty = 0;
                let rejectedQty = 0;

                if (semifinishedIds.length > 0) {
                    // Find the production record with the highest process_sequence.current.index
                    const lastProductionRecord = await falconProduction
                        .findOne({
                            internal_work_order: id,
                            'product.product_id': internalProduct.product,
                            semifinished_id: { $in: semifinishedIds },
                        })
                        // .sort({ 'process_sequence.current.index': -1 }) // Sort by process index descending
                        .select('product.achieved_quantity product.rejected_quantity')
                        .lean();

                    if (lastProductionRecord) {
                        achievedQty = lastProductionRecord.product.achieved_quantity || 0;
                        rejectedQty = lastProductionRecord.product.rejected_quantity || 0;
                    }
                }

                return {
                    product_name: productDetail ? productDetail.name : null,
                    product_id: internalProduct.product,
                    sales_order_no: internalWorkOrder.sales_order_no || 'N/A', // Explicitly include sales_order_no
                    system_name: internalProduct.system?.name || null,
                    system_id: internalProduct.system?._id || null,
                    product_system_name: internalProduct.product_system?.name || null,
                    product_system_id: internalProduct.product_system?._id || null,
                    po_quantity: jobProduct ? jobProduct.po_quantity : internalProduct.po_quantity,
                    planned_quantity: internalProduct.po_quantity,
                    from_date: internalWorkOrder.date?.from ? formatDateOnly(internalWorkOrder.date.from) : null,
                    to_date: internalWorkOrder.date?.to ? formatDateOnly(internalWorkOrder.date.to) : null,
                    uom: jobProduct ? jobProduct.uom : internalProduct.uom,
                    code: jobProduct ? internalProduct.code : jobProduct.code, //
                    color_code: jobProduct ? jobProduct.color_code : internalProduct.color_code,
                    width: jobProduct ? jobProduct.width : internalProduct.width,
                    height: jobProduct ? jobProduct.height : internalProduct.height,
                    semifinished_details: internalProduct.semifinished_details || [],
                    achieved_qty: achievedQty,
                    rejected_qty: rejectedQty,
                };
            })
        );

        // Step 4: Format the response
        const responseData = {
            clientProjectDetails: {
                clientName: jobOrder.work_order_number?.client_id?.name || null,
                clientId: jobOrder.work_order_number?.client_id?._id || null,
                address: jobOrder.work_order_number?.client_id?.address || null,
                projectName: jobOrder.work_order_number?.project_id?.name || null,
                projectId: jobOrder.work_order_number?.project_id?._id || null,
            },
            workOrderDetails: {
                workOrderNumber: jobOrder.work_order_number?.work_order_number || null,
                productionRequestDate: jobOrder.prod_requset_date ? formatDateOnly(jobOrder.prod_requset_date) : null,
                productionRequirementDate: jobOrder.prod_requirement_date ? formatDateOnly(jobOrder.prod_requirement_date) : null,
                approvedBy: jobOrder.prod_issued_approved_by?.name || null,
                approvedById: jobOrder.prod_issued_approved_by?._id || null,
                receivedBy: jobOrder.prod_recieved_by?.name || null,
                receivedById: jobOrder.prod_recieved_by?._id || null,
                workOrderDate: jobOrder.date ? formatDateOnly(jobOrder.date) : null,
                file: jobOrder.files || [],
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by?.username || null,
            },
            jobOrderDetails: {
                job_order_id: jobOrder._id,
                jobOrderNumber: jobOrder.job_order_id,
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by?.username || null,
                status: jobOrder.status,
            },
            productsDetails: productsDetails,
        };

        return res.status(200).json({
            success: true,
            message: 'Internal work order fetched successfully',
            data: responseData,
        });
    } catch (error) {
        console.error('Error fetching internal work order:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching internal work order: ${error.message}`,
        });
    }
});



const getInternalWorkOrderById_11_08_2025 = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        console.log("id", id);
        console.log("came here in internal get by id");

        // Step 1: Fetch the internal work order by ID with populated system and product_system (including processes)
        const internalWorkOrder = await falconInternalWorkOrder
            .findById(id)
            .populate({
                path: 'products.system',
                model: 'falconSystem',
                select: 'name',
                match: { isDeleted: false },
            })
            .populate({
                path: 'products.product_system',
                model: 'falconProductSystem',
                select: 'name processes',  // Added 'processes' assuming it's an array of process IDs in order
                match: { isDeleted: false },
            })
            .lean();

        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal work order not found',
            });
        }

        // Step 2: Fetch the job order details
        const jobOrder = await falconJobOrder
            .findById(internalWorkOrder.job_order_id)
            .populate({
                path: 'work_order_number',
                model: 'falconWorkOrder',
                select: 'work_order_number client_id project_id',
                populate: [
                    {
                        path: 'client_id',
                        model: 'falconClient',
                        select: 'name address',
                        match: { isDeleted: false },
                    },
                    {
                        path: 'project_id',
                        model: 'falconProject',
                        select: 'name',
                        match: { isDeleted: false },
                    },
                ],
            })
            .populate({
                path: 'prod_issued_approved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'prod_recieved_by',
                model: 'Employee',
                select: 'name',
            })
            .populate({
                path: 'created_by',
                model: 'User',
                select: 'username',
            })
            .lean();

        console.log("jobOrder", jobOrder);

        if (!jobOrder) {
            return res.status(404).json({
                success: false,
                message: 'Job order not found',
            });
        }

        if (!jobOrder.work_order_number) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found',
            });
        }

        // Step 3: Fetch product details for internal work order products, including achieved and rejected qty for semi-finished
        const productsDetails = await Promise.all(
            internalWorkOrder.products.map(async (internalProduct) => {
                const jobProduct = jobOrder.products.find(
                    p => String(p.product) === String(internalProduct.product)
                );
                const productDetail = await falconProduct.findById(internalProduct.product).select('name').lean();

                // Get last process ID if product_system has processes
                const lastProcessId = internalProduct.product_system?.processes?.at(-1) || null;

                // Enhance semifinished_details with achieved and rejected quantities
                const enhancedSemifinishedDetails = await Promise.all(
                    (internalProduct.semifinished_details || []).map(async (semi) => {
                        let achievedQty = 0;
                        let rejectedQty = 0;

                        if (lastProcessId) {
                            // Get achieved qty from the last process
                            const lastProduction = await falconProduction.findOne({
                                internal_work_order_id: id,
                                semi_finished_id: semi._id,  // Assuming semi has _id as identifier
                                process_id: lastProcessId,
                            }).select('achieved_qty').lean();
                            achievedQty = lastProduction ? lastProduction.achieved_qty : 0;
                        }

                        // Get sum of all rejected qty across all processes
                        const rejectedAgg = await falconProduction.aggregate([
                            {
                                $match: {
                                    internal_work_order_id: new mongoose.Types.ObjectId(id),
                                    semi_finished_id: new mongoose.Types.ObjectId(semi._id),
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    totalRejected: { $sum: "$rejected_qty" },
                                },
                            },
                        ]);
                        rejectedQty = rejectedAgg.length > 0 ? rejectedAgg[0].totalRejected : 0;

                        return {
                            ...semi,
                            achieved_qty: achievedQty,
                            rejected_qty: rejectedQty,
                        };
                    })
                );

                return {
                    product_name: productDetail ? productDetail.name : null,
                    product_id: internalProduct.product,
                    sales_order_no: internalWorkOrder.sales_order_no,
                    system_name: internalProduct.system?.name || null,
                    system_id: internalProduct.system?._id || null,
                    product_system_name: internalProduct.product_system?.name || null,
                    product_system_id: internalProduct.product_system?._id || null,
                    po_quantity: jobProduct ? jobProduct.po_quantity : internalProduct.po_quantity,
                    planned_quantity: internalProduct.po_quantity,
                    from_date: internalWorkOrder.date?.from ? formatDateOnly(internalWorkOrder.date.from) : null,
                    to_date: internalWorkOrder.date?.to ? formatDateOnly(internalWorkOrder.date.to) : null,
                    uom: jobProduct ? jobProduct.uom : internalProduct.uom,
                    code: jobProduct ? jobProduct.code : internalProduct.code,
                    color_code: jobProduct ? jobProduct.color_code : internalProduct.color_code,
                    width: jobProduct ? jobProduct.width : internalProduct.width,
                    height: jobProduct ? jobProduct.height : internalProduct.height,
                    semifinished_details: enhancedSemifinishedDetails,
                };
            })
        );

        // Step 4: Format the response
        const responseData = {
            clientProjectDetails: {
                clientName: jobOrder.work_order_number?.client_id?.name || null,
                clientId: jobOrder.work_order_number?.client_id?._id || null,
                address: jobOrder.work_order_number?.client_id?.address || null,
                projectName: jobOrder.work_order_number?.project_id?.name || null,
                projectId: jobOrder.work_order_number?.project_id?._id || null,
            },
            workOrderDetails: {
                workOrderNumber: jobOrder.work_order_number?.work_order_number || null,
                productionRequestDate: jobOrder.prod_requset_date ? formatDateOnly(jobOrder.prod_requset_date) : null,
                productionRequirementDate: jobOrder.prod_requirement_date ? formatDateOnly(jobOrder.prod_requirement_date) : null,
                approvedBy: jobOrder.prod_issued_approved_by?.name || null,
                approvedById: jobOrder.prod_issued_approved_by?._id || null,
                receivedBy: jobOrder.prod_recieved_by?.name || null,
                receivedById: jobOrder.prod_recieved_by?._id || null,
                workOrderDate: jobOrder.date ? formatDateOnly(jobOrder.date) : null,
                file: jobOrder.files || [],
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by.username,
            },
            jobOrderDetails: {
                job_order_id: jobOrder._id,
                jobOrderNumber: jobOrder.job_order_id,
                createdAt: jobOrder.createdAt ? formatDateOnly(jobOrder.createdAt) : null,
                createdBy: jobOrder.created_by.username,
                status: jobOrder.status,
            },
            productsDetails: productsDetails,
        };

        return res.status(200).json({
            success: true,
            message: 'Internal work order fetched successfully',
            data: responseData,
        });
    } catch (error) {
        console.error('Error fetching internal work order:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching internal work order: ${error.message}`,
        });
    }
});




const updateInternalWorkOrder_16_07_2025 = asyncHandler(async (req, res) => {
    const { id } = req.params; // Internal work order ID

    try {
        // Fetch the existing internal work order
        let internalWorkOrder = await falconInternalWorkOrder.findById(id);
        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal work order not found',
            });
        }

        // Parse the form-data body
        const bodyData = req.body;

        // Map files to their respective fields
        const filesMap = {};
        req.files.forEach(file => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });

        // Update fields only if they are provided in the request
        if (bodyData.sales_order_no) {
            internalWorkOrder.sales_order_no = bodyData.sales_order_no;
        }

        if (bodyData.date) {
            const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
            const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;

            internalWorkOrder.date.from = parsedDateFrom;
            internalWorkOrder.date.to = parsedDateTo;
        }

        if (bodyData.products) {
            // Parse stringified products field if needed
            if (typeof bodyData.products === 'string') {
                bodyData.products = JSON.parse(bodyData.products);
            }

            internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
                // console.log("product",product);

                // Validate product fields
                if (!product.product || !product.system || !product.product_system || !product.po_quantity) {
                    throw new Error(`Missing required product fields at index ${productIndex}`);
                }

                return {
                    product: product.product,
                    system: product.system,
                    product_system: product.product_system,
                    po_quantity: parseInt(product.po_quantity),
                    semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                        // Validate semifinished detail fields
                        // console.log("sfDetail",sfDetail);
                        if (!sfDetail.semifinished_id || !sfDetail.remarks) {
                            throw new Error(`Missing required semifinished detail fields at index ${sfIndex} in product ${productIndex}`);
                        }

                        const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                        const sfFile = filesMap[sfFileField];

                        let sfFileUrl = sfDetail.file_url || (internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url);
                        // if (sfFile) {
                        //     // console.log("came for sf file");
                        //     if (sfFileUrl) {
                        //         const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                        //         await deleteObject(oldFileKey);
                        //     }

                        //     const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                        //     const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                        //     const sfUploadResult = await putObject(sfFileData, sfFileName);
                        //     sfFileUrl = sfUploadResult.url;
                        //     // console.log("sfFileUrl",sfFileUrl);
                        // }

                        if (sfFile) {
                            const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                            
                            const sfUploadResult = await putObject(
                                { data: sfFile.buffer, mimetype: sfFile.mimetype },
                                sfFileName
                            );
                        
                            sfFileUrl = sfUploadResult.url;
                        }
                        

                        return {
                            semifinished_id: sfDetail.semifinished_id,
                            file_url: sfFileUrl,
                            remarks: sfDetail.remarks,
                            processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                                if (!process.name || !process.remarks) {
                                    throw new Error(`Missing required process fields at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);
                                }

                                const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                const processFile = filesMap[processFileField];

                                let processFileUrl = process.file_url || (internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url);
                                if (processFile) {
                                    // console.log("came for process file");
                                    if (processFileUrl) {
                                        const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                        await deleteObject(oldFileKey);
                                    }

                                    const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                    const processFileData = { data: fs.readFileSync(processFile.path), mimetype: processFile.mimetype };
                                    const processUploadResult = await putObject(processFileData, processFileName);
                                    processFileUrl = processUploadResult.url;
                                    // console.log("processFileUrl",processFileUrl);
                                }

                                return {
                                    name: process.name,
                                    file_url: processFileUrl,
                                    remarks: process.remarks,
                                };
                            })),
                        };
                    })),
                };
            }));
        }

        // Save the updated internal work order
        await internalWorkOrder.save();

        return res.status(200).json({
            success: true,
            message: 'Internal work order updated successfully',
            data: internalWorkOrder,
        });

    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating internal work order: ' + error.message,
        });
    }
});



const updateInternalWorkOrder_07_08_2025 = asyncHandler(async (req, res) => {
    const { id } = req.params; // Internal work order ID

    // Fetch the existing internal work order
    let internalWorkOrder = await falconInternalWorkOrder.findById(id);
    if (!internalWorkOrder) {
        throw new ApiError(404, 'Internal work order not found');
    }

    // Parse the form-data body
    const bodyData = req.body;
    console.log("bodyData", bodyData);

    // Map files to their respective fields
    const filesMap = {};
    if (req.files) {
        req.files.forEach(file => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });
    }

    // Update fields only if they are provided in the request
    if (bodyData.sales_order_no !== undefined) {
        internalWorkOrder.sales_order_no = bodyData.sales_order_no || undefined;
    }

    if (bodyData.date) {
        const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
        const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;
        internalWorkOrder.date.from = parsedDateFrom;
        internalWorkOrder.date.to = parsedDateTo;
    }

    if (bodyData.products) {
        // Parse stringified products field if needed
        if (typeof bodyData.products === 'string') {
            try {
                bodyData.products = JSON.parse(bodyData.products);
            } catch (err) {
                throw new ApiError(400, 'Invalid products JSON format');
            }
        }

        internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
            // Validate required product fields
            if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
            if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
            if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
            if (!product.po_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);

            validateObjectId(product.product, `product at index ${productIndex}`);
            validateObjectId(product.system, `system at index ${productIndex}`);
            validateObjectId(product.product_system, `product_system at index ${productIndex}`);

            return {
                product: product.product,
                system: product.system,
                product_system: product.product_system,
                po_quantity: parseInt(product.po_quantity),
                semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                    // Validate semifinished detail fields
                    if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                    const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                    const sfFile = filesMap[sfFileField];
                    let sfFileUrl = sfDetail.file_url !== undefined ? sfDetail.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url;

                    // Check for file removal intent (e.g., empty file field or remove_file flag)
                    const sfRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][remove_file]`;
                    const sfRemoveFile = bodyData[sfRemoveFileField] === 'true';
                    if (sfRemoveFile && sfFileUrl) {
                        const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                        await deleteObject(oldFileKey);
                        sfFileUrl = undefined;
                    } else if (sfFile) {
                        if (sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                        }
                        const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                        const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                        const sfUploadResult = await putObject(sfFileData, sfFileName);
                        sfFileUrl = sfUploadResult.url;
                    }

                    return {
                        semifinished_id: sfDetail.semifinished_id,
                        file_url: sfFileUrl,
                        remarks: sfDetail.remarks !== undefined ? sfDetail.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.remarks,
                        processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                            if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                            const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                            const processFile = filesMap[processFileField];
                            let processFileUrl = process.file_url !== undefined ? process.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url;

                            // Check for file removal intent
                            const processRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][remove_file]`;
                            const processRemoveFile = bodyData[processRemoveFileField] === 'true';
                            if (processRemoveFile && processFileUrl) {
                                const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                await deleteObject(oldFileKey);
                                processFileUrl = undefined;
                            } else if (processFile) {
                                if (processFileUrl) {
                                    const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                    await deleteObject(oldFileKey);
                                }
                                const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                const processFileData = { data: fs.readFileSync(processFile.path), mimetype: processFile.mimetype };
                                const processUploadResult = await putObject(processFileData, processFileName);
                                processFileUrl = processUploadResult.url;
                            }

                            return {
                                name: process.name,
                                file_url: processFileUrl,
                                remarks: process.remarks !== undefined ? process.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.remarks,
                            };
                        })),
                    };
                })),
            };
        }));
    }

    // Save the updated internal work order
    await internalWorkOrder.save();

    return res.status(200).json(new ApiResponse(200, internalWorkOrder, 'Internal work order updated successfully'));
});


const updateInternalWorkOrder11111 = asyncHandler(async (req, res) => {
    const { id } = req.params; // Internal work order ID

    // Fetch the existing internal work order
    let internalWorkOrder = await falconInternalWorkOrder.findById(id);
    if (!internalWorkOrder) {
        throw new ApiError(404, 'Internal work order not found');
    }

    // Parse the form-data body
    const bodyData = req.body;
    console.log("bodyData", bodyData);

    // Map files to their respective fields
    const filesMap = {};
    if (req.files) {
        req.files.forEach(file => {
            const fieldName = file.fieldname;
            filesMap[fieldName] = file;
        });
    }

    // Update fields only if they are provided in the request
    if (bodyData.sales_order_no !== undefined) {
        internalWorkOrder.sales_order_no = bodyData.sales_order_no || undefined;
    }

    if (bodyData.date) {
        const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
        const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;
        internalWorkOrder.date.from = parsedDateFrom;
        internalWorkOrder.date.to = parsedDateTo;
    }

    if (bodyData.products) {
        // Parse stringified products field if needed
        if (typeof bodyData.products === 'string') {
            try {
                bodyData.products = JSON.parse(bodyData.products);
            } catch (err) {
                throw new ApiError(400, 'Invalid products JSON format');
            }
        }

        internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
            // Validate required product fields
            if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
            if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
            if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
            if (!product.po_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);
            if (!product.code) throw new ApiError(400, `Code is required for product at index ${productIndex}`); // Add code validation

            validateObjectId(product.product, `product at index ${productIndex}`);
            validateObjectId(product.system, `system at index ${productIndex}`);
            validateObjectId(product.product_system, `product_system at index ${productIndex}`);

            return {
                product: product.product,
                system: product.system,
                product_system: product.product_system,
                code: product.code, // Add code field
                po_quantity: parseInt(product.po_quantity),
                semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                    // Validate semifinished detail fields
                    if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                    const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                    const sfFile = filesMap[sfFileField];
                    let sfFileUrl = sfDetail.file_url !== undefined ? sfDetail.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url;

                    // Check for file removal intent (e.g., empty file field or remove_file flag)
                    const sfRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][remove_file]`;
                    const sfRemoveFile = bodyData[sfRemoveFileField] === 'true';
                    if (sfRemoveFile && sfFileUrl) {
                        const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                        await deleteObject(oldFileKey);
                        sfFileUrl = undefined;
                    } else if (sfFile) {
                        if (sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                        }
                        const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                        const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                        const sfUploadResult = await putObject(sfFileData, sfFileName);
                        sfFileUrl = sfUploadResult.url;
                    }

                    return {
                        semifinished_id: sfDetail.semifinished_id,
                        file_url: sfFileUrl,
                        remarks: sfDetail.remarks !== undefined ? sfDetail.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.remarks,
                        processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                            if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                            const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                            const processFile = filesMap[processFileField];
                            let processFileUrl = process.file_url !== undefined ? process.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url;

                            // Check for file removal intent
                            const processRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][remove_file]`;
                            const processRemoveFile = bodyData[processRemoveFileField] === 'true';
                            if (processRemoveFile && processFileUrl) {
                                const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                await deleteObject(oldFileKey);
                                processFileUrl = undefined;
                            } else if (processFile) {
                                if (processFileUrl) {
                                    const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                    await deleteObject(oldFileKey);
                                }
                                const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                const processFileData = { data: fs.readFileSync(processFile.path), mimetype: processFile.mimetype };
                                const processUploadResult = await putObject(processFileData, processFileName);
                                processFileUrl = processUploadResult.url;
                            }

                            return {
                                name: process.name,
                                file_url: processFileUrl,
                                remarks: process.remarks !== undefined ? process.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.remarks,
                            };
                        })),
                    };
                })),
            };
        }));
    }

    // Save the updated internal work order
    await internalWorkOrder.save();

    return res.status(200).json(new ApiResponse(200, internalWorkOrder, 'Internal work order updated successfully'));
});


const updateInternalWorkOrder___WORKING = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Internal work order ID

        // Fetch the existing internal work order
        let internalWorkOrder = await falconInternalWorkOrder.findById(id).session(session);
        if (!internalWorkOrder) {
            throw new ApiError(404, 'Internal work order not found');
        }

        // Parse the form-data body
        const bodyData = req.body;
        console.log("bodyData", bodyData);

        // Map files to their respective fields
        const filesMap = {};
        if (req.files) {
            req.files.forEach(file => {
                const fieldName = file.fieldname;
                filesMap[fieldName] = file;
            });
        }

        // Update fields only if they are provided in the request
        if (bodyData.sales_order_no !== undefined) {
            internalWorkOrder.sales_order_no = bodyData.sales_order_no || undefined;
        }

        if (bodyData.date) {
            const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
            const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;
            internalWorkOrder.date.from = parsedDateFrom;
            internalWorkOrder.date.to = parsedDateTo;
        }

        if (bodyData.products) {
            // Parse stringified products field if needed
            if (typeof bodyData.products === 'string') {
                try {
                    bodyData.products = JSON.parse(bodyData.products);
                } catch (err) {
                    throw new ApiError(400, 'Invalid products JSON format');
                }
            }

            // Map existing products for comparison
            const existingProducts = internalWorkOrder.products.reduce((map, prod) => {
                map[`${prod.product.toString()}-${prod.code}`] = prod;
                return map;
            }, {});

            internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
                // Validate required product fields
                if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
                if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
                if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
                if (!product.po_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);
                if (!product.code) throw new ApiError(400, `Code is required for product at index ${productIndex}`);

                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);

                return {
                    product: product.product,
                    system: product.system,
                    product_system: product.product_system,
                    code: product.code,
                    po_quantity: parseInt(product.po_quantity),
                    semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                        if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                        const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                        const sfFile = filesMap[sfFileField];
                        let sfFileUrl = sfDetail.file_url !== undefined ? sfDetail.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url;

                        const sfRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][remove_file]`;
                        const sfRemoveFile = bodyData[sfRemoveFileField] === 'true';
                        if (sfRemoveFile && sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                            sfFileUrl = undefined;
                        } else if (sfFile) {
                            if (sfFileUrl) {
                                const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                                await deleteObject(oldFileKey);
                            }
                            const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                            const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                            const sfUploadResult = await putObject(sfFileData, sfFileName);
                            sfFileUrl = sfUploadResult.url;
                        }

                        return {
                            semifinished_id: sfDetail.semifinished_id,
                            file_url: sfFileUrl,
                            remarks: sfDetail.remarks !== undefined ? sfDetail.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.remarks,
                            processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                                if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                                const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                const processFile = filesMap[processFileField];
                                let processFileUrl = process.file_url !== undefined ? process.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url;

                                const processRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][remove_file]`;
                                const processRemoveFile = bodyData[processRemoveFileField] === 'true';
                                if (processRemoveFile && processFileUrl) {
                                    const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                    await deleteObject(oldFileKey);
                                    processFileUrl = undefined;
                                } else if (processFile) {
                                    if (processFileUrl) {
                                        const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                        await deleteObject(oldFileKey);
                                    }
                                    const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                    const processFileData = { data: fs.readFileSync(processFile.path), mimetype: processFile.mimetype };
                                    const processUploadResult = await putObject(processFileData, processFileName);
                                    processFileUrl = processUploadResult.url;
                                }

                                return {
                                    name: process.name,
                                    file_url: processFileUrl,
                                    remarks: process.remarks !== undefined ? process.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.remarks,
                                };
                            })),
                        };
                    })),
                };
            }));
        }

        // Save the updated internal work order
        await internalWorkOrder.save({ session });

        // Handle production records
        const jobOrderId = internalWorkOrder.job_order_id;
        const dateFrom = internalWorkOrder.date.from;

        // Fetch existing production records for this internal work order
        const existingProductions = await falconProduction.find({ internal_work_order: id }).session(session);

        // Map existing production records by product and process
        const existingProdMap = {};
        existingProductions.forEach(prod => {
            const key = `${prod.product.product_id.toString()}-${prod.product.code}-${prod.process_name}`;
            existingProdMap[key] = prod;
        });

        // Generate new production records for updated or new products
        const productionDocs = [];
        for (const product of internalWorkOrder.products) {
            for (const sfDetail of product.semifinished_details) {
                sfDetail.processes.forEach((process, index) => {
                    const key = `${product.product.toString()}-${product.code}-${process.name.toLowerCase()}`;
                    const existingProd = existingProdMap[key];

                    const productionData = {
                        job_order: jobOrderId,
                        internal_work_order: id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            width: product.width,
                            height: product.height,
                            po_quantity: product.po_quantity,
                            achieved_quantity: existingProd?.product?.achieved_quantity || 0,
                            rejected_quantity: existingProd?.product?.rejected_quantity || 0,
                            recycled_quantity: existingProd?.product?.recycled_quantity || 0,
                        },
                        process_name: process.name.toLowerCase(),
                        process_sequence: {
                            current: {
                                name: process.name.toLowerCase(),
                                index: index,
                            },
                            previous: index > 0 ? {
                                name: sfDetail.processes[index - 1].name.toLowerCase(),
                                index: index - 1,
                            } : null,
                            next: index < sfDetail.processes.length - 1 ? {
                                name: sfDetail.processes[index + 1].name.toLowerCase(),
                                index: index + 1,
                            } : null,
                        },
                        available_quantity: index === 0 ? product.po_quantity : (existingProd?.available_quantity || 0),
                        status: index === 0 ? 'Pending' : (existingProd?.status || 'Pending'),
                        date: dateFrom,
                        created_by: req.user._id,
                        updated_by: req.user._id,
                    };

                    if (existingProd) {

                        // Update existing production record
                        Object.assign(existingProd, productionData);
                        existingProd.save({ session }); // Ensure this is inside an async context
                    } else {
                        // Create new production record
                        productionDocs.push(productionData);
                    }
                });
            }
        }

        // Insert new production records
        if (productionDocs.length > 0) {
            await falconProduction.insertMany(productionDocs, { session });
        }

        await session.commitTransaction();

        return res.status(200).json(new ApiResponse(200, internalWorkOrder, 'Internal work order and production records updated successfully'));
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in updateInternalWorkOrder:', error);
        throw error;
    } finally {
        session.endSession();
    }
});

const updateInternalWorkOrder_11_08_2025 = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Internal work order ID

        // Fetch the existing internal work order
        let internalWorkOrder = await falconInternalWorkOrder.findById(id).session(session);
        if (!internalWorkOrder) {
            throw new ApiError(404, 'Internal work order not found');
        }

        // Parse the form-data body
        const bodyData = req.body;
        console.log("bodyData", bodyData);

        // Map files to their respective fields
        const filesMap = {};
        if (req.files) {
            req.files.forEach(file => {
                const fieldName = file.fieldname;
                filesMap[fieldName] = file;
            });
        }

        // Update fields only if they are provided in the request
        if (bodyData.sales_order_no !== undefined) {
            internalWorkOrder.sales_order_no = bodyData.sales_order_no || undefined;
        }

        if (bodyData.date) {
            const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
            const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;
            internalWorkOrder.date.from = parsedDateFrom;
            internalWorkOrder.date.to = parsedDateTo;
        }

        if (bodyData.products) {
            if (typeof bodyData.products === 'string') {
                try {
                    bodyData.products = JSON.parse(bodyData.products);
                } catch (err) {
                    throw new ApiError(400, 'Invalid products JSON format');
                }
            }

            // Map existing products for comparison
            const existingProducts = internalWorkOrder.products.reduce((map, prod) => {
                map[`${prod.product.toString()}-${prod.code}`] = prod;
                return map;
            }, {});

            // Map new products
            const newProducts = bodyData.products.reduce((map, prod) => {
                map[`${prod.product}-${prod.code}`] = true;
                return map;
            }, {});

            internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
                if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
                if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
                if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
                if (!product.po_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);
                if (!product.code) throw new ApiError(400, `Code is required for product at index ${productIndex}`);

                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);

                return {
                    product: product.product,
                    system: product.system,
                    product_system: product.product_system,
                    code: product.code,
                    po_quantity: parseInt(product.po_quantity),
                    semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                        if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                        const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                        const sfFile = filesMap[sfFileField];
                        let sfFileUrl = sfDetail.file_url !== undefined ? sfDetail.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url;

                        const sfRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][remove_file]`;
                        const sfRemoveFile = bodyData[sfRemoveFileField] === 'true';
                        if (sfRemoveFile && sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                            sfFileUrl = undefined;
                        } else if (sfFile) {
                            if (sfFileUrl) {
                                const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                                await deleteObject(oldFileKey);
                            }
                            const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                            const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                            const sfUploadResult = await putObject(sfFileData, sfFileName);
                            sfFileUrl = sfUploadResult.url;
                        }

                        return {
                            semifinished_id: sfDetail.semifinished_id,
                            file_url: sfFileUrl,
                            remarks: sfDetail.remarks !== undefined ? sfDetail.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.remarks,
                            processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                                if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                                const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                const processFile = filesMap[processFileField];
                                let processFileUrl = process.file_url !== undefined ? process.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url;

                                const processRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][remove_file]`;
                                const processRemoveFile = bodyData[processRemoveFileField] === 'true';
                                if (processRemoveFile && processFileUrl) {
                                    const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                    await deleteObject(oldFileKey);
                                    processFileUrl = undefined;
                                } else if (processFile) {
                                    if (processFileUrl) {
                                        const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                        await deleteObject(oldFileKey);
                                    }
                                    const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                    const processFileData = { data: fs.readFileSync(processFile.path), mimetype: processFile.mimetype };
                                    const processUploadResult = await putObject(processFileData, processFileName);
                                    processFileUrl = processUploadResult.url;
                                }

                                return {
                                    name: process.name,
                                    file_url: processFileUrl,
                                    remarks: process.remarks !== undefined ? process.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.remarks,
                                };
                            })),
                        };
                    })),
                };
            }));

            // Identify products to remove
            const productsToRemove = [];
            for (const key in existingProducts) {
                if (!newProducts[key]) {
                    const existingProd = existingProducts[key];
                    productsToRemove.push({
                        product_id: existingProd.product.toString(),
                        code: existingProd.code
                    });
                }
            }

            // Delete production records for removed products
            if (productsToRemove.length > 0) {
                console.log('Removing production for:', productsToRemove); // Debug log
                await falconProduction.deleteMany({
                    internal_work_order: id,
                    'product.product_id': { $in: productsToRemove.map(p => p.product_id) },
                    'product.code': { $in: productsToRemove.map(p => p.code) }
                }).session(session);
            }
        }

        // Save the updated internal work order
        await internalWorkOrder.save({ session });

        // Handle production records
        const jobOrderId = internalWorkOrder.job_order_id;
        const dateFrom = internalWorkOrder.date.from;

        // Fetch existing production records for this internal work order
        const existingProductions = await falconProduction.find({ internal_work_order: id }).session(session);

        // Map existing production records by product and process
        const existingProdMap = {};
        existingProductions.forEach(prod => {
            const key = `${prod.product.product_id.toString()}-${prod.product.code}-${prod.process_name}`;
            existingProdMap[key] = prod;
        });

        // Generate and update production records for remaining products
        const productionDocs = [];
        for (const product of internalWorkOrder.products) {
            for (const sfDetail of product.semifinished_details) {
                for (const process of sfDetail.processes) {
                    const index = sfDetail.processes.indexOf(process);
                    const key = `${product.product.toString()}-${product.code}-${process.name.toLowerCase()}`;
                    const existingProd = existingProdMap[key];

                    const productionData = {
                        job_order: jobOrderId,
                        internal_work_order: id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            width: product.width,
                            height: product.height,
                            po_quantity: product.po_quantity,
                            achieved_quantity: existingProd?.product?.achieved_quantity || 0,
                            rejected_quantity: existingProd?.product?.rejected_quantity || 0,
                            recycled_quantity: existingProd?.product?.recycled_quantity || 0,
                        },
                        process_name: process.name.toLowerCase(),
                        process_sequence: {
                            current: { name: process.name.toLowerCase(), index },
                            previous: index > 0 ? { name: sfDetail.processes[index - 1].name.toLowerCase(), index: index - 1 } : null,
                            next: index < sfDetail.processes.length - 1 ? { name: sfDetail.processes[index + 1].name.toLowerCase(), index: index + 1 } : null,
                        },
                        available_quantity: index === 0 ? product.po_quantity : (existingProd?.available_quantity || 0),
                        status: index === 0 ? 'Pending' : (existingProd?.status || 'Pending'),
                        date: dateFrom,
                        created_by: req.user._id,
                        updated_by: req.user._id,
                    };

                    if (existingProd) {
                        console.log('Updating existing production:', existingProd._id, key);
                        if (existingProd instanceof mongoose.Model) {
                            Object.assign(existingProd, productionData);
                            await existingProd.save({ session });
                        } else {
                            console.error('existingProd is not a Mongoose document:', existingProd);
                        }
                    } else {
                        productionDocs.push(productionData);
                    }
                }
            }
        }

        // Insert new production records
        if (productionDocs.length > 0) {
            await falconProduction.insertMany(productionDocs, { session });
        }

        await session.commitTransaction();

        return res.status(200).json(new ApiResponse(200, internalWorkOrder, 'Internal work order and production records updated successfully'));
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in updateInternalWorkOrder:', error);
        throw error;
    } finally {
        session.endSession();
    }
});




const updateInternalWorkOrder_05_09_2025 = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Internal work order ID

        // Fetch the existing internal work order
        let internalWorkOrder = await falconInternalWorkOrder.findById(id).session(session);
        if (!internalWorkOrder) {
            throw new ApiError(404, 'Internal work order not found');
        }

        // Fetch the associated job order to validate po_quantity
        const jobOrder = await falconJobOrder.findById(internalWorkOrder.job_order_id).session(session);
        if (!jobOrder) {
            throw new ApiError(404, 'Associated job order not found');
        }

        // Create a map of job order products for quick lookup
        const jobOrderProductsMap = jobOrder.products.reduce((map, prod) => {
            map[`${prod.product.toString()}-${prod.code}`] = prod.po_quantity;
            return map;
        }, {});

        // Parse the form-data body
        const bodyData = req.body;
        console.log("bodyData", bodyData);

        // Map files to their respective fields
        const filesMap = {};
        if (req.files) {
            req.files.forEach(file => {
                const fieldName = file.fieldname;
                filesMap[fieldName] = file;
            });
        }

        // Update fields only if they are provided in the request
        if (bodyData.sales_order_no !== undefined) {
            internalWorkOrder.sales_order_no = bodyData.sales_order_no || undefined;
        }

        if (bodyData.date) {
            const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
            const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;
            internalWorkOrder.date.from = parsedDateFrom;
            internalWorkOrder.date.to = parsedDateTo;
        }

        if (bodyData.products) {
            if (typeof bodyData.products === 'string') {
                try {
                    bodyData.products = JSON.parse(bodyData.products);
                } catch (err) {
                    throw new ApiError(400, 'Invalid products JSON format');
                }
            }

            // Map existing products for comparison
            const existingProducts = internalWorkOrder.products.reduce((map, prod) => {
                map[`${prod.product.toString()}-${prod.code}`] = prod;
                return map;
            }, {});

            // Map new products
            const newProducts = bodyData.products.reduce((map, prod) => {
                map[`${prod.product}-${prod.code}`] = true;
                return map;
            }, {});

            internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
                console.log("product",product);
                if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
                if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
                if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
                if (!product.planned_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);
                if (!product.code) throw new ApiError(400, `Code is required for product at index ${productIndex}`);

                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);

                // Validate po_quantity against job order
                const productKey = `${product.product}-${product.code}`;
                const jobOrderPoQuantity = jobOrderProductsMap[productKey];
                if (jobOrderPoQuantity === undefined) {
                    throw new ApiError(400, `Product with ID ${product.product} and code ${product.code} at index ${productIndex} not found in job order`);
                }
                const parsedPoQuantity = parseInt(product.planned_quantity);
                if (parsedPoQuantity > jobOrderPoQuantity) {
                    // throw new ApiError(400, `PO quantity (${parsedPoQuantity}) for product at index ${productIndex} exceeds job order PO quantity (${jobOrderPoQuantity})`);
                    throw new ApiError(400, `Quantity exceeds job order PO quantity (${jobOrderPoQuantity})`);
                }

                return {
                    product: product.product,
                    system: product.system,
                    product_system: product.product_system,
                    code: product.code,
                    po_quantity: parsedPoQuantity,
                    semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                        if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);

                        const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                        const sfFile = filesMap[sfFileField];
                        let sfFileUrl = sfDetail.file_url !== undefined ? sfDetail.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url;

                        const sfRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][remove_file]`;
                        const sfRemoveFile = bodyData[sfRemoveFileField] === 'true';
                        if (sfRemoveFile && sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                            sfFileUrl = undefined;
                        } 
                        // else if (sfFile) {
                        //     if (sfFileUrl) {
                        //         const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                        //         await deleteObject(oldFileKey);
                        //     }
                        //     const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                        //     const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                        //     const sfUploadResult = await putObject(sfFileData, sfFileName);
                        //     sfFileUrl = sfUploadResult.url;
                        // }
                    else if (sfFile) {
                        if (sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                        }
                        const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                        const sfUploadResult = await putObject(
                            { data: sfFile.buffer, mimetype: sfFile.mimetype },
                            sfFileName
                        );
                        sfFileUrl = sfUploadResult.url;
                    }
                    

                        return {
                            semifinished_id: sfDetail.semifinished_id,
                            file_url: sfFileUrl,
                            remarks: sfDetail.remarks !== undefined ? sfDetail.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.remarks,
                            processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                                if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);

                                const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                const processFile = filesMap[processFileField];
                                let processFileUrl = process.file_url !== undefined ? process.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url;

                                const processRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][remove_file]`;
                                const processRemoveFile = bodyData[processRemoveFileField] === 'true';
                                if (processRemoveFile && processFileUrl) {
                                    const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                    await deleteObject(oldFileKey);
                                    processFileUrl = undefined;
                                } 
                                // else if (processFile) {
                                //     if (processFileUrl) {
                                //         const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                //         await deleteObject(oldFileKey);
                                //     }
                                //     const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                //     const processFileData = { data: fs.readFileSync(processFile.path), mimetype: processFile.mimetype };
                                //     const processUploadResult = await putObject(processFileData, processFileName);
                                //     processFileUrl = processUploadResult.url;
                                // }
                                else if (processFile) {
                                    if (processFileUrl) {
                                        const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                        await deleteObject(oldFileKey);
                                    }
                                    const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                    const processUploadResult = await putObject(
                                        { data: processFile.buffer, mimetype: processFile.mimetype },
                                        processFileName
                                    );
                                    processFileUrl = processUploadResult.url;
                                }

                                return {
                                    name: process.name,
                                    file_url: processFileUrl,
                                    remarks: process.remarks !== undefined ? process.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.remarks,
                                };
                            })),
                        };
                    })),
                };
            }));

            // Identify products to remove
            const productsToRemove = [];
            for (const key in existingProducts) {
                if (!newProducts[key]) {
                    const existingProd = existingProducts[key];
                    productsToRemove.push({
                        product_id: existingProd.product.toString(),
                        code: existingProd.code
                    });
                }
            }

            // Delete production records for removed products
            if (productsToRemove.length > 0) {
                console.log('Removing production for:', productsToRemove); // Debug log
                await falconProduction.deleteMany({
                    internal_work_order: id,
                    'product.product_id': { $in: productsToRemove.map(p => p.product_id) },
                    'product.code': { $in: productsToRemove.map(p => p.code) }
                }).session(session);
            }
        }

        // Save the updated internal work order
        await internalWorkOrder.save({ session });

        // Handle production records
        const jobOrderId = internalWorkOrder.job_order_id;
        const dateFrom = internalWorkOrder.date.from;

        // Fetch existing production records for this internal work order
        const existingProductions = await falconProduction.find({ internal_work_order: id }).session(session);

        // Map existing production records by product and process
        const existingProdMap = {};
        existingProductions.forEach(prod => {
            const key = `${prod.product.product_id.toString()}-${prod.product.code}-${prod.process_name}`;
            existingProdMap[key] = prod;
        });

        // Generate and update production records for remaining products
        const productionDocs = [];
        for (const product of internalWorkOrder.products) {
            for (const sfDetail of product.semifinished_details) {
                for (const process of sfDetail.processes) {
                    const index = sfDetail.processes.indexOf(process);
                    const key = `${product.product.toString()}-${product.code}-${process.name.toLowerCase()}`;
                    const existingProd = existingProdMap[key];

                    const productionData = {
                        job_order: jobOrderId,
                        internal_work_order: id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            width: product.width,
                            height: product.height,
                            po_quantity: product.po_quantity,
                            achieved_quantity: existingProd?.product?.achieved_quantity || 0,
                            rejected_quantity: existingProd?.product?.rejected_quantity || 0,
                            recycled_quantity: existingProd?.product?.recycled_quantity || 0,
                        },
                        process_name: process.name.toLowerCase(),
                        process_sequence: {
                            current: { name: process.name.toLowerCase(), index },
                            previous: index > 0 ? { name: sfDetail.processes[index - 1].name.toLowerCase(), index: index - 1 } : null,
                            next: index < sfDetail.processes.length - 1 ? { name: sfDetail.processes[index + 1].name.toLowerCase(), index: index + 1 } : null,
                        },
                        available_quantity: index === 0 ? product.po_quantity : (existingProd?.available_quantity || 0),
                        status: index === 0 ? 'Pending' : (existingProd?.status || 'Pending'),
                        date: dateFrom,
                        created_by: req.user._id,
                        updated_by: req.user._id,
                    };

                    if (existingProd) {
                        console.log('Updating existing production:', existingProd._id, key);
                        if (existingProd instanceof mongoose.Model) {
                            Object.assign(existingProd, productionData);
                            await existingProd.save({ session });
                        } else {
                            console.error('existingProd is not a Mongoose document:', existingProd);
                        }
                    } else {
                        productionDocs.push(productionData);
                    }
                }
            }
        }

        // Insert new production records
        if (productionDocs.length > 0) {
            await falconProduction.insertMany(productionDocs, { session });
        }

        await session.commitTransaction();

        return res.status(200).json(new ApiResponse(200, internalWorkOrder, 'Internal work order and production records updated successfully'));
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in updateInternalWorkOrder:', error);
        throw error;
    } finally {
        session.endSession();
    }
});



const updateInternalWorkOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params; // Internal work order ID
        // Fetch the existing internal work order
        let internalWorkOrder = await falconInternalWorkOrder.findById(id).session(session);
        if (!internalWorkOrder) {
            throw new ApiError(404, 'Internal work order not found');
        }
        // Fetch the associated job order to validate po_quantity
        const jobOrder = await falconJobOrder.findById(internalWorkOrder.job_order_id).session(session);
        if (!jobOrder) {
            throw new ApiError(404, 'Associated job order not found');
        }
        // Create a map of job order products for quick lookup
        const jobOrderProductsMap = jobOrder.products.reduce((map, prod) => {
            map[`${prod.product.toString()}-${prod.code}`] = prod.po_quantity;
            return map;
        }, {});

        // Helper function to calculate total allocated quantity (excluding current IWO)
        async function getTotalAllocatedQty(jobOrderId, productId, excludeIwoId) {
            const result = await falconInternalWorkOrder.aggregate([
                { $match: { job_order_id: jobOrderId, _id: { $ne: excludeIwoId } } },
                { $unwind: "$products" },
                { $match: { "products.product": productId } },
                { $group: { _id: "$products.product", totalQty: { $sum: "$products.po_quantity" } } }
            ]);
            return result[0]?.totalQty || 0;
        }

        // Parse the form-data body
        const bodyData = req.body;
        console.log("bodyData", bodyData);
        // Map files to their respective fields
        const filesMap = {};
        if (req.files) {
            req.files.forEach(file => {
                const fieldName = file.fieldname;
                filesMap[fieldName] = file;
            });
        }
        // Update fields only if they are provided in the request
        if (bodyData.sales_order_no !== undefined) {
            internalWorkOrder.sales_order_no = bodyData.sales_order_no || undefined;
        }
        if (bodyData.date) {
            const parsedDateFrom = bodyData.date.from ? parseDate(bodyData.date.from, 'date.from') : internalWorkOrder.date.from;
            const parsedDateTo = bodyData.date.to ? parseDate(bodyData.date.to, 'date.to') : internalWorkOrder.date.to;
            internalWorkOrder.date.from = parsedDateFrom;
            internalWorkOrder.date.to = parsedDateTo;
        }
        if (bodyData.products) {
            if (typeof bodyData.products === 'string') {
                try {
                    bodyData.products = JSON.parse(bodyData.products);
                } catch (err) {
                    throw new ApiError(400, 'Invalid products JSON format');
                }
            }
            // Map existing products for comparison
            const existingProducts = internalWorkOrder.products.reduce((map, prod) => {
                map[`${prod.product.toString()}-${prod.code}`] = prod;
                return map;
            }, {});
            // Map new products
            const newProducts = bodyData.products.reduce((map, prod) => {
                map[`${prod.product}-${prod.code}`] = true;
                return map;
            }, {});

            // Validate quantity for each product in the update
            for (const product of bodyData.products) {
                const productKey = `${product.product}-${product.code}`;
                const jobOrderPoQuantity = jobOrderProductsMap[productKey];
                if (jobOrderPoQuantity === undefined) {
                    throw new ApiError(400, `Product with ID ${product.product} and code ${product.code} not found in job order`);
                }
            
                // Convert product.product to ObjectId if it's a string
                const productId =new mongoose.Types.ObjectId(product.product);
            
                // Get the total quantity already allocated in all IWOs (including current IWO)
                const result = await falconInternalWorkOrder.aggregate([
                    { $match: { job_order_id: internalWorkOrder.job_order_id } },
                    { $unwind: "$products" },
                    { $match: { "products.product": productId } },
                    { $group: { _id: "$products.product", totalQty: { $sum: "$products.po_quantity" } } }
                ]);
                const totalAllocatedQty = result[0]?.totalQty || 0;
            
                // Get the existing quantity for this product in the current IWO
                const existingProduct = internalWorkOrder.products.find(p =>
                    p.product.toString() === product.product.toString() &&
                    p.code === product.code
                );
                const existingQty = existingProduct ? existingProduct.po_quantity : 0;
            
                // Calculate the new total quantity: totalAllocatedQty - existingQty + newQty
                const newQty = parseInt(product.planned_quantity);
                const totalQtyAfterUpdate = totalAllocatedQty - existingQty + newQty;
            
                // Debug logs
                console.log(`Job Order Qty: ${jobOrderPoQuantity}`);
                console.log(`Total Allocated Qty (all IWOs): ${totalAllocatedQty}`);
                console.log(`Existing Qty in this IWO: ${existingQty}`);
                console.log(`New Qty: ${newQty}`);
                console.log(`Total Qty After Update: ${totalQtyAfterUpdate}`);
                console.log(`Is totalQtyAfterUpdate > jobOrderPoQuantity? ${totalQtyAfterUpdate > jobOrderPoQuantity}`);
            
                // Check if the new total quantity exceeds the Job Order quantity
                if (totalQtyAfterUpdate > jobOrderPoQuantity) {
                    throw new ApiError(
                        400,
                        `Cannot update quantity to ${newQty} for product ${product.code}. ` +
                        `Job Order Qty: ${jobOrderPoQuantity}, Total allocated: ${totalAllocatedQty}, ` +
                        `Existing in this IWO: ${existingQty}, New total: ${totalQtyAfterUpdate}.`
                    );
                }
            }
            
            
            

            internalWorkOrder.products = await Promise.all(bodyData.products.map(async (product, productIndex) => {
                console.log("product", product);
                if (!product.product) throw new ApiError(400, `Product ID is required for product at index ${productIndex}`);
                if (!product.system) throw new ApiError(400, `System is required for product at index ${productIndex}`);
                if (!product.product_system) throw new ApiError(400, `Product system is required for product at index ${productIndex}`);
                if (!product.planned_quantity) throw new ApiError(400, `PO quantity is required for product at index ${productIndex}`);
                if (!product.code) throw new ApiError(400, `Code is required for product at index ${productIndex}`);
                validateObjectId(product.product, `product at index ${productIndex}`);
                validateObjectId(product.system, `system at index ${productIndex}`);
                validateObjectId(product.product_system, `product_system at index ${productIndex}`);
                // Validate po_quantity against job order
                const productKey = `${product.product}-${product.code}`;
                const jobOrderPoQuantity = jobOrderProductsMap[productKey];
                if (jobOrderPoQuantity === undefined) {
                    throw new ApiError(400, `Product with ID ${product.product} and code ${product.code} at index ${productIndex} not found in job order`);
                }
                const parsedPoQuantity = parseInt(product.planned_quantity);
                if (parsedPoQuantity > jobOrderPoQuantity) {
                    throw new ApiError(400, `Quantity exceeds job order PO quantity (${jobOrderPoQuantity})`);
                }
                return {
                    product: product.product,
                    system: product.system,
                    product_system: product.product_system,
                    code: product.code,
                    po_quantity: parsedPoQuantity,
                    semifinished_details: await Promise.all(product.semifinished_details.map(async (sfDetail, sfIndex) => {
                        if (!sfDetail.semifinished_id) throw new ApiError(400, `Semifinished ID is required for semifinished_details at index ${sfIndex} in product ${productIndex}`);
                        const sfFileField = `products[${productIndex}][semifinished_details][${sfIndex}][file]`;
                        const sfFile = filesMap[sfFileField];
                        let sfFileUrl = sfDetail.file_url !== undefined ? sfDetail.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.file_url;
                        const sfRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][remove_file]`;
                        const sfRemoveFile = bodyData[sfRemoveFileField] === 'true';
                        if (sfRemoveFile && sfFileUrl) {
                            const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                            await deleteObject(oldFileKey);
                            sfFileUrl = undefined;
                        }
                        else if (sfFile) {
                            if (sfFileUrl) {
                                const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                                await deleteObject(oldFileKey);
                            }
                            const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                            const sfUploadResult = await putObject(
                                { data: sfFile.buffer, mimetype: sfFile.mimetype },
                                sfFileName
                            );
                            sfFileUrl = sfUploadResult.url;
                        }
                        return {
                            semifinished_id: sfDetail.semifinished_id,
                            file_url: sfFileUrl,
                            remarks: sfDetail.remarks !== undefined ? sfDetail.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.remarks,
                            processes: await Promise.all(sfDetail.processes.map(async (process, processIndex) => {
                                if (!process.name) throw new ApiError(400, `Process name is required for process at index ${processIndex} in semifinished_details ${sfIndex}, product ${productIndex}`);
                                const processFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][file]`;
                                const processFile = filesMap[processFileField];
                                let processFileUrl = process.file_url !== undefined ? process.file_url : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.file_url;
                                const processRemoveFileField = `products[${productIndex}][semifinished_details][${sfIndex}][processes][${processIndex}][remove_file]`;
                                const processRemoveFile = bodyData[processRemoveFileField] === 'true';
                                if (processRemoveFile && processFileUrl) {
                                    const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                    await deleteObject(oldFileKey);
                                    processFileUrl = undefined;
                                }
                                else if (processFile) {
                                    if (processFileUrl) {
                                        const oldFileKey = processFileUrl.split('/').slice(3).join('/');
                                        await deleteObject(oldFileKey);
                                    }
                                    const processFileName = `internal-work-orders/processes/${Date.now()}-${sanitizeFilename(processFile.originalname)}`;
                                    const processUploadResult = await putObject(
                                        { data: processFile.buffer, mimetype: processFile.mimetype },
                                        processFileName
                                    );
                                    processFileUrl = processUploadResult.url;
                                }
                                return {
                                    name: process.name,
                                    file_url: processFileUrl,
                                    remarks: process.remarks !== undefined ? process.remarks : internalWorkOrder.products[productIndex]?.semifinished_details[sfIndex]?.processes[processIndex]?.remarks,
                                };
                            })),
                        };
                    })),
                };
            }));
            // Identify products to remove
            const productsToRemove = [];
            for (const key in existingProducts) {
                if (!newProducts[key]) {
                    const existingProd = existingProducts[key];
                    productsToRemove.push({
                        product_id: existingProd.product.toString(),
                        code: existingProd.code
                    });
                }
            }
            // Delete production records for removed products
            if (productsToRemove.length > 0) {
                console.log('Removing production for:', productsToRemove); // Debug log
                await falconProduction.deleteMany({
                    internal_work_order: id,
                    'product.product_id': { $in: productsToRemove.map(p => p.product_id) },
                    'product.code': { $in: productsToRemove.map(p => p.code) }
                }).session(session);
            }
        }
        // Save the updated internal work order
        await internalWorkOrder.save({ session });
        // Handle production records
        const jobOrderId = internalWorkOrder.job_order_id;
        const dateFrom = internalWorkOrder.date.from;
        // Fetch existing production records for this internal work order
        const existingProductions = await falconProduction.find({ internal_work_order: id }).session(session);
        // Map existing production records by product and process
        const existingProdMap = {};
        existingProductions.forEach(prod => {
            const key = `${prod.product.product_id.toString()}-${prod.product.code}-${prod.process_name}`;
            existingProdMap[key] = prod;
        });
        // Generate and update production records for remaining products
        const productionDocs = [];
        for (const product of internalWorkOrder.products) {
            for (const sfDetail of product.semifinished_details) {
                for (const process of sfDetail.processes) {
                    const index = sfDetail.processes.indexOf(process);
                    const key = `${product.product.toString()}-${product.code}-${process.name.toLowerCase()}`;
                    const existingProd = existingProdMap[key];
                    const productionData = {
                        job_order: jobOrderId,
                        internal_work_order: id,
                        semifinished_id: sfDetail.semifinished_id,
                        product: {
                            product_id: product.product,
                            code: product.code,
                            width: product.width,
                            height: product.height,
                            po_quantity: product.po_quantity,
                            achieved_quantity: existingProd?.product?.achieved_quantity || 0,
                            rejected_quantity: existingProd?.product?.rejected_quantity || 0,
                            recycled_quantity: existingProd?.product?.recycled_quantity || 0,
                        },
                        process_name: process.name.toLowerCase(),
                        process_sequence: {
                            current: { name: process.name.toLowerCase(), index },
                            previous: index > 0 ? { name: sfDetail.processes[index - 1].name.toLowerCase(), index: index - 1 } : null,
                            next: index < sfDetail.processes.length - 1 ? { name: sfDetail.processes[index + 1].name.toLowerCase(), index: index + 1 } : null,
                        },
                        available_quantity: index === 0 ? product.po_quantity : (existingProd?.available_quantity || 0),
                        status: index === 0 ? 'Pending' : (existingProd?.status || 'Pending'),
                        date: dateFrom,
                        created_by: req.user._id,
                        updated_by: req.user._id,
                    };
                    if (existingProd) {
                        console.log('Updating existing production:', existingProd._id, key);
                        if (existingProd instanceof mongoose.Model) {
                            Object.assign(existingProd, productionData);
                            await existingProd.save({ session });
                        } else {
                            console.error('existingProd is not a Mongoose document:', existingProd);
                        }
                    } else {
                        productionDocs.push(productionData);
                    }
                }
            }
        }
        // Insert new production records
        if (productionDocs.length > 0) {
            await falconProduction.insertMany(productionDocs, { session });
        }
        await session.commitTransaction();
        return res.status(200).json(new ApiResponse(200, internalWorkOrder, 'Internal work order and production records updated successfully'));
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in updateInternalWorkOrder:', error);
        throw error;
    } finally {
        session.endSession();
    }
});





///////////////////////////////////////////////////////////////////////////////////////////

const deleteInternalWorkOrder = asyncHandler(async (req, res) => {
    let ids = req.body.ids;
    // console.log('ids', ids);

    // Validate input
    if (!ids) {
        return res.status(400).json({
            success: false,
            message: 'No IDs provided',
        });
    }

    // Convert single ID to array if needed
    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    // Check for empty array
    if (ids.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'IDs array cannot be empty',
        });
    }

    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Invalid ID(s): ${invalidIds.join(', ')}`,
        });
    }

    try {
        // Fetch internal work orders to get file URLs before deletion
        const internalWorkOrders = await falconInternalWorkOrder.find({ _id: { $in: ids } });

        // Collect all file URLs to delete from S3
        const fileKeys = [];
        internalWorkOrders.forEach(workOrder => {
            workOrder.products.forEach(product => {
                product.semifinished_details.forEach(semifinished => {
                    // Add semifinished file URL
                    if (semifinished.file_url) {
                        // const fileKey = semifinished.file_url.split('/').pop();
                        // fileKeys.push(fileKey);

                        const urlParts = semifinished.file_url.split('/');
                        // console.log("urlParts",urlParts);
                        const key = urlParts.slice(3).join('/'); // Extract the key part after the bucket name
                        // console.log("key",key);

                        fileKeys.push(key);
                    }

                    // Add process file URLs
                    semifinished.processes.forEach(process => {
                        if (process.file_url) {
                            // const fileKey = process.file_url.split('/').pop();
                            // fileKeys.push(fileKey);

                            const urlParts = process.file_url.split('/');
                            // console.log("urlParts",urlParts);

                            const key = urlParts.slice(3).join('/'); // Extract the key part after the bucket name
                            // console.log("key",key);
                            fileKeys.push(key);
                        }
                    });
                });
            });
        });

        // Delete files from S3
        await Promise.all(fileKeys.map(key => deleteObject(key)));

        // Permanent deletion of internal work orders
        const result = await falconInternalWorkOrder.deleteMany({ _id: { $in: ids } });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No internal work orders found to delete',
            });
        }

        return res.status(200).json({
            success: true,
            message: `${result.deletedCount} internal work order(s) deleted successfully`,
            data: {
                deletedCount: result.deletedCount,
                deletedIds: ids,
            },
        });
    } catch (error) {
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting internal work orders: ' + error.message,
        });
    }
});



const getJobOrderRemainingQuantities = asyncHandler(async (req, res) => {
    const { jobOrderId } = req.query;

    if (!jobOrderId) {
        return res.status(400).json({
            success: false,
            message: 'Job order ID is required',
        });
    }

    // Validate jobOrderId format
    if (!mongoose.Types.ObjectId.isValid(jobOrderId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid job order ID format',
        });
    }

    // Find the job order
    const jobOrder = await falconJobOrder
        .findById(jobOrderId)
        .populate('products.product')
        .lean();

    if (!jobOrder) {
        return res.status(400).json({
            success: false,
            message: 'Job order not found',
        });
    }

    // Fetch all internal work orders for this job order
    const internalWorkOrders = await falconInternalWorkOrder
        .find({ job_order_id: jobOrder._id })
        .lean();

    // Calculate allocated quantities for each product
    const allocatedQuantities = {};
    internalWorkOrders.forEach((iwo) => {
        iwo.products.forEach((prod) => {
            const productId = prod.product.toString();
            allocatedQuantities[productId] = (allocatedQuantities[productId] || 0) + prod.po_quantity;
        });
    });

    // Prepare response with remaining quantities
    const productsWithRemainingQuantities = jobOrder.products.map((prod) => {
        const productId = prod.product._id.toString();
        const totalAllocated = allocatedQuantities[productId] || 0;
        const remainingQuantity = prod.po_quantity - totalAllocated;

        return {
            productId: productId,
            productName: prod.product.name,
            totalQuantity: prod.po_quantity,
            allocatedQuantity: totalAllocated,
            remainingQuantity: remainingQuantity > 0 ? remainingQuantity : 0,
            uom: prod.uom,
            code: prod.code,
            colorCode: prod.color_code,
            width: prod.width,
            height: prod.height,
        };
    });

    return res.status(200).json({
        success: true,
        message: 'Remaining quantities fetched successfully',
        data: {
            jobOrderId: jobOrder._id,
            workOrderId: jobOrder.work_order_number,
            products: productsWithRemainingQuantities,
        },
    });
});




export { getJobOrderAutoFetch, getJobOrderProductDetails, getJobOrderTotalProductDetail, getProductSystem, createInternalWorkOrder, getInternalWorkOrderDetails, getInternalWorkOrderById, updateInternalWorkOrder, deleteInternalWorkOrder, getJobOrderRemainingQuantities };






