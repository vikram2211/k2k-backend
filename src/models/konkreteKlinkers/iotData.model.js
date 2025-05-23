const iotDataSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    plant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    processed: {
      type: Boolean,
      default: false, // Mark as processed when added to inventory
    },
  },
  {
    timestamps: true,
  }
);

export const IoTData = mongoose.model('IoTData', iotDataSchema);
