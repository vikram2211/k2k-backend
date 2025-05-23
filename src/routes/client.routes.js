
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
} from '../controllers/konkreteKlinkers/helpers/clientController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/clients').get(getAllClients).post(createClient);
router.route('/helpers/clients/:id').get(getClientById).put(updateClient);
router.route('/helpers/clients/delete').delete(deleteClient)

export default router;
