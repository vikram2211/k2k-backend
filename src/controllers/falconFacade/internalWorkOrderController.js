import { falconJobOrder } from "../../models/falconFacade/falconJobOrder.model.js";
import { falconClient } from "../../models/falconFacade/helpers/falconClient.model.js";
import { falconProject } from "../../models/falconFacade/helpers/falconProject.model.js";
import { falconProductSystem } from "../../models/falconFacade/helpers/falconProductSystem.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";


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

export { getJobOrderAutoFetch, getJobOrderProductDetails };