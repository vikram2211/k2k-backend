
import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import {
    createIronProject, updateIronProject, getAllIronProjects, getIronProjectById, deleteIronProject, addRawMaterial, updateRawMaterial, deleteRawMaterial, getRawMaterialsByProjectId
} from '../../controllers/ironSmith/helper/projectController.js';
// import 'mongoose' from "mongoose";
const router = Router();
router.use(verifyJWT);
// console.log("coming to clients router")
router.route('/helpers/projects').get(getAllIronProjects).post(createIronProject);
router.route('/helpers/projects/:id').get(getIronProjectById).put(updateIronProject);
router.route('/helpers/projects/delete').delete(deleteIronProject)

//RAW MATERIAL ROUTES - 
router.route('/helpers/rawMaterials').post(addRawMaterial);
router.route('/helpers/rawMaterials/:id').put(updateRawMaterial).delete(deleteRawMaterial);
router.route('/helpers/rawMaterials/project/:projectId').get(getRawMaterialsByProjectId);


export default router;
