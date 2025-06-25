
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    createPackingBundle, createFalconPacking, getAllFalconPackings, getFalconPackingById, getJobOrderByWorkOrder, getWorkOrderDetails
} from '../../controllers/falconFacade/packingController.js';

const router = Router();

router.use(verifyJWT);
router.post('/packing-bundle/create',upload.any(), createPackingBundle);
router.patch('/falcon-packing/qr',  createFalconPacking);
router.get('/falcon-packing/get', getAllFalconPackings);
router.get('/falcon-packing/:workOrderId', getFalconPackingById);
router.get('/falcon-packing/jobOrderByworkOrder/:workOrderId', getJobOrderByWorkOrder);
router.get('/falcon-packing/workOrderDetails/:workOrderId/:jobOrderId', getWorkOrderDetails);


export default router;
