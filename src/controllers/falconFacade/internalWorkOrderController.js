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


const getJobOrderTotalProductDetail = asyncHandler(async (req, res) => {
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

const createInternalWorkOrder22_07_2025 = asyncHandler(async (req, res) => {
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
    console.log("bodyData",bodyData);
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
            console.log("product***",product);
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

const createInternalWorkOrder = asyncHandler(async (req, res) => {
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
const getInternalWorkOrderById = asyncHandler(async (req, res) => {
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
                        if (sfFile) {
                            // console.log("came for sf file");
                            if (sfFileUrl) {
                                const oldFileKey = sfFileUrl.split('/').slice(3).join('/');
                                await deleteObject(oldFileKey);
                            }

                            const sfFileName = `internal-work-orders/semifinished/${Date.now()}-${sanitizeFilename(sfFile.originalname)}`;
                            const sfFileData = { data: fs.readFileSync(sfFile.path), mimetype: sfFile.mimetype };
                            const sfUploadResult = await putObject(sfFileData, sfFileName);
                            sfFileUrl = sfUploadResult.url;
                            // console.log("sfFileUrl",sfFileUrl);
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



const updateInternalWorkOrder = asyncHandler(async (req, res) => {
    const { id } = req.params; // Internal work order ID

    // Fetch the existing internal work order
    let internalWorkOrder = await falconInternalWorkOrder.findById(id);
    if (!internalWorkOrder) {
        throw new ApiError(404, 'Internal work order not found');
    }

    // Parse the form-data body
    const bodyData = req.body;

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






