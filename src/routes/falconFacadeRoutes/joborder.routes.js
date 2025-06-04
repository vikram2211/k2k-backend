
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    createFalconJobOrder, getFalconJobOrders, updateFalconJobOrder,deleteFalconJobOrder,getFalconJobOrderById
} from '../../controllers/falconFacade/jobOrderController.js';

const router = Router();
// console.log("coming to projects router")

router.use(verifyJWT);
router.route('/joborder/create').post(upload.array('files'), createFalconJobOrder);
router.route('/joborders').get(getFalconJobOrders);
router.route('/joborders/:id').get(getFalconJobOrderById).put(upload.array('files'), updateFalconJobOrder); //
// // 
// router.route('/workorders-getProject').get(getFalconProjectBasedOnClient);
// // router.route('/workorders-getPlant').get(getPlantBasedOnProduct);
router.route('/joborders/delete').delete(deleteFalconJobOrder);
// .put(updateClient);

export default router;
