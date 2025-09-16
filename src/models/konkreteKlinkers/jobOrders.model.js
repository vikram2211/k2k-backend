import mongoose from 'mongoose';

const jobOrderSchema = new mongoose.Schema(
  {
    job_order_id: {
      type: String,
      required: true,
      unique: true, // Ensure uniqueness in the database
    },
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder', // Reference to the WorkOrder schema
      required: true,
    },
    sales_order_number: {
      type: String,
      trim: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        machine_name: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Machine',
          required: true,
        },
        planned_quantity: {
          type: Number,
          required: true,
        },
        scheduled_date: {
          type: Date,
          required: true,
        },
      },
    ],
    batch_date: {
      type: Date,
      required: false
    },

    date: {
      from: {
        type: Date,
        required: true,
      },
      to: {
        type: Date,
        required: true,
      },
    },
    
    // plant_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Plant',
    //   required: true,
    // },
    // factory_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Factory',
    //   required: true,
    // },
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
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'In Progress'], // Suggested statuses
      default: 'Pending',
    },
  },
  { timestamps: true },
);

export const JobOrder = mongoose.model('JobOrder', jobOrderSchema);
