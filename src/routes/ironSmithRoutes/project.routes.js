
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createIronProject, updateIronProject, getAllIronProjects, getIronProjectById, deleteIronProject
} from '../../controllers/ironSmith/helper/projectController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT); 
// console.log("coming to clients router")
router.route('/helpers/projects').get(getAllIronProjects).post(createIronProject);
router.route('/helpers/projects/:id').get(getIronProjectById).put(updateIronProject);
router.route('/helpers/projects/delete').delete(deleteIronProject)

export default router;
