import mongoose from 'mongoose';

const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Color name is required'],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: [true, 'Color code is required'],
      trim: true,
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color code must be a valid hex code (e.g., #FF0000)'],
      unique: true,
    },
  },
  { timestamps: true }
);

export const Color = mongoose.model('Color', colorSchema);