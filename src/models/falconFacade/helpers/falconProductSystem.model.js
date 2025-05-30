import mongoose from "mongoose";

const falconProductSystemSchema = new mongoose.Schema(
  {
    system: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'falconSystem', // Reference to the falconSystem schema
      required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
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

export const falconProductSystem = mongoose.model('falconProductSystem', falconProductSystemSchema);
