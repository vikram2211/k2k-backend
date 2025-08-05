import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

import {
    createQCCheck, getAllQCChecks, getQCCheckById,updateQCCheck, deleteQCCheck} from '../../controllers/ironSmith/qcController.js';
import {
    getWorkOrderProductByJobOrder} from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js';

const router = Router();
router.use(verifyJWT);

router.route('/qc/get').get( getAllQCChecks);
router.route('/qc/create').post( createQCCheck);
router.route('/qc/:id').get( getQCCheckById).patch(updateQCCheck);
router.route('/qc/delete').delete( deleteQCCheck);
router.route('/qc/wo-product/:id').get( getWorkOrderProductByJobOrder);

export default router;
