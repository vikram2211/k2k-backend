// import mongoose from 'mongoose';

// const falconPackingSchema = new mongoose.Schema(
//     {
//         //work order optional
//         work_order: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'falconWorkOrder',
//             required: false,
//         },
//         job_order_id: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'falconJobOrder',
//             required: false,
//         },
//         // work_order_date: {
//         //     type: Date,
//         //     required: false
//         // },
//         // prod_reqs_date: {
//         //     type: Date,
//         //     required: false
//         // },
//         // prod_req_date: {
//         //     type: Date,
//         //     required: false
//         // },
//         product: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'falconProduct', // Reference to the Product schema
//             required: true,
//         },
//         semi_finished_id: {
//             type: String,
//             required: true,
//             trim: true,
//             unique: true
//         },
//         semi_finished_quantity: {
//             type: Number, // Quantity of the product being packed
//             required: true,
//         },
//         // bundle_size: {
//         //     type: Number, // Quantity of items per bundle (from Product schema)
//         //     required: true,
//         // },
//         // uom: {
//         //     type: String,
//         //     required: true
//         // },
//         rejected_quantity: {
//             type: Number, // Quantity rejected during packing
//             default: 0,
//         },
//         files: [
//             {
//                 file_name: {
//                     type: String,
//                     required: true,
//                 },
//                 file_url: {
//                     type: String,
//                     required: true,
//                 },
//                 uploaded_at: {
//                     type: Date,
//                     default: Date.now,
//                 },
//             },
//         ],
//         delivery_stage: {
//             type: String,
//             enum: ['Packed', 'Dispatched', 'Delivered'],
//             // default: 'Packed', // Changes when QR is scanned in dispatch
//         },
//         qr_id: {
//             type: String,
//             required: false,
//             unique: true,
//             sparse: true,
//         },
//         qr_code: {
//             type: String,
//             required: false,
//             unique: true,
//             sparse: true,
//         },
//         packed_by: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             // required: true,
//             required: true
//         },
//     },
//     {
//         timestamps: true,
//     },
// );

// export const falconPacking = mongoose.model('falconPacking', falconPackingSchema);








import mongoose from 'mongoose';

const falconPackingSchema = new mongoose.Schema(
    {
        work_order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconWorkOrder',
            required: false,
        },
        job_order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconJobOrder',
            required: false,
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'falconProduct',
            required: true,
        },
        semi_finished_id: {
            type: String,
            required: true,
            trim: true,
            // unique: true, // Ensures each semi-finished ID is unique across documents
        },
        semi_finished_quantity: {
            type: Number,
            required: true,
        },
        rejected_quantity: {
            type: Number,
            default: 0,
        },
        files: [
            {
                file_name: {
                    type: String,
                    required: true,
                },
                file_url: {
                    type: String,
                    required: true,
                },
                uploaded_at: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        delivery_stage: {
            type: String,
            enum: ['Packed', 'Dispatched', 'Delivered'],
            default: 'Packed'
        },
        qr_id: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
        },
        qr_code: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
        },
        packed_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export const falconPacking = mongoose.model('falconPacking', falconPackingSchema);