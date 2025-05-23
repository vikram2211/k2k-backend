// models/Machine.js
import mongoose from "mongoose";

const machineSchema = new mongoose.Schema(
  {
 

    name: {
      type: String,
      required: true,
    },  
      role: {
      type: String,
      required: true,
    },

   
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

export const Machine = mongoose.model('Machine', machineSchema);
