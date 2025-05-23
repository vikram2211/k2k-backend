import { Router } from "express";
import {
    transferStock,getAllTransfers,getTransferById,updateTransfer,deleteTransfers,getWorkOrdersByProduct,getWorkOrderProductQuantity
} from "../controllers/konkreteKlinkers/stockTransferController.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/transfer/create").post(verifyJWT,transferStock);
router.route("/transfer/delete").post(verifyJWT,deleteTransfers);
router.route("/transfer").post(verifyJWT,getAllTransfers);
router.route("/transfer/:id").get(verifyJWT,getTransferById).put(verifyJWT,updateTransfer);
router.route("/transfer-getworkorder").get(getWorkOrdersByProduct);
router.route("/transfer-getworkorderproduct").get(getWorkOrderProductQuantity);

export default router;
