import mongoose from 'mongoose';

const falconDispatchSchema = new mongoose.Schema(
    {
        job_order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconWorkOrder',
            required: true, // Ensures all packing entries belong to the same Work Order
        },
        packing_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'falocnPacking', // Multiple packing batches linked to the dispatch
                required: true,
            },
        ],
        products: [
            {
                product_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'falconProduct',
                    required: true,
                },
                product_name: {
                    type: String, // Stored from `Product` schema
                    required: true,
                },
                semi_finished_id: {
                    type: String,
                    required: true,
                    trim: true,
                    // unique: true, // Ensures each semi-finished ID is unique across documents
                },
                dispatch_quantity: {
                    type: Number, // Derived from `Packing.product_quantity`
                    required: true,
                },
                hsn_code: {
                    type: String,
                    required: true,
                    trim: true,
                    // unique: true, 
                },
                boq: {
                    type: String,
                    required: true,
                    trim: true,
                    // unique: true, 
                },
                rate: {
                    type: Number,
                    required: true,
                },
                amount: {
                    type: Number,
                    required: true,
                },
                hardware_included: {
                    type: String,
                    required: false,
                    trim: true,
                    // unique: true, 
                },
                // bundle_size: {
                //   type: Number, // Stored from `Packing`
                //   required: true,
                // },
            },
        ],
        invoice_or_sto: {
            type: String,
            required: true,
        },
        vehicle_number: {
            type: String,
            required: true,
        },
        contact_person_detail: {
            type: String,
            required: true,
        },
        gate_pass_no: {
            type: Number,
            required: true,
        },
        dc_no: {
            type: Number,
            required: true,
        },
        qr_codes: [
            {
                type: String, // Stores scanned QR codes from Packing
                required: true,
                unique: true, // Ensures unique scans
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
        },
        invoice_file: { // Changed from `invoice_file` to `invoice_files` to reflect multiple files
            type: [String], // Array of strings to store multiple file URLs
            default: [], // Default to empty array to handle cases with no files
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

export const falocnDispatch = mongoose.model('falocnDispatch', falconDispatchSchema);