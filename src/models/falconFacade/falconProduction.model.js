import mongoose from "mongoose";
const productionSchema = new mongoose.Schema(
  {
    job_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'falconJobOrder',
      required: true,
    },
    semifinished_id: {
      type: String,
      required: true,
    },
    product: {
      product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'falconProduct',
        required: true,
      },
      po_quantity: {
        type: Number,
        required: true,
      },
      achieved_quantity: {
        type: Number,
        required: true,
        default: 0,
      },
      // rejected_quantity: {
      //   type: Number,
      //   default: 0,
      // },
      // recycled_quantity: {
      //   type: Number,
      //   default: 0,
      // },
    },
    process_name: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        return today;
      },
    },
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    started_at: {
      type: Date,
      required: false,
    },
    qc_checked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    status: {
      type: String,
      enum: ['Pending', 'Pending QC', 'Approved', 'Rejected', 'In Progress', 'Paused'],
      default: 'Pending',
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  { timestamps: true }
);

export const falconProduction = mongoose.model('falconProduction', productionSchema);