
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    getJobOrdersByDate,
    // handleDailyProductionAction,
    handleDailyProductionActions,
    addDowntime,
    getDowntimeByProduct,
    getProductionLogByProduct,
    getUpdatedProductProduction,
    updateDowntime,
    getKKMonthlyProductionCounts
} from '../controllers/konkreteKlinkers/productioController.js';

const router = Router();
router.use(verifyJWT);
router.route('/production').get(getJobOrdersByDate);
router.route('/updated-production').get(getUpdatedProductProduction);
router.route('/production/log').get(getProductionLogByProduct);
router.route('/production/downtime').post(addDowntime).get(getDowntimeByProduct);
router.route('/production/downtime/edit/:prodId/:downtimeId').patch(updateDowntime);
// router.route('/production/action').post(handleDailyProductionAction);
router.route('/production/action').post(handleDailyProductionActions);
// Simple monthly counts endpoint for dashboard
router.route('/production/monthly-counts').get(getKKMonthlyProductionCounts);


export default router;
