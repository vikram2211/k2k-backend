
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    createJobOrder,
    getJobOrders,
    getJobOrderById,
    updateJobOrder,
    deleteJobOrder,
    getMachinesByProduct
} from '../controllers/konkreteKlinkers/jobOrderController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/joborder/create').post(createJobOrder);
router.route('/joborders').get(getJobOrders);
router.route('/joborders/:id').get(getJobOrderById).put(updateJobOrder);
router.route('/joborders/delete').delete(deleteJobOrder);
router.route('/joborder-getMachine').get(getMachinesByProduct);
// router.route('/helpers/clients/:id').get(getClientById).put(updateClient);

export default router;
