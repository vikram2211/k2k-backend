import { falconJobOrder } from "../../models/falconFacade/falconJobOrder.model.js";
import { falconProductSystem } from "../../models/falconFacade/helpers/falconProductSystem.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";
import fs from 'fs';
import path from 'path';
import { putObject } from "../../../util/putObject.js";
import { falconInternalWorkOrder } from "../../models/falconFacade/falconInternalWorder.model.js";
import {falconProject} from '../../models/falconFacade/helpers/falconProject.model.js'


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

    // 3. Format the response
    const formattedResponse = {
        workOrderNumber: jobOrder.work_order_number,
        clientName: jobOrder.client_id?.name || 'N/A',
        projectName: jobOrder.project_id?.name || 'N/A',
        // products: jobOrder.products.map(product => ({
        //     code: product.code,
        //     colorCode: product.color_code,
        //     height: product.height,
        //     width: product.width,
        // })),
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
const createInternalWorkOrder = asyncHandler(async (req, res) => {
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
const getInternalWorkOrderDetails = asyncHandler(async (req, res) => {
    try {
        // Step 1: Fetch all internal work orders
        const internalWorkOrders = await falconInternalWorkOrder.find().select({ job_order_id: 1, date: 1 });

        // Extract unique job_order_id values
        const jobOrderIds = [...new Set(internalWorkOrders.map(order => order.job_order_id))];

        // Step 2: Fetch all corresponding job orders in a single query
        const jobOrders = await falconJobOrder.find({ '_id': { $in: jobOrderIds } });

        // Create a map for job orders for quick lookup
        const jobOrderMap = new Map(jobOrders.map(jobOrder => [jobOrder._id.toString(), jobOrder]));

        // Extract unique project_id values from job orders
        const projectIds = [...new Set(jobOrders.map(jobOrder => jobOrder.project_id.toString()))];

        // Step 3: Fetch all corresponding projects in a single query
        const projects = await falconProject.find({ '_id': { $in: projectIds } });

        // Create a map for projects for quick lookup
        const projectMap = new Map(projects.map(project => [project._id.toString(), project]));

        // Step 4: Combine and restructure the data
        const detailedInternalWorkOrders = internalWorkOrders.map(internalOrder => {
            const jobOrder = jobOrderMap.get(internalOrder.job_order_id.toString());
            const project = jobOrder ? projectMap.get(jobOrder.project_id.toString()) : null;

            return {
                job_order_id: jobOrder ? jobOrder.job_order_id : null,
                from_date: jobOrder ? formatDateOnly(internalOrder.date.from) : null,
                to_date: jobOrder ? formatDateOnly(internalOrder.date.to) : null,
                work_order_number: jobOrder ? jobOrder.work_order_number : null,
                project_name: project ? project.name : null,
            };
        });

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








export { getJobOrderAutoFetch, getJobOrderProductDetails, getJobOrderTotalProductDetail, getProductSystem, createInternalWorkOrder, getInternalWorkOrderDetails };






