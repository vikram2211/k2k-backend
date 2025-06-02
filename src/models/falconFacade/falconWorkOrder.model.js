import mongoose from "mongoose";

const falconWorkOrderSchema = new mongoose.Schema(
    {
        // 1. Basic Information
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
        date: {
            type: Date,
            required: true
        },
        remarks: {
            type: String,
            required: true
        },

        // 2. Products Array
        products: [
            {
                product_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "falconProduct",
                    required: true,
                },
                sac_code: {
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
            },
        ],

        // 3. Files Array
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

        // 4. Status and Metadata
        status: {
            type: String,
            enum: ["Pending", "In Progress", "Completed", "Cancelled"],
            default: "Pending",
            required: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },


        job_orders: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "JobOrder",
            },
        ],
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

export const falconWorkOrder = mongoose.model("falconWorkOrder", falconWorkOrderSchema);
