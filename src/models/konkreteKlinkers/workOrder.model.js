// models/WorkOrder.js
  import mongoose from "mongoose";

  const workOrderSchema = new mongoose.Schema(
    {
      // 1. Basic Information
      client_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
        required: [
          function () {
            return !this.buffer_stock; // Required if buffer_stock is false
          },
          "Client ID is required unless buffer stock is selected",
        ],
      },
      project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: [
          function () {
            return !this.buffer_stock; // Required if buffer_stock is false
          },
          "Project ID is required unless buffer stock is selected",
        ],
      },
      work_order_number: {
        type: String,
        required: true,
        unique: true, // Ensures each work order number is unique
      },
      date: {
        type: Date,
        required: [
          function () {
            return !this.buffer_stock; // Required if buffer_stock is false
          },
          "Work Order Date is required unless buffer stock is selected",
        ],
      },
      buffer_stock: {
        type: Boolean,
        default: false,
      },

      // 2. Products Array
      products: [
        {
          product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
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
          qty_in_nos:{
            type:Number,
            required:true
          },
          // original_sqmt: { //Removed as product already have plant id related to it
          //   type: Number,
          //   required: true,
          // },
          // plant_code: {
          //   // type: String,
          //   // required: true,
          //   type: mongoose.Schema.Types.ObjectId,   //Removed as product already have plant id related to it
          //   ref: "Plant",
          //   required: true,
          // },
          delivery_date: {
            type: Date,
            required: false,
          },
        },
      ],

      // 3. Files Array
      files: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
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
      buffer_transfer_logs: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BufferTransfer", // Links to BufferTransfer schema
        },
      ],

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

// Optional: Add indexes to optimize query performance
workOrderSchema.index({ client_id: 1 });
workOrderSchema.index({ project_id: 1 });
workOrderSchema.index({ work_order_number: 1 });

export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);


//do implement the indexing in the database schema, needs more research

// What is Indexing in MongoDB?
// Indexing is a mechanism in MongoDB that improves the performance of queries. An index is a special data structure that stores a small portion of the data in a way that makes it faster to search through the database. It acts like a "lookup table" for your collection, allowing the database to find data more efficiently.

// When you query a field in a MongoDB collection without an index, MongoDB performs a collection scan, meaning it checks each document in the collection to find matches. If the field is indexed, MongoDB can directly look at the index to find matching documents, which is much faster.

// 1 means ascending order, and -1 means descending order.
