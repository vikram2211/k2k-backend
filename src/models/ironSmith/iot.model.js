const iotSchema = new mongoose.Schema(
  {
    //this schema will be used to get the product_id , number of products present in the tray while manufacturing.
    // as each day the product_id could vary on the try, and hence there number of products being manufactured,
    plant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // Reference to the Product being manufactured
      required: false,
    },
    url: {
      type: string,
      required: false,
    },
  },
  { timestamps: true },
);

export const Iot = mongoose.model('Iot', iotSchema);
