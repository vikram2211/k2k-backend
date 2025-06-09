
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import {
    getProductionsByProcess
} from '../../controllers/falconFacade/falconProductionController.js';

const router = Router();

router.use(verifyJWT);
// router.post('/internal-workorder/create', upload.any(), createInternalWorkOrder);
router.get('/falcon-production/get', getProductionsByProcess);

export default router;
