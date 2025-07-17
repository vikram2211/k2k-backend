import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

import {
    createIronWorkOrder, getAllIronWorkOrders, getIronWorkOrderById, updateIronWorkOrder, deleteIronWorkOrder
} from '../../controllers/ironSmith/workOrderController.js';

import { getIronProjectBasedOnClient } from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js'

const router = Router();
router.use(verifyJWT);

router.route('/workorder/create').post(upload.array('files'), createIronWorkOrder);
router.route('/workorder/get').get(getAllIronWorkOrders);
router.route('/workorder/:workOrderId').get(getIronWorkOrderById).put(upload.array('files'), updateIronWorkOrder);
router.route('/workorder/:workOrderId').delete(deleteIronWorkOrder);
router.route('/workorders-getProject').get(getIronProjectBasedOnClient);


export default router;
