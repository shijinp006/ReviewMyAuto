import express from "express";
import { RegisterUser, Login } from "../controls/Auth.js";
import { splashCheck } from "../controls/Splash.js"
const router = express.Router();

router.post("/register", RegisterUser)
router.post("/login", Login)


router.post("/splash-check", splashCheck);

export default router