
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

import {
    createIronWorkOrder} from '../../controllers/ironSmith/workOrderController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/workorder/create').post(upload.array('files'),createIronWorkOrder);
// .get(getAllIronShapes)
// router.route('/helpers/shapes/:id').get(getIronShapeById).put(upload.array('file'),updateIronShape);
// router.route('/helpers/shapes/delete').delete(deleteIronShape);

export default router;
