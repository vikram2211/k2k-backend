
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

import {
    createIronMachine, updateIronMachine, getAllIronMachines, getIronMachineById, deleteIronMachine 
} from '../../controllers/ironSmith/helper/machineController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/machines').get(getAllIronMachines).post(createIronMachine);
// router.route('/helpers/machines').get(getAllIronMachines).post(upload.array('file'),createIronMachine);
router.route('/helpers/machines/:id').get(getIronMachineById).put(updateIronMachine);
router.route('/helpers/machines/delete').delete(deleteIronMachine)

export default router;
