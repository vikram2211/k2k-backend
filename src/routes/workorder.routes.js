
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
    createWorkOrder,
    getWorkOrder,
    getWorkOrderById,
    getProjectBasedOnClient,
    getPlantBasedOnProduct,
    deleteWorkOrder,
    updateWorkOrder
} from '../controllers/konkreteKlinkers/workOrder.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/workorder/create').post(upload.array('files'), createWorkOrder);
router.route('/workorders').get(getWorkOrder);
router.route('/workorders/:id').get(getWorkOrderById).put(upload.array('files'), updateWorkOrder);
router.route('/workorders-getProject').get(getProjectBasedOnClient);
router.route('/workorders-getPlant').get(getPlantBasedOnProduct);
router.route('/workorders-delete').delete(deleteWorkOrder);
// .put(updateClient);

export default router;
