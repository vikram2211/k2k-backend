
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject
} from '../controllers/konkreteKlinkers/helpers/projectController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to projects router")
router.route('/helpers/projects').post(createProject).get(getAllProjects);
router.route('/helpers/projects/:id').get(getProjectById).put(updateProject);
router.route('/helpers/projects/delete').delete(deleteProject);

export default router;
