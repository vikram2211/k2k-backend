
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
    updateFalconWorkOrder,
    getWorkOrderStatus,
    getAllWorkOrdersStatus,
    manualUpdateWorkOrderStatus
} from '../../controllers/falconFacade/workOrderController.js';

const router = Router();
console.log("coming to projects router")

router.use(verifyJWT);
router.route('/workorder/create').post(upload.array('files'), createFalconWorkOrder);
router.route('/workorders').get(getFalconWorkOrders);
router.route('/workorders/:id').get(getFalconWorkOrderById).put(upload.array('files'), updateFalconWorkOrder);
// Status tracking endpoints
router.route('/workorders/:id/status').get(getWorkOrderStatus);
router.route('/workorders/status/all').get(getAllWorkOrdersStatus);
router.route('/workorders/:workOrderId/update-status').post(manualUpdateWorkOrderStatus);
// 
router.route('/workorders-getProject').get(getFalconProjectBasedOnClient);
// router.route('/workorders-getPlant').get(getPlantBasedOnProduct);
router.route('/workorders/delete').delete(deleteFalconWorkOrder);
// .put(updateClient);

export default router;
