// import mongoose from "mongoose";

// const rawMaterialSchema = new mongoose.Schema(
//   {
//     project: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'ironProject',
//       required: true,
//     },
//     diameter: {
//       type: Number,
//       required: true,
//     },
//     qty: {
//       type: Number,
//       required: true,
//     },
//     isDeleted: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// export const RawMaterial = mongoose.model('RawMaterial', rawMaterialSchema);






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
    type: {
      type: String,
      required: true, // Matches the Diameter type
    },
    qty: {
      type: Number,
      required: true,
    },
    convertedQty: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    consumptionHistory: [
      {
        // workOrderId: { type: String },
        workOrderId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'ironWorkOrder', 
          required: true 
        },
        workOrderNumber: { type: String },
        quantity: { type: Number },
        timestamp: { type: Date },
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

export const RawMaterial = mongoose.model('RawMaterial', rawMaterialSchema);