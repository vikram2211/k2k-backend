import mongoose from 'mongoose';

const ironPackingSchema = new mongoose.Schema(
  {
    //work order optional
    work_order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironWorkOrder', // Reference to the WorkOrder schema
      required: false,
    },
    shape_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ironShape', // Reference to the Product schema
      required: true,
    },
    product_quantity: {
      type: Number, // Quantity of the product being packed
      required: true,
    },
    bundle_size: {
      type: Number, // Quantity of items per bundle (from Product schema)
      required: true,
    },
    weight: {
      type: Number, // Quantity rejected during packing
      default: 0,
    },
    delivery_stage: {
      type: String,
      enum: ['Packed', 'Dispatched', 'Delivered'],
      // default: 'Packed', // Changes when QR is scanned in dispatch
    },
    qr_code: {
      type: String, // Manually scanned QR code for the bundle
      required: false,
      unique: true, // Ensure QR codes are unique for traceability
      sparse: true,  
      default: '',
      },
    qr_code_url: {
      type: String,
      default: '',
      required: false,
      unique: true, // Ensure QR codes are unique for traceability
      sparse: true,
    },
    packed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // User who performed the packing
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
);

export const iornPacking = mongoose.model('ironPacking', ironPackingSchema);

// const newPacking = new Packing({
//     product: "productId1",
//     product_quantity: 100,
//     rejected_quantity: 5,
//     bundle_size: 10,
//     total_bundles: 10,
//     qr_code: "QR123456789",
//     packed_by: "userId1",
//   });
//   await newPacking.save();



//packing schema where multiple bundles can be scanned at a time
//was not accepted , little complicated to perform crud but the efficient way

// const packingSchema = new mongoose.Schema(
//   {
//     work_order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'WorkOrder',
//       required: false, // Optional, but should be linked
//     },
//     product: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Product',
//       required: true,
//     },
//     product_quantity: {
//       type: Number, // Total packed quantity
//       required: true,
//     },
//     bundle_size: {
//       type: Number, // Each bundle contains fixed items
//       required: true,
//     },
//     number_of_bundles: {
//       type: Number, // Total bundles packed
//       required: true,
//       default: function () {
//         return Math.ceil(this.product_quantity / this.bundle_size);
//       },
//     },
//     qr_codes: [
//       {
//         type: String, // Multiple QR codes for each bundle
//         required: true,
//         unique: true, // Ensures traceability
//       },
//     ],
//     packed_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ['Packed', 'Ready for Dispatch', 'Dispatched'],
//       default: 'Packed',
//     },
//   },
//   { timestamps: true }
// );

// export const Packing = mongoose.model('Packing', packingSchema);
