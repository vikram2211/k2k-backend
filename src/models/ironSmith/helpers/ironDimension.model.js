// models/Machine.js
import mongoose from "mongoose";

const dimensionSchema = new mongoose.Schema(
  {
 
    dimension_name: {
      type: String,
      required: true,
    },  
      dimension_count: {
      type: Number,
      required: true,
    },
    
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

export const ironDimension = mongoose.model('ironDimension', dimensionSchema);
