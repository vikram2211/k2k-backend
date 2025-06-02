
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    createFalconWorkOrder,
    getFalconWorkOrders,
    getFalconWorkOrderById,
    // getProjectBasedOnClient,
    // getPlantBasedOnProduct,
    // deleteWorkOrder,
    // updateWorkOrder
} from '../../controllers/falconFacade/workOrderController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/workorder/create').post(upload.array('files'), createFalconWorkOrder);
router.route('/workorders').get(getFalconWorkOrders);
router.route('/workorders/:id').get(getFalconWorkOrderById)
// .put(upload.array('files'), updateWorkOrder);
// router.route('/workorders-getProject').get(getProjectBasedOnClient);
// router.route('/workorders-getPlant').get(getPlantBasedOnProduct);
// router.route('/workorders-delete').delete(deleteWorkOrder);
// .put(updateClient);

export default router;
