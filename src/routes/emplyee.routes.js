import { Router } from "express";
import {
    createEmployee,
    getEmployees

} from "../controllers/employeeController.js";

const router = Router();

router.route("/emplyee/create").post(createEmployee);
router.route("/emplyee/get").get(getEmployees);


export default router;

