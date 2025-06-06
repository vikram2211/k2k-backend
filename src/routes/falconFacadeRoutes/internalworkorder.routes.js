
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    getJobOrderAutoFetch,getJobOrderProductDetails,getJobOrderTotalProductDetail,getProductSystem,createInternalWorkOrder,getInternalWorkOrderDetails,getInternalWorkOrderById
} from '../../controllers/falconFacade/internalWorkOrderController.js';

const router = Router();

router.use(verifyJWT);
router.post('/internal-workorder/create', upload.any(), createInternalWorkOrder);
router.route('/internal-workorder/get').get(getInternalWorkOrderDetails);
router.route('/internal-workorder/:id').get(getInternalWorkOrderById);


router.route('/client-product/details').get(getJobOrderAutoFetch);
router.route('/product/details').get(getJobOrderProductDetails);
router.route('/products/details').get(getJobOrderTotalProductDetail);
router.route('/productsystem').get(getProductSystem);
// .put(upload.array('files'), updateFalconJobOrder); //
// // 
// router.route('/workorders-getProject').get(getFalconProjectBasedOnClient);
// // router.route('/workorders-getPlant').get(getPlantBasedOnProduct);
// router.route('/joborders/delete').delete(deleteFalconJobOrder);
// .put(updateClient);

export default router;
