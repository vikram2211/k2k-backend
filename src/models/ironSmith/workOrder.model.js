
import mongoose from 'mongoose';

const DimensionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    value: { type: String, required: true },
});



const ProductSchema = new mongoose.Schema({
    shapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironShape', required: true },
    uom: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    barMark: { type: String },
    memberDetails: { type: String },
    memberQuantity: { type: Number },
    diameter: { type: Number },
    type: { type: String },
    weight: { type: String },
    cuttingLength: { type: Number },
    dimensions: [DimensionSchema],
});

const WorkOrderSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironClient', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironProject', required: true },
    workOrderNumber: { type: String, required: true, unique: true },
    workOrderDate: { type: Date, required: true },
    deliveryDate: { type: Date },
    globalMemberDetails: { type: String },
    products: [ProductSchema],
    files: [
        {
            file_name: {
                type: String,
                required: false,
            },
            file_url: {
                type: String,
                required: false,
            },
            uploaded_at: {
                type: Date,
                default: Date.now,
            },
        },
    ],
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
}, { timestamps: true });

WorkOrderSchema.index({ workOrderNumber: 1 }, { unique: true });

export const ironWorkOrder = mongoose.model('ironWorkOrder', WorkOrderSchema);


// const ShapeSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     dimension: { type: String, required: true },
// });