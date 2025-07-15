import mongoose from "mongoose";

const rawMaterialSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironProject',
      required: true,
    },
    diameter: {
      type: Number,
      required: true,
    },
    qty: {
      type: Number,
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

export const RawMaterial = mongoose.model('RawMaterial', rawMaterialSchema);