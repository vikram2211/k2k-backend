import mongoose from 'mongoose';

const dispatchSchema = new mongoose.Schema(
  {
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      required: true, // Ensures all packing entries belong to the same Work Order
    },
    packing_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Packing', // Multiple packing batches linked to the dispatch
        required: true,
      },
    ],
    products: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        product_name: {
          type: String, // Stored from `Product` schema
          required: true,
        },
       
        dispatch_quantity: {
          type: Number, // Derived from `Packing.product_quantity`
          required: true,
        },
        bundle_size: {
          type: Number, // Stored from `Packing`
          required: true,
        },
      },
    ],
    invoice_or_sto: {
      type: String,
      required: true,
    },
    qr_codes: [
      {
        type: String, // Stores scanned QR codes from Packing
        required: true,
        unique: true, // Ensures unique scans
      },
    ],
    vehicle_number: {
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
    invoice_file: { // Changed from `invoice_file` to `invoice_files` to reflect multiple files
      type: [String], // Array of strings to store multiple file URLs
      default: [], // Default to empty array to handle cases with no files
    },
    date:{
      type:Date,
      required:true,
    },

    status: {
      type: String,
      enum: ['Approved', 'Rejected'],
      default: 'Approved',
    },
  },
  { timestamps: true }
);

export const Dispatch = mongoose.model('Dispatch', dispatchSchema);