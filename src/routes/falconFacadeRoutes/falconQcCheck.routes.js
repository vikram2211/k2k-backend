
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

import {
    standaloneQCCheck ,getSemifinishedIds, getAllQCChecks, getQCCheckDetailsById,updateFalconQc
} from '../../controllers/falconFacade/qcCheckController.js';

const router = Router();

router.use(verifyJWT);
router.route('/qc-check/create').post(standaloneQCCheck);
router.route('/qc-check').get(getAllQCChecks);
router.route('/qc/sf-ids').get(getSemifinishedIds);
router.route('/qc-check/:id').get(getQCCheckDetailsById).put(updateFalconQc);


export default router;

