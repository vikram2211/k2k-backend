const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      required: true,
    },
    produced_quantity: {
      type: Number, // Quantity produced before packing
      required: true,
      default: 0,
    },
    packed_quantity: {
      type: Number, // Quantity successfully packed
      required: true,
      default: 0,
    },
    dispatched_quantity: {
      type: Number, // Quantity successfully dispatched
      required: true,
      default: 0,
    },
    available_stock: {
      type: Number, // Packed quantity - Dispatched quantity
      required: true,
      default: function () {
        return this.packed_quantity - this.dispatched_quantity;
      },
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export const Inventory = mongoose.model('Inventory', inventorySchema);
