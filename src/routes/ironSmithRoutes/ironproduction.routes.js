import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

import {
    getProductionData,manageIronProductionActions,updateIronProductionQuantities, addIronDowntime, getIronDowntime,getProductionLog
,addQcCheck,addMachineToProduction} from '../../controllers/ironSmith/productionController.js';

const router = Router();
router.use(verifyJWT);

router.route('/production/get').get( getProductionData);
router.route('/production/manage').post( manageIronProductionActions);
router.route('/production/update-qty').post( updateIronProductionQuantities);
router.route('/production/downtime').post( addIronDowntime).get( getIronDowntime);
router.route('/production/production-log').get( getProductionLog);
router.route('/production/qc').post( addQcCheck);
router.route('/production/add-machine').post( addMachineToProduction);

export default router;
