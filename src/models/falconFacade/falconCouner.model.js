import mongoose from 'mongoose';

const falconCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., 'job_order'
  sequence_value: { type: Number, default: 0 },
});

export const falconCounter = mongoose.model('falconCounter', falconCounterSchema);