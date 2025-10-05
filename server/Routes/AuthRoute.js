import express from "express";
import { Sign, Login, VerifyOTP } from "../Controller/AuthCtrl/Login.js";
const router = express.Router();

// ✅ Signup route
router.post("/signup", Sign);
// ✅ Login route
router.post("/login", Login);
// ✅ VerifyOTP route
router.post("/verifyOtp", VerifyOTP);

export default router;
