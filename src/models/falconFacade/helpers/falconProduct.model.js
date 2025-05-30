import mongoose, { Schema } from "mongoose";

const falconProductSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active"
        },
    },
    {
        timestamps: true,
    },
);

export const falconProduct = mongoose.model('falconProduct', falconProductSchema);
