
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    createPlant,
    getAllPlants,
    getPlantById,
    updatePlant,
    deletePlant
} from '../controllers/konkreteKlinkers/helpers/plantController.js';
// import 'mongoose' from "mongoose";
const router = Router();
// router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/plant').post(verifyJWT,createPlant);
router.route('/helpers/plants').get(verifyJWT,getAllPlants);
router.route('/helpers/plants/:id').get(verifyJWT,getPlantById).put(verifyJWT,updatePlant);
router.route('/helpers/plants/delete').delete(verifyJWT,deletePlant);

export default router;
