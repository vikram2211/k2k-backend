import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        material_code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        uom: {
            type: String,
            enum: ["SQ. Metre", "Nos"], // Restricting UOM to either "SQ. Metre" or "Nos"
            required: true,
            default: "Nos",
        },
        length: {
            type: Number,
            required: function () {
                return this.uom === "SQ. Metre"; // Length is required if UOM is SQ. Metre
            },
        },
        breadth: {
            type: Number,
            required: function () {
                return this.uom === "SQ. Metre"; // Breadth is required if UOM is SQ. Metre
            },
        },
        no_of_pieces_per_punch: {
            type: Number,
            required: true,
        },
        qty_in_bundle: {
            type: Number,
            required: true,
        },
        qty_in_nos_per_bundle: {
            type: Number,
            required: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
    }
);

export const Product = mongoose.model("Product", productSchema);
