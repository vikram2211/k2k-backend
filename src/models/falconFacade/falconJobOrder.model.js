import mongoose from 'mongoose';

const falconJobOrderSchema = new mongoose.Schema(
    {
        job_order_id: {
            type: String,
            required: true,
            unique: true,
        },
        client_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "falconClient",
            required: true
        },
        project_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "falconProject",
            required: true
        },
        work_order_number: {
            type: String,
            required: true,
            unique: true, // Ensures each work order number is unique
        },
        prod_issued_approved_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true
        },
        prod_recieved_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        prod_requset_date: {
            type: Date,
            required: true
        },
        prod_requirement_date: {
            type: Date,
            required: true
        },
        remarks: {
            type: String,
            required: true
        },
        products: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product',
                    required: true,
                },
                code: {
                    type: String,
                    required: true,
                },
                uom: {
                    type: String,
                    required: true,
                },
                po_quantity: {
                    type: Number,
                    required: true,
                },
                color_code: {
                    type: String,
                    required: true,
                },
                width: {
                    type: Number,
                    required: true,
                },
                height: {
                    type: Number,
                    required: true,
                },
            },
        ],
        files: [
            {
                file_name: {
                    type: String,
                    required: true,
                },
                file_url: {
                    type: String,
                    required: true,
                },
                uploaded_at: {
                    type: Date,
                    default: Date.now,
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
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'In Progress'],
            default: 'Pending',
        },
    },
    { timestamps: true },
);

export const falconJobOrder = mongoose.model('falconJobOrder', falconJobOrderSchema);
