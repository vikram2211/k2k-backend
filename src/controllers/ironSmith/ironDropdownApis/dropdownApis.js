import { ironProject } from "../../../models/ironSmith/helpers/ironProject.model.js";
import { ironShape } from "../../../models/ironSmith/helpers/ironShape.model.js";
import { ironDimension } from "../../../models/ironSmith/helpers/ironDimension.model.js";
import mongoose from "mongoose";


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
export { getIronProjectBasedOnClient, getIronDimensionBasedOnShape, getDimensions  };