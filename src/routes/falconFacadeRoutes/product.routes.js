
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createFalconProduct, getAllFalconProducts, getFalconProductById, updateFalconProduct, deleteFalconProduct, getProductUsageStats
} from '../../controllers/falconFacade/helpers/falconProductController.js';
// import 'mongoose' from "mongoose";

const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")s
router.route('/helpers/products').get(getAllFalconProducts).post(createFalconProduct);
router.route('/helpers/products/usage-stats').get(getProductUsageStats);
router.route('/helpers/products/:id').get(getFalconProductById).put(updateFalconProduct);
router.route('/helpers/products/delete').delete(deleteFalconProduct);

export default router;