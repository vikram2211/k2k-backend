
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createFalconClient, updateFalconClient, getAllFalconClients, getFalconClientById, deleteFalconClient
} from '../../controllers/falconFacade/helpers/clientController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/clients').get(getAllFalconClients).post(createFalconClient);
router.route('/helpers/clients/:id').get(getFalconClientById).put(updateFalconClient);
router.route('/helpers/clients/delete').delete(deleteFalconClient);

export default router;