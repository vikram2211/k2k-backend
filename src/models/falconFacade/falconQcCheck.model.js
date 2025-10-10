import mongoose from "mongoose";

const qcCheckSchema = new mongoose.Schema(
    {
        production: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconProduction',
            required: false, // Optional, used for Production module QC checks
        },
        job_order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconJobOrder',
            required: true,
        },

        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconProduct',
            required: true,
        },

        semifinished_id: {
            type: String,
            required: true,
        },
        rejected_quantity: {
            type: Number,
            required: true,
            default: 0,
        },
        recycled_quantity: {
            type: Number,
            required: true,
            default: 0,
        },
        process_name: {
            type: String,
            required: false,
        },
        from_process_name: {
            type: String,
            required: false,
        },
        remarks: {
            type: String,
            required: false,
        },
        checked_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
    },
    { timestamps: true }
);

export const falconQCCheck = mongoose.model('falconQCCheck', qcCheckSchema);