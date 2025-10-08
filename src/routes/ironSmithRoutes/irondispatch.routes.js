import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';


import {
    createDispatch, getScannedProducts,updateDispatch,getAllDispatches,getDispatchById, getDispatchByWorkOrderId} from '../../controllers/ironSmith/dispatchController.js';
// import {
//     getWorkOrderProductByJobOrder} from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js';

const router = Router();
router.use(verifyJWT);

router.route('/dispatch/create').post(upload.array('invoice_file'),createDispatch);
router.route('/dispatch').get(getAllDispatches);
router.route('/dispatch/qrscan').get(getScannedProducts);
router.route('/dispatch/workorder/:workOrderId').get(getDispatchByWorkOrderId);
router.route('/dispatch/:id').get(getDispatchById).put(upload.array('invoice_file'),updateDispatch);
//.


export default router;
