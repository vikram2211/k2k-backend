import mongoose from "mongoose";

const shapeSchema = new mongoose.Schema(
  {
    dimension: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    shape_code: {
      type: String,
      required: true,
      trim: true,
    },
    file: {
      file_name: {
        type: String,
        required: true,
      },
      file_url: {
        type: String,
        required: true,
      },
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const ironShape = mongoose.model('ironShape', shapeSchema);