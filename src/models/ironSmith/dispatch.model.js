// import mongoose from 'mongoose';

// const dispatchSchema = new mongoose.Schema(
//   {
//     work_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'WorkOrder',
//       required: true, // Ensures all packing entries belong to the same Work Order
//     },
//     packing_ids: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Packing', // Multiple packing batches linked to the dispatch
//         required: true,
//       },
//     ],
//     products: [
//       {
//         shape_id: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: 'Product',
//           required: true,
//         },
//         product_name: {
//           type: String, // Stored from `Product` schema
//           required: true,
//         },
       
//         dispatch_quantity: {
//           type: Number, // Derived from `Packing.product_quantity`
//           required: true,
//         },
//         bundle_size: {
//           type: Number, // Stored from `Packing`
//           required: true,
//         },
//       },
//     ],
//     invoice_or_sto: {
//       type: String,
//       required: true,
//     },
//     qr_codes: [
//       {
//         type: String, // Stores scanned QR codes from Packing
//         required: true,
//         unique: true, // Ensures unique scans
//       },
//     ],
//     vehicle_number: {
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
//       type: String, // URL of the uploaded invoice file (stored in AWS S3 or similar storage)
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

// export const Dispatch = mongoose.model('Dispatch', dispatchSchema);



import mongoose from 'mongoose';

const ironDispatchSchema = new mongoose.Schema(
  {
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironWorkOrder',
      required: true,
    },
    packing_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ironPacking',
        required: true,
      },
    ],
    products: [
      {
        shape_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ironShape',
          required: true,
        },
        product_name: {
          type: String, // Optional, can be derived from ironShape
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
        uom: {
          type: String,
          required: false, // Add if UOM is tracked in ironPacking
        },
      },
    ],
    invoice_or_sto: {
      type: String,
      required: true,
    },
    qr_codes: [
      {
        type: String,
        required: true,
        unique: true,
      },
    ],
    qr_code_urls: [
      {
        type: String,
        required: false,
        unique: true,
        sparse: true,
      },
    ],
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
      type: [String], // Array to store multiple invoice file URLs
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