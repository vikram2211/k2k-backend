// models/Machine.js
import mongoose from "mongoose";

const machineSchema = new mongoose.Schema(
  {
    // client_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Client',
    //   required: true,
    // },
    plant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false, // Default to false (not deleted)
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

export const Machine = mongoose.model('Machine', machineSchema);
