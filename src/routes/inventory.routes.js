
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    getCombinedInventoryByProduct,getInventoryByProductId
} from '../controllers/konkreteKlinkers/inventoryController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/inventories').get(getCombinedInventoryByProduct);
router.route('/inventory/product').get(getInventoryByProductId);


export default router;
