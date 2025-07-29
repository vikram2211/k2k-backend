import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

import {
    getProductionData
} from '../../controllers/ironSmith/productionController.js';

const router = Router();
router.use(verifyJWT);

router.route('/production/get').get( getProductionData);

export default router;
