import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
 
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client', // Reference to the Client schema
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
    timestamps: true,
  }
);

export const Project = mongoose.model('Project', projectSchema);
