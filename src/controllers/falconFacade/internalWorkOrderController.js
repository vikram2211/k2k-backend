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
        const internalWorkOrders = await falconInternalWorkOrder.find().select({ job_order_id: 1, date: 1, _id: 1 });
        // console.log("internalWorkOrders", internalWorkOrders);

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
            // console.log("jobOrder", jobOrder);
            const project = jobOrder ? projectMap.get(jobOrder.project_id.toString()) : null;

            return {
                _id: internalOrder._id.toString(), // Add internal work order ID
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

const getInternalWorkOrderById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params; // Assuming the _id is passed as a URL parameter

        // Step 1: Fetch the internal work order by ID
        const internalWorkOrder = await falconInternalWorkOrder.findById(id);
        if (!internalWorkOrder) {
            return res.status(404).json({
                success: false,
                message: 'Internal work order not found',
            });
        }

        // Step 2: Fetch the job order details
        const jobOrder = await falconJobOrder.findById(internalWorkOrder.job_order_id);
        if (!jobOrder) {
            return res.status(404).json({
                success: false,
                message: 'Job order not found',
            });
        }

        // Step 3: Fetch the client and project details
        const client = await falconClient.findById(jobOrder.client_id);
        const project = await falconProject.findById(jobOrder.project_id);

        // Step 4: Fetch the employee details for approvedBy and receivedBy
        const approvedBy = await Employee.findById(jobOrder.prod_issued_approved_by);
        const receivedBy = await Employee.findById(jobOrder.prod_recieved_by);

        // Step 5: Fetch the product details
        const productsDetails = await Promise.all(
            jobOrder.products.map(async (product) => {
                const productDetail = await falconProduct.findById(product.product);
                return {
                    product_name: productDetail ? productDetail.name : null,
                    product_id: product.product,
                    sales_order_no: internalWorkOrder.sales_order_no,
                    system: "system1", // Replace with actual system data if available
                    system_id: "68399c94c1c526ba74b6ad11", // Replace with actual system ID if available
                    product_system: "product system 1", // Replace with actual product system data if available
                    product_system_id: "68399c94c1c526ba74b6ad13", // Replace with actual product system ID if available
                    po_quantity: product.po_quantity,
                    from_date: formatDateOnly(internalWorkOrder.date.from),
                    to_date: formatDateOnly(internalWorkOrder.date.to),
                    uom: product.uom,
                    code: product.code,
                    color_code: product.color_code,
                    width: product.width,
                    height: product.height,
                };
            })
        );

        // Step 6: Format the response
        const responseData = {
            clientProjectDetails: {
                clientName: client ? client.name : null,
                clientId: client ? client._id : null,
                address: client ? client.address : null,
                projectName: project ? project.name : null,
                projectId: project ? project._id : null,
            },
            workOrderDetails: {
                workOrderNumber: jobOrder.work_order_number,
                productionRequestDate: formatDateOnly(jobOrder.prod_requset_date),
                productionRequirementDate: formatDateOnly(jobOrder.prod_requirement_date),
                approvedBy: approvedBy ? approvedBy.name : null,
                approvedById: approvedBy ? approvedBy._id : null,
                receivedBy: receivedBy ? receivedBy.name : null,
                receivedById: receivedBy ? receivedBy._id : null,
                workOrderDate: formatDateOnly(jobOrder.date),
                file: jobOrder.files,
                createdAt: formatDateOnly(jobOrder.createdAt),
                createdBy: "admin", // Replace with actual createdBy data if available
            },
            jobOrderDetails: {
                jobOrderNumber: jobOrder.job_order_id,
                createdAt: formatDateOnly(jobOrder.createdAt),
                createdBy: "admin", // Replace with actual createdBy data if available
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
        console.log('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching internal work order: ' + error.message,
        });
    }
});


const updateInternalWorkOrder = asyncHandler(async (req, res) => {
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








export { getJobOrderAutoFetch, getJobOrderProductDetails, getJobOrderTotalProductDetail, getProductSystem, createInternalWorkOrder, getInternalWorkOrderDetails, getInternalWorkOrderById, updateInternalWorkOrder, deleteInternalWorkOrder };






