import mongoose from 'mongoose';

const ironCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., 'job_order'
  sequence_value: { type: Number, default: 0 },
});

export const ironCounter = mongoose.model('ironCounter', ironCounterSchema);

