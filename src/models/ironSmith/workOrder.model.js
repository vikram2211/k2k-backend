// // models/WorkOrder.js
// import mongoose from "mongoose";

// const ironWorkOrderSchema = new mongoose.Schema(
//   {
//     // 1. Basic Information
//     client_id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "ironClient",
//       required: true,
//     },
//     project_id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "ironProject",
//       required: true,
//     },
//     work_order_number: {
//       type: String,
//       required: true,
//       unique: true, // Ensures each work order number is unique
//     },
//     date: {
//       type: Date,
//       required: true,
//     },

//     // 2. Products Array
//     products: [
//       {
//         product_id: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "Product",
//           required: true,
//         },
//         uom: {
//           type: String,
//           required: true,
//         },
//         po_quantity: {
//           type: Number,
//           required: true,
//         },
//         plant_code: {
//           type: String,
//           required: true,
//         },
//         delivery_date: {
//           type: Date,
//         },
//       },
//     ],

//     // 3. Files Array
//     files: [
//       {
//         file_name: {
//           type: String,
//           required: true,
//         },
//         file_url: {
//           type: String,
//           required: true,
//         },
//         uploaded_at: {
//           type: Date,
//           default: Date.now,
//         },
//       },
//     ],

//     // 4. Status and Metadata
//     status: {
//       type: String,
//       enum: ["Pending", "In Progress", "Completed", "Cancelled"],
//       default: "Pending",
//       required: true,
//     },
//     created_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     updated_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
 
    
//     job_orders: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "JobOrder",
//       },
//     ],
//   },
//   {
//     timestamps: true, // Automatically adds createdAt and updatedAt fields
//   }
// );

// // Optional: Add indexes to optimize query performance
// workOrderSchema.index({ client_id: 1 });
// workOrderSchema.index({ project_id: 1 });
// workOrderSchema.index({ work_order_number: 1 });

// export const ironWorkOrder = mongoose.model("ironWorkOrder", ironWorkOrderSchema);


// //do implement the indexing in the database schema, needs more research

// // What is Indexing in MongoDB?
// // Indexing is a mechanism in MongoDB that improves the performance of queries. An index is a special data structure that stores a small portion of the data in a way that makes it faster to search through the database. It acts like a "lookup table" for your collection, allowing the database to find data more efficiently.

// // When you query a field in a MongoDB collection without an index, MongoDB performs a collection scan, meaning it checks each document in the collection to find matches. If the field is indexed, MongoDB can directly look at the index to find matching documents, which is much faster.

// // 1 means ascending order, and -1 means descending order.



// const mongoose = require('mongoose');
import mongoose from 'mongoose';

const DimensionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    value: { type: String, required: true },
});

// const ShapeSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     dimension: { type: String, required: true },
// });

const ProductSchema = new mongoose.Schema({
    shapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironShape', required: true },
    uom: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    plantCode: { type: String, required: true },
    deliveryDate: { type: Date },
    barMark: { type: String },
    memberDetails: { type: String },
    dimensions: [DimensionSchema],
    // shapes: [ShapeSchema],
});

const WorkOrderSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironClient', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'ironProject', required: true },
    workOrderNumber: { type: String, required: true, unique: true },
    workOrderDate: { type: Date, required: true },
    products: [ProductSchema],
    files: [{ type: String }], // Array of file URLs or paths (e.g., S3 URLs)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export const ironWorkOrder = mongoose.model('ironWorkOrder', WorkOrderSchema);