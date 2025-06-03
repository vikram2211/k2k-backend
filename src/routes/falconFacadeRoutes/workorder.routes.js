
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    createFalconWorkOrder,
    getFalconWorkOrders,
    getFalconWorkOrderById,
    getFalconProjectBasedOnClient,
    // getPlantBasedOnProduct,
    deleteFalconWorkOrder,
    updateFalconWorkOrder
} from '../../controllers/falconFacade/workOrderController.js';

const router = Router();
console.log("coming to projects router")

router.use(verifyJWT);
router.route('/workorder/create').post(upload.array('files'), createFalconWorkOrder);
router.route('/workorders').get(getFalconWorkOrders);
router.route('/workorders/:id').get(getFalconWorkOrderById).put(upload.array('files'), updateFalconWorkOrder);
// 
router.route('/workorders-getProject').get(getFalconProjectBasedOnClient);
// router.route('/workorders-getPlant').get(getPlantBasedOnProduct);
router.route('/workorders/delete').delete(deleteFalconWorkOrder);
// .put(updateClient);

export default router;
