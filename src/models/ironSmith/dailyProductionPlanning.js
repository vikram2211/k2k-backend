import mongoose from 'mongoose';

const dailyProductionSchema = new mongoose.Schema(
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
    products: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        achieved_quantity: {
          type: Number,
          required: true,
          default: 0, // Quantity successfully produced
        },
        rejected_quantity: {
          type: Number,
          default: 0, // Defective products identified
        },
        recycled_quantity: {
          type: Number,
          default: 0, // Quantity of rejected products recycled
        },
      },
    ],
    date: {
      type: Date,
      required: true,
      default: Date.now, // Production entry date
    },
    qc_checked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // QC conducted by plant supervisor or operator
    },

    status: {
      type: String,
      enum: ['Pending QC', 'Approved', 'Rejected', 'In Progress'],
      default: 'Pending QC',
    },
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    downtime: [
      {
        description: {
          type: String,
          required: true, // Brief description of the issue
        },
        minutes: {
          type: Number,
          required: true, // Duration of downtime in minutes
        },
        remarks: {
          type: String, // Additional comments
        },
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

export const DailyProduction = mongoose.model('DailyProduction', dailyProductionSchema);
