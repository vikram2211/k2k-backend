// import mongoose from "mongoose";

// const productSchema = new mongoose.Schema(
//     {
//         plant: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref:'Plant',
//             required: true,
//         },
//         material_code: {
//             type: String,
//             required: true,
//             unique: true,
//             trim: true,
//         },
//         description: {
//             type: String,
//             required: true,
//         },
//         no_of_pieces_per_punch: {
//             type: Number,
//             required: true,
//         },
//         uom: {
//             type: String,
//             enum: ["Square Metre", "Nos"], // Restricting UOM to either "SQ. Metre" or "Nos"
//             required: true,
//             default: "Nos",
//         },
//         // length: {
//         //     type: Number,
//         //     required: function () {
//         //         return this.uom === "SQ. Metre"; // Length is required if UOM is SQ. Metre
//         //     },
//         // },
//         // breadth: {
//         //     type: Number,
//         //     required: function () {
//         //         return this.uom === "SQ. Metre"; // Breadth is required if UOM is SQ. Metre
//         //     },
//         // },
//         area: {
//             type: Number,
//             required: function () {
//                 return this.uom === "SQ. Metre"; // area is required if UOM is SQ. Metre
//             },
//         },

//         qty_in_bundle: {
//             type: Number,
//             required: true,
//         },
//         // qty_in_nos_per_bundle: {
//         //     type: Number,
//         //     required: true,
//         // },
//         created_by: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User",
//             required: true,
//         },
//         status: {
//             type: String,
//             enum: ["Active", "Inactive"],
//             default: "Active",
//         },
//     },
//     {
//         timestamps: true, // Adds createdAt and updatedAt automatically
//     }
// );

// export const Product = mongoose.model("Product", productSchema);


////WAS WORKING FINE, UNTIL KK FEEDBACK FOR METRE/NO GIVEN -

// import mongoose from 'mongoose';

// const productSchema = new mongoose.Schema(
//     {
//         plant: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Plant',
//             required: true,
//         },
//         material_code: {
//             type: String,
//             required: true,
//             // unique: true,
//             trim: true,
//         },
//         description: {
//             type: String,
//             required: true,
//         },
//         uom: {
//             type: String,
//             // enum: ['Square Metre', 'Nos'],
//             required: true,
//             // default: 'Nos',
//         },
//         area: {
//             type: Number,
//             required: true
//         },
//         no_of_pieces_per_punch: {
//             type: Number,
//             required: true,
//         },
//         qty_in_bundle: {
//             type: Number,
//             required: true,
//         },
//         created_by: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             required: true,
//         },
//         status: {
//             type: String,
//             enum: ['Active', 'Inactive'],
//             default: 'Active',
//         },
//         isDeleted: {
//             type: Boolean,
//             default: false, // Default to false (not deleted)
//         },
//     },
//     {
//         timestamps: true,
//     }
// );

// export const Product = mongoose.model('Product', productSchema);

///////////////////////////////////////////////////////////////////////////////////////////////////

//WAS WORKING FINE - ******************

// import mongoose from 'mongoose';

// const productSchema = new mongoose.Schema(
//     {
//         plant: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Plant',
//             required: true,
//         },
//         material_code: {
//             type: String,
//             required: true,
//             // unique: true,
//             trim: true,
//         },
//         description: {
//             type: String,
//             required: true,
//         },
//         uom: {
//             type: [String], 
//             enum: ['Square Metre/No', 'Metre/No'], 
//             required: true,
//             validate: {
//                 validator: (value) => value.length > 0, //at least one UOM shoule be provided
//                 message: 'At least one UOM must be provided',
//             },
//         },
//         area: {
//             type: Number,
//             required: true,
//         },
//         no_of_pieces_per_punch: {
//             type: Number,
//             required: true,
//         },
//         qty_in_bundle: {
//             type: Number,
//             required: true,
//         },
//         created_by: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             required: true,
//         },
//         status: {
//             type: String,
//             enum: ['Active', 'Inactive'],
//             default: 'Active',
//         },
//         isDeleted: {
//             type: Boolean,
//             default: false,
//         },
//     },
//     {
//         timestamps: true,
//     }
// );

// export const Product = mongoose.model('Product', productSchema);


















////////////////////////////////////////////////////////////////////////////////////////


import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        plant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Plant',
            required: true,
        },
        material_code: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        uom: {
            type: [String],
            enum: ['Square Metre/No', 'Metre/No'],
            required: true,
            validate: {
                validator: (value) => value.length > 0,
                message: 'At least one UOM must be provided',
            },
        },
        areas: {
            type: Map,
            of: Number,
            required: true,
            validate: {
                validator: function (value) {
                    const uoms = this.uom;
                    return uoms.every((uom) => value.has(uom));
                },
                message: 'Areas must include an entry for each selected UOM',
            },
        },
        no_of_pieces_per_punch: {
            type: Number,
            required: true,
        },
        qty_in_bundle: {
            type: Number,
            required: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive'],
            default: 'Active',
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const Product = mongoose.model('Product', productSchema);