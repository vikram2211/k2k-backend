import mongoose from 'mongoose';

// const dailyProductionSchema = new mongoose.Schema(
//   {
//     work_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'WorkOrder',
//       required: true,
//     },
//     job_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'JobOrder',
//       required: true,
//     },
//     products: [
//       {
//         product_id: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: 'Product',
//           required: true,
//         },
//         achieved_quantity: {
//           type: Number,
//           required: true,
//           default: 0, // Quantity successfully produced
//         },
//         rejected_quantity: {
//           type: Number,
//           default: 0, // Defective products identified
//         },
//         recycled_quantity: {
//           type: Number,
//           default: 0, // Quantity of rejected products recycled
//         },
//       },
//     ],
//     date: {
//       type: Date,
//       required: true,
//       default: Date.now, // Production entry date
//     },
//     qc_checked_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User', // QC conducted by plant supervisor or operator
//     },

//     status: {
//       type: String,
//       enum: ['Pending QC', 'Approved', 'Rejected', 'In Progress'],
//       default: 'Pending QC',
//     },
//     submitted_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     started_at: {
//       type: Date,
//       required: true,
//     },
//     stopped_at: {
//       type: Date,
//       required: true,
//     },
//     downtime: [
//       {
//         description: {
//           type: String,
//           required: true, // Brief description of the issue
//         },
//         minutes: {
//           type: Number,
//           required: true, // Duration of downtime in minutes
//         },
//         remarks: {
//           type: String, // Additional comments
//         },
//       },
//     ],
//     created_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     updated_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//   },
//   { timestamps: true },
// );

///WORKING FINE , CAN TAKE THIS ALSO - 
// const dailyProductionSchema = new mongoose.Schema(
//   {
//     work_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'WorkOrder',
//       required: true,
//     },
//     job_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'JobOrder',
//       required: true,
//     },
//     products: [
//       {
//         product_id: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: 'Product',
//           required: true,
//         },
//         achieved_quantity: {
//           type: Number,
//           required: true,
//           default: 0, // Quantity successfully produced
//         },
//         rejected_quantity: {
//           type: Number,
//           default: 0, // Defective products identified
//         },
//         recycled_quantity: {
//           type: Number,
//           default: 0, // Quantity of rejected products recycled
//         },
//       },
//     ],
//     date: {
//       type: Date,
//       required: true,
//       default: () => {
//         const today = new Date();
//         today.setUTCHours(0, 0, 0, 0); // Set to midnight UTC
//         return today;
//       }, // Production entry date (only date, no time)
//     },
//     submitted_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: false,
//     },
//     started_at: {
//       type: Date,
//       required: false,
//       // default: Date.now, // Timestamp when production starts
//     },
//     stopped_at: {
//       type: Date,
//       required: false, // Timestamp when production stops, optional until set
//     },
//     qc_checked_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User', // QC conducted by plant supervisor or operator
//       required:false
//     },
//     status: {
//       type: String,
//       enum: ['Pending QC', 'Approved', 'Rejected', 'In Progress'],
//       default: 'Pending QC',
//     },

//     downtime: [
//       {
//         downtime_start_time: {
//           type: Date,
//           required: false, // Optional, stores full timestamp (date and time)
//         },
//         description: {
//           type: String,
//           required: false, // Brief description of the issue
//         },
//         minutes: {
//           type: Number,
//           required: false, // Duration of downtime in minutes
//         },
//         remarks: {
//           type: String, // Additional comments
//         },
//       },
//     ],
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
// export const DailyProduction = mongoose.model('DailyProduction', dailyProductionSchema);


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
        // objId: {
        //   type: mongoose.Schema.Types.ObjectId,
        //   required: true,
        // },
        achieved_quantity: {
          type: Number,
          required: true,
          default: 0,
        },
        rejected_quantity: {
          type: Number,
          default: 0,
        },
        recycled_quantity: {
          type: Number,
          default: 0,
        },
      },
    ],
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
    stopped_at: {
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
    production_logs: [
      {
        action: {
          type: String,
          enum: ['Start', 'Pause', 'Resume', 'Stop'],
          required: true,
        },
        timestamp: {
          type: Date,
          required: true,
          default: Date.now,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        description: {
          type: String,
        },
      },
    ],
    downtime: [
      {
        downtime_start_time: {
          type: Date,
          required: false,
        },
        description: {
          type: String,
          required: false,
        },
        minutes: {
          type: Number,
          required: false,
        },
        remarks: {
          type: String,
        },
      },
    ],
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

export const DailyProduction = mongoose.model('DailyProduction', dailyProductionSchema);
