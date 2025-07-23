import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

import {
    createIronJobOrder, getAllIronJobOrders,updateIronJobOrder
} from '../../controllers/ironSmith/jobOrderController.js';

// import { getIronProjectBasedOnClient,getIronDimensionBasedOnShape } from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js'

const router = Router();
router.use(verifyJWT);

router.route('/joborder/create').post( createIronJobOrder);
router.route('/joborder/get').get( getAllIronJobOrders);
router.route('/joborder/:id').put( updateIronJobOrder);


export default router;
