import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
} from "../controllers/userController.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);

router.route("/test").get((req, res) => {
  res.status(200).json({ message: "Server is running" });
});

export default router;


//PROBLEMS:
// jwt is given while logout. after expiry, its not detecting and showing unauthorized requrest.
// and no _id is being passed after some time.

//no alert on wrong password or success or on submitting the form
