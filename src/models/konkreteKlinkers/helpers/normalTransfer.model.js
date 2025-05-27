import mongoose from "mongoose";

const bufferTransferSchema = new mongoose.Schema(
  {
    from_work_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      // ref: "BufferStock", // Reference to the buffer stock being transferred
      ref:'WorkOrder',
      required: true,
    },
    to_work_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkOrder", // Reference to the work order receiving the stock
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // Reference to the product being transferred
      required: true,
    },
    quantity_transferred: {
      type: Number, // Amount of stock transferred
      required: true,
    },
    transferred_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Authorized person performing the transfer
      required: true,
    },
    transfer_date: {
      type: Date, // Timestamp of the transfer
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Completed", "Reversed"], // Status of the transfer
      default: "Completed",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

export const BufferTransfer = mongoose.model("BufferTransfer", bufferTransferSchema);