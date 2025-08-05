import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Product } from "../../models/konkreteKlinkers/product.model.js";
import { Plant } from "../../models/konkreteKlinkers/helpers/plant.model.js";
import Joi from "joi";

// **Validation Schema**
// const productSchema = Joi.object({
//     plant: Joi.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid plant ID"),
//     material_code: Joi.string().required().messages({
//         "string.empty": "Material Code is required",
//     }),
//     description: Joi.string().required().messages({
//         "string.empty": "Description is required",
//     }),
//     uom: Joi.string().valid("Square Metre", "Nos").required().messages({
//         "any.only": "UOM must be either 'Square Metre' or 'Nos'",
//         "string.empty": "UOM is required",
//     }).optional(),
//     area: Joi.number().when("uom", {
//         is: "Square Metre",
//         then: Joi.number().required().messages({
//             "number.base": "area must be a number",
//             "any.required": "area is required for UOM 'Square Metre'",
//         }),
//         otherwise: Joi.optional(),
//     }),
//     // length: Joi.number().when("uom", {
//     //     is: "SQ. Metre",
//     //     then: Joi.number().required().messages({
//     //         "number.base": "Length must be a number",
//     //         "any.required": "Length is required for UOM 'SQ. Metre'",
//     //     }),
//     //     otherwise: Joi.optional(),
//     // }),
//     // breadth: Joi.number().when("uom", {
//     //     is: "SQ. Metre",
//     //     then: Joi.number().required().messages({
//     //         "number.base": "Breadth must be a number",
//     //         "any.required": "Breadth is required for UOM 'SQ. Metre'",
//     //     }),
//     //     otherwise: Joi.optional(),
//     // }),
//     no_of_pieces_per_punch: Joi.number().required().messages({
//         "number.base": "Number of pieces per punch must be a number",
//         "any.required": "Number of pieces per punch is required",
//     }),
//     qty_in_bundle: Joi.number().required().messages({
//         "number.base": "Quantity in bundle must be a number",
//         "any.required": "Quantity in bundle is required",
//     }),
//     // qty_in_nos_per_bundle: Joi.number().required().messages({
//     //     "number.base": "Quantity in NOS per bundle must be a number",
//     //     "any.required": "Quantity in NOS per bundle is required",
//     // }),
//     status: Joi.string().valid("Active", "Inactive").default("Active"),
// });


// const dropMaterialCodeIndex = asyncHandler(async (req, res, next) => {
//     try {
//         console.log("Inside drop index");
//       // Check if index exists first
//       const indexes = await Product.collection.getIndexes();
//       if (indexes.plant_1) {
//         await Product.collection.dropIndex("plant_1");
//         console.log("✅ Successfully dropped plant unique index");
//         return res.status(200).json(new ApiResponse(200, null, "Index dropped successfully"));
//       } else {
//         console.log("ℹ️ material_code index doesn't exist or was already removed");
//         return res.status(200).json(new ApiResponse(200, null, "Index didn't exist"));
//       }
//     } catch (error) {
//       console.error("❌ Error dropping index:", error.message);
//       return next(new ApiError(500, "Failed to drop index", error));
//     }
//   });
//   dropMaterialCodeIndex();


/////////////////////////////////////////////////////////
//WAS WORKING FINE - *************************************
// const productSchema = Joi.object({
//     plant: Joi.string()
//         .regex(/^[0-9a-fA-F]{24}$/, 'Invalid plant ID')
//         .required()
//         .messages({
//             'string.pattern.base': 'Plant ID must be a valid ObjectId',
//             'any.required': 'Plant ID is required',
//         }),
//     material_code: Joi.string()
//         .required()
//         .messages({
//             'string.empty': 'Material Code is required',
//             'any.required': 'Material Code is required',
//         }),
//     description: Joi.string()
//         .required()
//         .messages({
//             'string.empty': 'Description is required',
//             'any.required': 'Description is required',
//         }),
//     // uom: Joi.string()    //WORKED FINE FOR - ONLY SINGLE UOM
//     //     .required()
//     //     .messages({
//     //         'string.empty': 'UOM is required',
//     //         'any.required': 'UOM is required',
//     //     }),

//     uom: Joi.array()
//         .items(Joi.string().valid('Square Metre/No', 'Metre/No')) 
//         .min(1) //at least one UOM is provided
//         .required()
//         .messages({
//             'array.min': 'At least one UOM must be provided',
//             'array.base': 'UOM must be an array of valid values',
//             'any.required': 'UOM is required',
//             'string.valid': 'UOM must be either "Square Metre/No" or "Metre/No"',
//         }),
//     area: Joi.number()
//         .required()
//         .messages({
//             'number.base': 'Area must be a number',
//             'any.required': 'Area is required',
//         }),
//     no_of_pieces_per_punch: Joi.number()
//         .required()
//         .messages({
//             'number.base': 'Number of pieces per punch must be a number',
//             'any.required': 'Number of pieces per punch is required',
//         }),
//     qty_in_bundle: Joi.number()
//         .required()
//         .messages({
//             'number.base': 'Quantity in bundle must be a number',
//             'any.required': 'Quantity in bundle is required',
//         }),
//     status: Joi.string()
//         .valid('Active', 'Inactive')
//         .default('Active'),
// });

// **Create Product**
// **Create Product**
// const createProduct = asyncHandler(async (req, res, next) => {
//     console.log('Product creation request:', req.body);

//     // Validate request body
//     const { error, value } = productSchema.validate(req.body, { abortEarly: false });
//     if (error) {
//         return next(new ApiError(400, 'Validation failed for product creation', error.details));
//     }

//     // Destructure validated fields
//     const {
//         plant,
//         material_code,
//         description,
//         uom,
//         area,
//         no_of_pieces_per_punch,
//         qty_in_bundle,
//         status,
//     } = value;

//     // Check for duplicate material_code
//     // const existingProduct = await Product.findOne({ material_code });
//     // if (existingProduct) {
//     //     return next(new ApiError(400, 'Material code already exists'));
//     // }

//     // Verify that the plant exists and is not deleted
//     const plantExists = await Plant.findOne({ _id: plant, isDeleted: false });
//     if (!plantExists) {
//         return next(new ApiError(400, 'Plant not found or has been deleted'));
//     }

//     // Get logged-in user ID (from authentication middleware)
//     const created_by = req.user._id;

//     // Create new product
//     const newProduct = await Product.create({
//         plant,
//         material_code,
//         description,
//         uom,
//         area,
//         no_of_pieces_per_punch,
//         qty_in_bundle,
//         created_by,
//         status,
//     });

//     return res.status(201).json(new ApiResponse(201, newProduct, 'Product created successfully'));
// });





////////////////////////////////////////////////////////////////////////////////


const productSchema = Joi.object({
    plant: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid plant ID')
        .required()
        .messages({
            'string.pattern.base': 'Plant ID must be a valid ObjectId',
            'any.required': 'Plant ID is required',
        }),
    material_code: Joi.string()
        .required()
        .messages({
            'string.empty': 'Material Code is required',
            'any.required': 'Material Code is required',
        }),
    description: Joi.string()
        .required()
        .messages({
            'string.empty': 'Description is required',
            'any.required': 'Description is required',
        }),
    uom: Joi.array()
        .items(Joi.string().valid('Square Meter/No', 'Meter/No'))
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one UOM must be provided',
            'array.base': 'UOM must be an array of valid values',
            'any.required': 'UOM is required',
            'string.valid': 'UOM must be either "Square Meter/No" or "Meter/No"',
        }),
    areas: Joi.object()
        .pattern(Joi.string().valid('Square Meter/No', 'Meter/No'), Joi.number().required())
        .required()
        .custom((value, helpers) => {
            const uom = helpers.state.ancestors[0].uom;
            const areaKeys = Object.keys(value);
            if (!uom.every((u) => areaKeys.includes(u))) {
                return helpers.error('any.custom', { message: 'Areas must include an entry for each selected UOM' });
            }
            return value;
        })
        .messages({
            'object.pattern.base': 'Areas must be an object with valid UOM keys and numeric values',
            'any.required': 'Areas is required',
        }),
    no_of_pieces_per_punch: Joi.number()
        .required()
        .messages({
            'number.base': 'Number of pieces per punch must be a number',
            'any.required': 'Number of pieces per punch is required',
        }),
    qty_in_bundle: Joi.number()
        .required()
        .messages({
            'number.base': 'Quantity in bundle must be a number',
            'any.required': 'Quantity in bundle is required',
        }),
    status: Joi.string()
        .valid('Active', 'Inactive')
        .default('Active'),
});

const createProduct = asyncHandler(async (req, res, next) => {
    console.log('Product creation request:', req.body);

    // Validate request body
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });
    if (error) {
        console.log("error",error);
        return next(new ApiError(400, 'Validation failed for product creation', error.details));
    }

    // Destructure validated fields
    const {
        plant,
        material_code,
        description,
        uom,
        areas,
        no_of_pieces_per_punch,
        qty_in_bundle,
        status,
    } = value;

    // Check for duplicate material_code
    // const existingProduct = await Product.findOne({ material_code });
    // if (existingProduct) {
    //     return next(new ApiError(400, 'Material code already exists'));
    // }

    // Verify that the plant exists and is not deleted
    const plantExists = await Plant.findOne({ _id: plant, isDeleted: false });
    if (!plantExists) {
        return next(new ApiError(400, 'Plant not found or has been deleted'));
    }

    // Get logged-in user ID (from authentication middleware)
    const created_by = req.user._id;

    // Convert areas object to Map for Mongoose schema
    const areasMap = new Map();
    for (const [key, value] of Object.entries(areas)) {
        areasMap.set(key, value);
    }

    // Create new product
    const newProduct = await Product.create({
        plant,
        material_code,
        description,
        uom,
        areas: areasMap,
        no_of_pieces_per_punch,
        qty_in_bundle,
        created_by,
        status,
    });

    return res.status(201).json(new ApiResponse(201, newProduct, 'Product created successfully'));
});

const getAllProducts = asyncHandler(async (req, res, next) => {
    // Default values for pagination
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;
    // const skip = (page - 1) * limit;

    // // Count total products that meet the criteria
    // const totalProducts = await Product.countDocuments({ isDeleted: false });

    const products = await Product.find({ isDeleted: false })
        .populate({
            path: 'plant',
            select: 'plant_name plant_code',
            // match: { isDeleted: false }, // Only include non-deleted plants
        })
        .populate('created_by', 'username email');
        // .skip(skip)
        // .limit(limit)
        // .sort({ createdAt: -1 });

    // Filter out products where plant is null (i.e., plant was deleted)
    const validProducts = products.filter((product) => product.plant !== null);

    if (!validProducts || validProducts.length === 0) {
        return next(new ApiError(404, 'No active products with non-deleted plants available'));
    }
    let coutnt = validProducts.length;

    // return res.status(200).json(new ApiResponse(200, {
    //     coutnt,
    //     products: validProducts,
    //     pagination: {
    //         total: totalProducts,
    //         page,
    //         limit,
    //         totalPages: Math.ceil(totalProducts / limit),
    //     },
    // }, 'Products fetched successfully'));
    return res.status(201).json(new ApiResponse(200, validProducts, 'Product fetched successfully'));

});

// **Get Product by ID**
const getProductById = asyncHandler(async (req, res, next) => {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new ApiError(400, `Provided Product ID (${productId}) is not a valid ObjectId`));
    }

    const product = await Product.findById(productId).populate("created_by", "username email").populate("plant", "plant_name");

    if (!product) {
        return next(new ApiError(404, "No product found with the given ID"));
    }

    return res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
});
 //Comment




const updateProductSchema_14_07_2025 = Joi.object({
    plant: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid plant ID')
        .optional()
        .messages({
            'string.pattern.base': 'Plant ID must be a valid ObjectId',
        }),
    material_code: Joi.string()
        .optional()
        .messages({
            'string.empty': 'Material Code cannot be empty if provided',
        }),
    description: Joi.string()
        .optional()
        .messages({
            'string.empty': 'Description cannot be empty if provided',
        }),
    // uom: Joi.string()  //WORKED FINE FOR - ONLY SINGLE UOM
    //     .valid('Square Metre/No')
    //     .optional()
    //     .messages({
    //         'any.only': 'UOM must be either "Square Metre" or "Nos"',
    //     }),

    uom: Joi.array()
        .items(Joi.string().valid('Square Meter/No', 'Meter/No')) // Allow only these values
        .min(1) // Ensure at least one UOM is provided if uom is updated
        .optional()
        .messages({
            'array.min': 'At least one UOM must be provided if updating UOM',
            'array.base': 'UOM must be an array of valid values',
            'string.valid': 'UOM must be either "Square Meter/No" or "Meter/No"',
        }),
    areas: Joi.number().when('uom', {
        is: 'Square Meter',
        then: Joi.number()
            .required()
            .messages({
                'number.base': 'Area must be a number',
                'any.required': 'Area is required when UOM is "Square Metre"',
            }),
        otherwise: Joi.number()
            .optional()
            .allow(null, '') // Allow null or empty string for Nos
            .messages({
                'number.base': 'Area must be a number if provided',
            }),
    }, { presence: 'optional' }), // Ensure area is evaluated based on uom presence
    no_of_pieces_per_punch: Joi.number()
        .optional()
        .messages({
            'number.base': 'Number of pieces per punch must be a number',
        }),
    qty_in_bundle: Joi.number()
        .optional()
        .messages({
            'number.base': 'Quantity in bundle must be a number',
        }),
    status: Joi.string()
        .valid('Active', 'Inactive')
        .optional()
        .messages({
            'any.only': 'Status must be either "Active" or "Inactive"',
        }),
});

// Update Product API
const updateProduct_24_07_2025 = asyncHandler(async (req, res, next) => {
    const productId = req.params.id;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return next(new ApiError(400, `Provided Product ID (${productId}) is not a valid ObjectId`));
    }

    // Validate request body
    const { error, value } = updateProductSchema.validate(req.body, { abortEarly: false });
    if (error) {
        console.log("error", error);
        return next(new ApiError(400, 'Validation failed for product update', error.details));
    }

    // Get logged-in user ID (from authentication middleware)
    const updated_by = req.user._id;

    // Prepare update object
    const updateData = {
        ...value,
        updated_by,
        updatedAt: Date.now(), // Manually set updatedAt (optional, as Mongoose timestamps handle this)
    };

    // If uom is Nos, explicitly set area to undefined to avoid storing null
    if (updateData.uom === 'Nos') {
        updateData.area = undefined;
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true, runValidators: true } // Return updated document and run schema validators
    );

    if (!updatedProduct) {
        return next(new ApiError(404, 'No product found with the given ID'));
    }

    return res.status(200).json(new ApiResponse(200, updatedProduct, 'Product updated successfully'));
});

const updateProductSchema = Joi.object({
    plant: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid plant ID')
        .optional()
        .messages({
            'string.pattern.base': 'Plant ID must be a valid ObjectId',
        }),
    material_code: Joi.string()
        .optional()
        .messages({
            'string.empty': 'Material Code cannot be empty if provided',
        }),
    description: Joi.string()
        .optional()
        .messages({
            'string.empty': 'Description cannot be empty if provided',
        }),
    uom: Joi.array()
        .items(Joi.string().valid('Square Meter/No', 'Meter/No'))
        .min(1)
        .optional()
        .messages({
            'array.min': 'At least one UOM must be provided if updating UOM',
            'array.base': 'UOM must be an array of valid values',
            'string.valid': 'UOM must be either "Square Meter/No" or "Meter/No"',
        }),
    areas: Joi.object()
        .pattern(Joi.string().valid('Square Meter/No', 'Meter/No'), Joi.number().required())
        .optional()
        .custom((value, helpers) => {
            const uom = helpers.state.ancestors[0].uom;
            if (uom) {
                const areaKeys = Object.keys(value);
                if (!uom.every((u) => areaKeys.includes(u))) {
                    return helpers.error('any.custom', { message: 'Areas must include an entry for each selected UOM' });
                }
            }
            return value;
        })
        .messages({
            'object.pattern.base': 'Areas must be an object with valid UOM keys and numeric values',
            'any.custom': 'Areas must include an entry for each selected UOM',
        }),
    no_of_pieces_per_punch: Joi.number()
        .optional()
        .messages({
            'number.base': 'Number of pieces per punch must be a number',
        }),
    qty_in_bundle: Joi.number()
        .optional()
        .messages({
            'number.base': 'Quantity in bundle must be a number',
        }),
    status: Joi.string()
        .valid('Active', 'Inactive')
        .optional()
        .messages({
            'any.only': 'Status must be either "Active" or "Inactive"',
        }),
});


const updateProduct = asyncHandler(async (req, res, next) => {
    console.log('Product update request:', req.body);

    // Validate request body
    const { error, value } = updateProductSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return next(new ApiError(400, 'Validation failed for product update', error.details));
    }

    const {
        plant,
        material_code,
        description,
        uom,
        areas,
        no_of_pieces_per_punch,
        qty_in_bundle,
        status,
    } = value;

    // Check if product exists
    const product = await Product.findById(req.params.id);
    if (!product || product.isDeleted) {
        return next(new ApiError(404, 'Product not found or has been deleted'));
    }

    // Verify that the plant exists and is not deleted if provided
    if (plant) {
        const plantExists = await Plant.findOne({ _id: plant, isDeleted: false });
        if (!plantExists) {
            return next(new ApiError(400, 'Plant not found or has been deleted'));
        }
    }

    // Convert areas object to Map for Mongoose schema if areas is provided
    const updateData = {
        ...(plant && { plant }),
        ...(material_code && { material_code }),
        ...(description && { description }),
        ...(uom && { uom }),
        ...(areas && { areas: new Map(Object.entries(areas)) }),
        ...(no_of_pieces_per_punch !== undefined && { no_of_pieces_per_punch }),
        ...(qty_in_bundle !== undefined && { qty_in_bundle }),
        ...(status && { status }),
        updated_by: req.user._id,
    };

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
    );

    return res.status(200).json(new ApiResponse(200, updatedProduct, 'Product updated successfully'));
});

// const deleteProduct = asyncHandler(async (req, res, next) => {
//     // Extract IDs from request body
//     let ids = req.body.ids;
//     // console.log("ids",ids);

//     // Ensure ids is always an array
//     if (!ids) {
//         return res.status(400).json(new ApiResponse(400, null, "No IDs provided"));
//     }
//     if (!Array.isArray(ids)) {
//         ids = [ids]; // Convert single ID to array
//     }

//     // Validate IDs
//     if (ids.length === 0) {
//         return res.status(400).json(new ApiResponse(400, null, "IDs array cannot be empty"));
//     }

//     // Validate MongoDB ObjectIds
//     const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
//     if (invalidIds.length > 0) {
//         return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
//     }

//     // Delete documents
//     const result = await Product.deleteMany({ _id: { $in: ids } });

//     // Check if any documents were deleted
//     if (result.deletedCount === 0) {
//         return res.status(404).json(new ApiResponse(404, null, "No products found with provided IDs"));
//     }

//     return res.status(200).json(
//         new ApiResponse(
//             200,
//             { deletedCount: result.deletedCount },
//             `${result.deletedCount} product(s) deleted successfully`
//         )
//     );
// });


const deleteProduct = asyncHandler(async (req, res, next) => {
    // Extract IDs from request body
    let ids = req.body.ids;
    console.log('ids', ids);

    // Ensure ids is always an array
    if (!ids) {
        return res.status(400).json(new ApiResponse(400, null, 'No IDs provided'));
    }
    if (!Array.isArray(ids)) {
        ids = [ids]; // Convert single ID to array
    }

    // Validate IDs
    if (ids.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'IDs array cannot be empty'));
    }

    // Validate MongoDB ObjectIds
    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        return res.status(400).json(new ApiResponse(400, null, `Invalid ID(s): ${invalidIds.join(', ')}`));
    }

    // Perform soft deletion by setting isDeleted: true
    const result = await Product.updateMany(
        { _id: { $in: ids }, isDeleted: false }, // Only update non-deleted products
        { $set: { isDeleted: true, updatedAt: Date.now() } } // Set isDeleted and update timestamp
    );

    // Check if any documents were updated
    if (result.matchedCount === 0) {
        return res.status(404).json(new ApiResponse(404, null, 'No non-deleted products found with provided IDs'));
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount },
            `${result.modifiedCount} product(s) marked as deleted successfully`
        )
    );
});

export { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct };
