
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    getJobOrdersByDate,
    // handleDailyProductionAction,
    handleDailyProductionActions,
    addDowntime,
    getDowntimeByProduct,
    getProductionLogByProduct,
    getUpdatedProductProduction
} from '../controllers/konkreteKlinkers/productioController.js';

const router = Router();
router.use(verifyJWT);
router.route('/production').get(getJobOrdersByDate);
router.route('/updated-production').get(getUpdatedProductProduction);
router.route('/production/log').get(getProductionLogByProduct);
router.route('/production/downtime').post(addDowntime).get(getDowntimeByProduct);
// router.route('/production/action').post(handleDailyProductionAction);
router.route('/production/action').post(handleDailyProductionActions);


export default router;
