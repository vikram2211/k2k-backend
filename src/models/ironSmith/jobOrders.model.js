import mongoose from 'mongoose';

const ironJobOrderSchema = new mongoose.Schema(
  {
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironWorkOrder',
      required: [true, 'Work order ID is required'],
    },

    job_order_number: {
      type: String,
      required: true,
      unique: true,
    },
    sales_order_number: {
      type: String,
      trim: true,
      default: '',
    },
    date_range: {
      from: {
        type: Date,
        required: [true, 'Start date is required'],
      },
      to: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
          validator: function (to) {
            return to >= this.date_range.from;
          },
          message: 'End date must be after or equal to start date',
        },
      },
    },

    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Color',
      required: [true, 'Color is required'],
    },
    products: [
      {
        shape: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ironShape',
          required: [true, 'Shape ID is required'],
        },
        planned_quantity: {
          type: Number,
          required: [true, 'Planned quantity is required'],
          min: [0, 'Planned quantity must be non-negative'],
        },
        // schedule_date: {
        //   type: Date,
        //   required: [true, 'Schedule date is required'],
        // },
        dia: {
          type: Number,
          required: [true, 'Diameter is required'],
          min: [0, 'Diameter must be non-negative'],
        },
        // color: {
        //   type: mongoose.Schema.Types.ObjectId,
        //   ref: 'Color',
        //   required: [true, 'Color is required'],
        // },
        achieved_quantity: {
          type: Number,
          default: 0,
          min: [0, 'Achieved quantity must be non-negative'],
        },
        rejected_quantity: {
          type: Number,
          default: 0,
          min: [0, 'Rejected quantity must be non-negative'],
        },
        packed_quantity: {
          type: Number,
          default: 0,
        },
        dispatched_quantity: {
          type: Number,
          default: 0,
        },
        selected_machines: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ironMachine',
          },
        ],
        qr_code_id: {
          type: String,
          default: '',
          required: false,
          unique: true, // Ensure QR codes are unique for traceability
          sparse: true,
        },
        qr_code_url: {
          type: String,
          default: '',
          required: false,
          unique: true, // Ensure QR codes are unique for traceability
          sparse: true,
        },
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by ID is required'],
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Updated by ID is required'],
    },
    status: {
      type: String,
      enum: ['Pending QC', 'Approved', 'Rejected', 'In Progress'],
      default: 'Pending QC',
    },
  },
  { timestamps: true }
);

export const ironJobOrder = mongoose.model('ironJobOrder', ironJobOrderSchema);
