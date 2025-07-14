
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createIronClient, updateIronClient, getAllIronClients, getIronClientById, deleteIronClient
} from '../../controllers/ironSmith/helper/clientController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/clients').get(getAllIronClients).post(createIronClient);
router.route('/helpers/clients/:id').get(getIronClientById).put(updateIronClient);
router.route('/helpers/clients/delete').delete(deleteIronClient)

export default router;
