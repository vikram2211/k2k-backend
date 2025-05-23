
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct
} from '../controllers/konkreteKlinkers/productController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to products router")
router.route('/helpers/products').post(createProduct).get(getAllProducts);
router.route('/helpers/products/:id').get(getProductById).put(updateProduct);
router.route('/helpers/products/delete').delete(deleteProduct);

export default router;
