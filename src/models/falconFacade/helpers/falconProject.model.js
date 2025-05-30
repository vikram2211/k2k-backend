import mongoose from "mongoose";

const falconProjectSchema = new mongoose.Schema(
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
      ref: 'falconClient', // Reference to the Client schema
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
      status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
          },
  },
  {
    timestamps: true,
  }
);

export const falconProject = mongoose.model('falconProject', falconProjectSchema);
