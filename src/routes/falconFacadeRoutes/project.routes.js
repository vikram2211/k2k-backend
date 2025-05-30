
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createFalconProject,
    updateFalconProject, getAllFalconProjects, getFalconProjectById, deleteFalconProject
} from '../../controllers/falconFacade/helpers/projectController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/helpers/projects').post(createFalconProject).get(getAllFalconProjects);
router.route('/helpers/projects/:id').get(getFalconProjectById).put(updateFalconProject);
router.route('/helpers/projects/delete').delete(deleteFalconProject);

export default router;
