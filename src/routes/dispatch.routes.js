
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

import {
    createDispatch,getAllDispatches,getDispatchById,updateDispatch,getScannedProductsData
} from '../controllers/konkreteKlinkers/dispatchController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/dispatch/create').post(upload.array('invoice_file'),createDispatch);
router.route('/dispatch').get(getAllDispatches);
router.route('/dispatch/qrscan').get(getScannedProductsData);
router.route('/dispatch/:id').get(getDispatchById).put(upload.single('invoice_file'),updateDispatch);


export default router;
