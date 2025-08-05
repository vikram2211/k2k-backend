import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

import {
    createIronWorkOrder, getAllIronWorkOrders, getIronWorkOrderById, updateIronWorkOrder, deleteIronWorkOrder
} from '../../controllers/ironSmith/workOrderController.js';

import { getIronProjectBasedOnClient,getIronDimensionBasedOnShape,getRawMaterialDataByProjectId } from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js'

const router = Router();
router.use(verifyJWT);

router.route('/workorder/create').post(upload.array('files'), createIronWorkOrder);
router.route('/workorder/get').get(getAllIronWorkOrders);
router.route('/workorder/:workOrderId').get(getIronWorkOrderById).put(upload.array('files'), updateIronWorkOrder);
router.route('/workorder/:workOrderId').delete(deleteIronWorkOrder);
router.route('/workorders-getProject').get(getIronProjectBasedOnClient);
router.route('/dimension-by-shape/:shapeId').get(getIronDimensionBasedOnShape);
router.route('/raw-data/:projectId').get(getRawMaterialDataByProjectId);


export default router;
