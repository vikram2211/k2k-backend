import { ironProject } from "../../../models/ironSmith/helpers/ironProject.model.js";
import { ironShape } from "../../../models/ironSmith/helpers/ironShape.model.js";
import { ironDimension } from "../../../models/ironSmith/helpers/ironDimension.model.js";
import { RawMaterial } from "../../../models/ironSmith/helpers/client-project-qty.model.js";
import { ironJobOrder } from "../../../models/ironSmith/jobOrders.model.js";
import { ironWorkOrder } from "../../../models/ironSmith/workOrder.model.js";
import mongoose from "mongoose";
import { ApiError } from '../../../utils/ApiError.js';



const getIronProjectBasedOnClient = async (req, res, next) => {
    try {
        console.log("came in get projects");
        const clientId = req.query.clientId;
        console.log("body", clientId);

        let getProjectByClient = await ironProject.find({ client: clientId }).select({ name: 1 });
        console.log("getProjectByClient", getProjectByClient);

        const validProjects = getProjectByClient.filter((project) => project.client !== null);

        if (!validProjects || validProjects.length === 0) {
            return next(new ApiError(404, 'No active projects found for this client'));
        }

        // return res.status(200).json(
        //   new ApiResponse(200, validProjects, 'Projects fetched successfully')
        // );
        return res.status(200).json({ success: true, message: "Projects", data: validProjects });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const formattedErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message,
            }));
            return res.status(400).json({ success: false, errors: formattedErrors });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ${error.path}: ${error.value}`,
            });
        }

        // Handle other errors
        console.error("Error fetching work orders:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}



const getIronDimensionBasedOnShape = async (req, res, next) => {
    try {
      const { shapeId } = req.params;
  
      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(shapeId)) {
        return res.status(400).json({ success: false, message: "Invalid shape ID" });
      }
  
      // Find shape by ID and populate the dimension
      const shape = await ironShape.findById(shapeId).populate('dimension');
  
      if (!shape) {
        return res.status(404).json({ success: false, message: "Shape not found" });
      }
  
      // Return only the dimension
      return res.status(200).json({
        success: true,
        data: shape.dimension
      });
  
    } catch (error) {
      if (error.name === 'ValidationError') {
        const formattedErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
        }));
        return res.status(400).json({ success: false, errors: formattedErrors });
      }
  
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: `Invalid ${error.path}: ${error.value}`,
        });
      }
  
      console.error("Error fetching dimension by shape:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };
  

const getDimensions = async (req, res) => {
    try {
        const dimensions = await ironDimension.find({}, '_id dimension_name').lean();

        return res.status(200).json({
            status: 'success',
            data: dimensions,
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const formattedErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message,
            }));
            return res.status(400).json({ success: false, errors: formattedErrors });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ${error.path}: ${error.value}`,
            });
        }

        // Handle other errors
        console.error("Error fetching work orders:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getWorkOrderProductByJobOrder = async (req, res) => {
  try {
    let joId = req.params.id;
    const jobOrders = await ironJobOrder.find({_id:joId }) // Exclude cancelled orders if desired
      .populate({
        path: 'work_order',
        select: 'workOrderNumber _id', // Fetch workOrderNumber and _id
        model: 'ironWorkOrder',
      })
      .populate({
        path: 'products.shape',
        select: 'shape_code description', // Fetch shape_code and description
        model: 'ironShape',
      })
      .lean();
      jobOrders.map(jobOrder => (jobOrder.products.map(product => (console.log("product",product)))))
      // console.log("jobOrders",jobOrders.products);

    const formattedJobOrders = jobOrders.map(jobOrder => ({
      jobOrderNumber: jobOrder.job_order_number,
      workOrderNumber: jobOrder.work_order?.workOrderNumber || 'N/A',
      workOrderId: jobOrder.work_order?._id?.toString() || 'N/A',
      products: jobOrder.products.map(product => ({
        objectId: product._id.toString(), // The _id of the product in the products array
        shapeId: product.shape._id.toString(), // The _id of the product in the products array
        shapeName: `${product.shape?.shape_code || ''} - ${product.shape?.description || ''}`.trim() || 'N/A',
        plannedQuantity: product.planned_quantity,
        scheduleDate: product.schedule_date,
        dia: product.dia,
        achievedQuantity: product.achieved_quantity,
        rejectedQuantity: product.rejected_quantity,
      })),
      status: jobOrder.status,
      createdAt: jobOrder.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: 'Job order details retrieved successfully',
      data: formattedJobOrders,
    });
  } catch (error) {
    console.error('Error fetching job order details:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getRawMaterialDataByProjectId = async (req, res) => {
  const { projectId } = req.params;

  // Validate projectId
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
      // throw new ApiError(400, `Provided Project ID (${projectId}) is not a valid ObjectId`);
      return res.status(400).json({success:false,message:"Provided Project ID is not a valid ObjectId"})
  }

  try {
      // Fetch raw materials for the given project ID, excluding deleted ones
      const rawMaterials = await RawMaterial.find({ project: projectId, isDeleted: false })
          .lean();

      // If no raw materials are found, return an empty array
      if (!rawMaterials || rawMaterials.length === 0) {
          // return sendResponse(res, new ApiResponse(200, [], 'No raw material data found for the given project ID'));
          return res.status(200).json({success:false,message:"No raw material data found for the given project ID"})

      }

      // Group quantities by diameter
      const rawMaterialData = rawMaterials.reduce((acc, material) => {
          const existingMaterial = acc.find(item => item.diameter === material.diameter);
          if (existingMaterial) {
              existingMaterial.qty += material.qty; // Sum quantities for duplicate diameters
          } else {
              acc.push({ diameter: material.diameter, qty: material.qty });
          }
          return acc;
      }, []);

      // Return the processed data
      // return sendResponse(res, new ApiResponse(200, rawMaterialData, 'Raw material data fetched successfully'));
      return res.status(200).json({success:true,rawMaterialData,message:"Raw material data fetched successfully"})

  } catch (error) {
      console.error('Error fetching raw material data:', error);
      // throw new ApiError(500, 'Internal Server Error', error.message);
      return res.status(500).json({success:false,message:error.message})

  }
};

export { getIronProjectBasedOnClient, getIronDimensionBasedOnShape, getDimensions, getWorkOrderProductByJobOrder, getRawMaterialDataByProjectId  };