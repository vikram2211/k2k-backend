import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., 'job_order'
  sequence_value: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);