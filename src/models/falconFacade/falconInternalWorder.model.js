import mongoose from 'mongoose';

const processSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    file_url: {
        type: String,
        required: false,
    },
    remarks: {
        type: String,
        required: false,
        trim: true,
    },
});

const semifinishedDetailSchema = new mongoose.Schema({
    semifinished_id: {
        type: String,
        required: true,
        trim: true,
        // unique: true    - NEED TO THINK ON IT
    },
    file_url: {
        type: String,
        required: false,
    },
    remarks: {
        type: String,
        required: false,
        trim: true,
    },
    processes: [processSchema],
});

const productSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    system: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    product_system: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    code: { // Added code field
        type: String,
        required: true,
        trim: true,
    },
    po_quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    semifinished_details: [semifinishedDetailSchema],
});

const dateRangeSchema = new mongoose.Schema({
    from: {
        type: Date,
        required: true,
    },
    to: {
        type: Date,
        required: true,
    },
});

const falconInternalWorkOrderSchema = new mongoose.Schema(
    {
        int_work_order_id: {
                type: String,
                required: true,
                unique: true,
            },
        job_order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "falconJobOrder",
            required: true
        },
        sales_order_no: {
            type: String,
            required: false,
            trim: true,
        },
        date: {
            type: dateRangeSchema,
            required: true,
        },
        products: [productSchema],
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
            default: 'Pending',
            required: true,
        },
    },
    { timestamps: true }
);

export const falconInternalWorkOrder = mongoose.model('falconInternalWorkOrder', falconInternalWorkOrderSchema);    