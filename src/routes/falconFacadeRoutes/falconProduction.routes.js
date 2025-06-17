
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    getProductionsByProcess, startProduction, productionQCCheck,getProductionById

} from '../../controllers/falconFacade/falconProductionController.js';

const router = Router();

router.use(verifyJWT);
// router.post('/internal-workorder/create', upload.any(), createInternalWorkOrder);
router.get('/falcon-production/get', getProductionsByProcess);

router.patch('/falcon-production/:id/start', startProduction);
router.patch('/falcon-production/:productionId/qc-check', productionQCCheck);
router.get('/falcon-production/:productionId', getProductionById);

export default router;
