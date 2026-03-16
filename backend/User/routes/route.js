import express from "express";
import { RegisterUser, Login } from "../controls/Auth.js";
import { splashCheck } from "../controls/Splash.js"
import { refreshTokenController } from "../controls/GenerateRefrshToken.js";
const router = express.Router();

router.post("/register", RegisterUser)
router.post("/login", Login)


router.post("/device-check", splashCheck);
router.post("/refresh-token", refreshTokenController);

export default router