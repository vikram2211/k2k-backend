
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    getScannedProductsData, createDispatch,getAllDispatches,getDispatchById,updateFalconDispatch
} from '../../controllers/falconFacade/falconDispatchController.js';


const router = Router();
router.route('/dispatch/create').post(upload.array('invoice_file'), createDispatch);
router.route('/dispatch').get(getAllDispatches);
router.route('/dispatch/qrscan').get(getScannedProductsData);
router.route('/dispatch/:id').get(getDispatchById).put(upload.array('invoice_file'), updateFalconDispatch);


export default router;

