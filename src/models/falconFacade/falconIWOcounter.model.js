import mongoose from 'mongoose';

const falconInternalWorkOrderCounterSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: 'int_work_order_counter',
    },
    sequence_value: {
        type: Number,
        default: 0,
    },
});

export const falconInternalWorkOrderCounter = mongoose.model(
    'falconInternalWorkOrderCounter',
    falconInternalWorkOrderCounterSchema
);
