import mongoose from 'mongoose';

const qcCheckSchema = new mongoose.Schema(
  {
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      required: true,
    },
    job_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobOrder',
      required: true,
    },
    // product_order: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'ProductOrder', // Assuming a separate product order schema exists
    //   required: true,
    // },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    production_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyProduction', required: true },

    rejected_quantity: {
      type: Number,
      default: 0, // Defective products identified
      required: true,
    },
    recycled_quantity: {
      type: Number,
      default: 0, // Recycled products after rejection
      required: true,
    },
    remarks: {
      type: String, // Additional comments on QC check
      trim: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // QC created by operator
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Last updated by an operator or supervisor
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  { timestamps: true } // Auto tracks createdAt and updatedAt
);

export const QCCheck = mongoose.model('QCCheck', qcCheckSchema);