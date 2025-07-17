
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

import {
    createIronShape, updateIronShape, getAllIronShapes, getIronShapeById, deleteIronShape} from '../../controllers/ironSmith/helper/shapeController.js';
import {
    getDimensions} from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/shapes').get(getAllIronShapes).post(upload.array('file'),createIronShape);
router.route('/helpers/shapes/:id').get(getIronShapeById).put(upload.array('file'),updateIronShape);
router.route('/helpers/shapes/delete').delete(deleteIronShape);
router.route('/dropdown/dimensions').get(getDimensions);


export default router;
