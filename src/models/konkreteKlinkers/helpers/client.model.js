import mongoose, { Schema } from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
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
      default: false, // Default to false (not deleted)
    },
  },
  {
    timestamps: true,
  },
);

export const Client = mongoose.model('Client', clientSchema);
// export const User = mongoose.model("User", userSchema);
