// models/Diameter.js
import mongoose from "mongoose";

const diameterSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironProject',
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    // type: {
    //   type: String,
    //   required: true, // New field for Type
    // },
    added: [
      {
          rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
        quantity: { type: Number, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    subtracted: [
      {
        quantity: { type: Number, required: true },
        workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironWorkOrder' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: same diameter value can exist for different projects
// But prevents duplicate diameter values within the same project
diameterSchema.index({ project: 1, value: 1 }, { unique: true });

export const Diameter = mongoose.model('Diameter', diameterSchema);
