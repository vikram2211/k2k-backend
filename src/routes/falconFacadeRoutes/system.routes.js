
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createFalconSystem ,getAllFalconSystems, getFalconSystemById, updateFalconSystem, deleteFalconSystem
} from '../../controllers/falconFacade/helpers/systemController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/systems').get(getAllFalconSystems).post(createFalconSystem); 
router.route('/helpers/systems/:id').get(getFalconSystemById).put(updateFalconSystem);
router.route('/helpers/systems/delete').delete(deleteFalconSystem);

export default router;