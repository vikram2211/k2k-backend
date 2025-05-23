import {Router} from 'express';
const router = Router();

import { createPackingBundles ,createPacking,getAllPacking,getPackingByWorkOrderAndProduct,deletePackingByWorkOrderAndProduct,getBundleSizeByProduct} from '../controllers/konkreteKlinkers/packingController.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
router.use(verifyJWT);

router.route('/packing').post(createPackingBundles).get(getAllPacking);
router.route('/packing/create').post(createPacking);
router.route('/packing/delete').delete(deletePackingByWorkOrderAndProduct);
router.route('/packing/get').get(getPackingByWorkOrderAndProduct);
router.route('/packing/bundlesize').get(getBundleSizeByProduct);
export default router;