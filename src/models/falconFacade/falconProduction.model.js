// import mongoose from "mongoose";
// const productionSchema = new mongoose.Schema(
//   {
//     job_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'falconJobOrder',
//       required: true,
//     },
//     semifinished_id: {
//       type: String,
//       required: true,
//     },
//     product: {
//       product_id: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'falconProduct',
//         required: true,
//       },
//       code: {
//         type: String,
//         required: true, // Make required if code is always provided
//       },
//       width: {
//         type: Number,
//         required: false, // Optional, as you mentioned width may not always be provided
//       },
//       height: {
//         type: Number,
//         required: false, // Optional, as you mentioned height may not always be provided
//       },
//       po_quantity: {
//         type: Number,
//         required: true,
//       },
//       achieved_quantity: {
//         type: Number,
//         required: true,
//         default: 0,
//       },
//       rejected_quantity: {
//         type: Number,
//         default: 0,
//       },
//       recycled_quantity: {
//         type: Number,
//         default: 0,
//       },
//     },
//     process_name: {
//       type: String,
//       required: true,
//     },
//     date: {
//       type: Date,
//       required: true,
//       default: () => {
//         const today = new Date();
//         today.setUTCHours(0, 0, 0, 0);
//         return today;
//       },
//     },
//     submitted_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: false,
//     },
//     started_at: {
//       type: Date,
//       required: false,
//     },
//     qc_checked_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: false,
//     },
//     status: {
//       type: String,
//       enum: ['Pending', 'Pending QC', 'Approved', 'Rejected', 'In Progress', 'Paused'],
//       default: 'Pending',
//     },
//     created_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: false,
//     },
//     updated_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: false,
//     },
//   },
//   { timestamps: true }
// );

// export const falconProduction = mongoose.model('falconProduction', productionSchema);


////////////////////////////////////////////////////////////////////////////////////

//22-07-2025


import mongoose from 'mongoose';

const falconProductionSchema = new mongoose.Schema(
  {
    job_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'falconJobOrder',
      required: true,
    },
    internal_work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'falconInternalWorkOrder',
      required: true,
    },
    product: {
      product_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      code: {
        type: String,
        required: true,
      },
      width: Number,
      height: Number,
      po_quantity: {
        type: Number,
        required: true,
        min: 0,
      },
      achieved_quantity: {
        type: Number,
        default: 0,
        min: 0,
      },
      rejected_quantity: {
        type: Number,
        default: 0,
        min: 0,
      },
      recycled_quantity: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    semifinished_id: {
      type: String,
      required: true,
    },
    process_sequence: {
      current: {
        name: String,
        index: Number,
      },
      previous: {
        name: String,
        index: Number,
        production_id: mongoose.Schema.Types.ObjectId,
      },
      next: {
        name: String,
        index: Number,
      },
    },
    available_quantity: {
      type: Number,
      default: 0,
    },
    process_name: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    started_at: Date,
    completed_at: Date,
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Pending QC', 'Completed', 'Rejected', 'Blocked'],
      default: 'Pending',
    },
    remarks: String,
    invite_qc:{
      type: Boolean,
      default: false
    },
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
  { timestamps: true }
);

// Add indexes for better performance
falconProductionSchema.index({
  job_order: 1,
  semifinished_id: 1,
  'product.product_id': 1,
  'product.code': 1,
  'process_sequence.current.index': 1,
});

export const falconProduction = mongoose.model('falconProduction', falconProductionSchema);