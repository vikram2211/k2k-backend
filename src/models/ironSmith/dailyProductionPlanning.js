import mongoose from 'mongoose';

const ironDailyProductionSchema = new mongoose.Schema(
  {
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironWorkOrder',
      required: true,
    },
    job_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironJobOrder',
      required: true,
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Color',
      required: true,
    },
    products: [
      {
        shape_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ironShape',
          required: true,
        },
        object_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ironJobOrder.products', // Reference to the products array _id in ironJobOrder
          required: true,
        },
        // color: {
        //   type: mongoose.Schema.Types.ObjectId,
        //   ref: 'Color',
        //   required: true,
        // },
        planned_quantity: {
          type: Number,
          required: true,
        },
        machines: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ironMachine',
          },
        ],
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
    // date: {
    //   type: Date,
    //   required: true,
    //   default: Date.now, // Production entry date
    // },
    qc_checked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // QC conducted by plant supervisor or operator
    },

    status: {
      type: String,
      enum: ['Pending', 'Pending QC', 'Approved', 'Rejected', 'In Progress', 'Paused','Packed'],
      default: 'Pending',
    },
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    started_at: {
      type: Date,
      required: false,
    },
    stopped_at: {
      type: Date,
      required: false,
    },
   
    production_logs: [
      {
        action: {
          type: String,
          enum: ['Start', 'Pause', 'Resume', 'Stop', 'UpdateQuantity','QCCheck','QCCheckUpdate'], // Added UpdateQuantity
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
        achieved_quantity: { // New field to track the updated quantity
          type: Number,
          required: false,
        },
        rejected_quantity: { // New field to track rejected quantity
          type: Number,
          required: false,
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

export const ironDailyProduction = mongoose.model('ironDailyProduction', ironDailyProductionSchema);
