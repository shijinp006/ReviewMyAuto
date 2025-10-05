import express from "express";
import { Sign, Login } from "../Controller/AuthCtrl/Login.js";
const router = express.Router();

// ✅ Signup route
router.post("/signup", Sign);

// ✅ Login route
router.post("/login", Login);

export default router;
