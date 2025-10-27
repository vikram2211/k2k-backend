
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createFalconProductSystem, getAllFalconProductSystems, getFalconProductSystemById, updateFalconProductSystem, deleteFalconProductSystem, getProductSystemUsageStats
} from '../../controllers/falconFacade/helpers/productSystemController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/helpers/prductsystems').post(createFalconProductSystem).get(getAllFalconProductSystems);
router.route('/helpers/prductsystems/usage-stats').get(getProductSystemUsageStats);
router.route('/helpers/prductsystems/:id').get(getFalconProductSystemById).put(updateFalconProductSystem);
router.route('/helpers/prductsystems/delete').delete(deleteFalconProductSystem);

export default router;
