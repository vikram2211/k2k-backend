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

const consumptionHistorySchema = new mongoose.Schema({
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ironWorkOrder',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

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
    consumptionHistory: [consumptionHistorySchema], // Tracks quantity per work order
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