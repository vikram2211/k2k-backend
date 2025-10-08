// import mongoose from 'mongoose';

// const ironDispatchSchema = new mongoose.Schema(
//   {
//     work_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'ironWorkOrder',
//       required: true,
//     },
//     packing_ids: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'ironPacking',
//         required: true,
//       },
//     ],
//     products: [
//       {
//         shape_id: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: 'ironShape',
//           required: true,
//         },
//         product_name: {
//           type: String, // Optional, can be derived from ironShape
//           required: false,
//         },
//         dispatch_quantity: {
//           type: Number,
//           required: true,
//         },
//         bundle_size: {
//           type: Number,
//           required: true,
//         },
//         weight: {
//           type: Number,
//           required: true,
//         },
//         uom: {
//           type: String,
//           required: false, // Add if UOM is tracked in ironPacking
//         },
//       },
//     ],
//     invoice_or_sto: {
//       type: String,
//       required: true,
//     },
//     gate_pass_no: {
//       type: String,
//       required: true,
//     },
//     qr_codes: [
//       {
//         type: String,
//         required: true,
//         // unique: true,
//       },
//     ],
//     qr_code_urls: [
//       {
//         type: String,
//         required: false,
//         // unique: true,
//         // sparse: true,
//       },
//     ],
//     vehicle_number: {
//       type: String,
//       required: true,
//     },
//     ticket_number: {
//       type: String,
//       required: true,
//     },
//     created_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     updated_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//     },
//     invoice_file: {
//       type: [String], // Array to store multiple invoice file URLs
//       default: [],
//     },
//     date: {
//       type: Date,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ['Approved', 'Rejected'],
//       default: 'Approved',
//     },
//   },
//   { timestamps: true }
// );

// export const ironDispatch = mongoose.model('ironDispatch', ironDispatchSchema);

















import mongoose from 'mongoose';

const ironDispatchSchema = new mongoose.Schema(
  {
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironWorkOrder',
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
          required: true,
        },
        product_name: {
          type: String,
          required: false,
        },
        dispatch_quantity: {
          type: Number,
          required: true,
        },
        bundle_size: {
          type: Number,
          required: true,
        },
        weight: {
          type: Number,
          required: true,
        },
        qr_code: {
          type: String,
          required: true,
        },
        uom: {
          type: String,
          required: false,
        },
      },
    ],
    invoice_or_sto: {
      type: String,
      required: true,
    },
    gate_pass_no: {
      type: String,
      required: true,
    },
    vehicle_number: {
      type: String,
      required: true,
    },
    ticket_number: {
      type: String,
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    invoice_file: {
      type: [String],
      default: [],
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Approved', 'Rejected'],
      default: 'Approved',
    },
  },
  { timestamps: true }
);

export const ironDispatch = mongoose.model('ironDispatch', ironDispatchSchema);
