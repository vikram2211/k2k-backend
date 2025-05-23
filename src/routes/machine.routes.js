// createMachine


import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    createMachine,
    getAllMachines,
    getMachineById,
    updateMachine,
    deleteMachine
} from '../controllers/konkreteKlinkers/helpers/machineController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
// console.log("coming to clients router")
router.route('/helpers/machine').post(createMachine);
router.route('/helpers/machines').get(getAllMachines);
router.route('/helpers/machines/:id').get(getMachineById).put(updateMachine);
router.route('/helpers/machines/delete').delete(deleteMachine);
// .put(updateClient);

export default router;
