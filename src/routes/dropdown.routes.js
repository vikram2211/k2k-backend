import { Router } from "express";
import {
    getProductByWorkOrder,getJobOrdersForDropdown
} from "../controllers/konkreteKlinkers/dropdownApis/dropdownController.js";

// import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/products").get(getProductByWorkOrder);
router.route("/joborders").get(getJobOrdersForDropdown);


export default router;