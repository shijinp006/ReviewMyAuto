import express from "express";
import { RegisterUser, VerifyOTP, ResendOTP, Login, ForgotPassword, VerifyForgotOTP, ResetPassword, VerifyLoginOTP } from "../controls/Auth.js";
import { splashCheck } from "../controls/Splash.js"
import { refreshTokenController } from "../controls/GenerateRefreshToken.js";
import { AddReview, GetVehicleReviews } from "../controls/Review.js";
import { AddVehicle, GetMyVehicles } from "../controls/Vehicle.js";
import { getAllStats } from "../controls/Admin.js";
import verifyToken from "../../Middleware/veryifyToken.js";

const router = express.Router();

// Auth Routes
router.post("/register", RegisterUser);
router.post("/verify-otp", VerifyOTP);
router.post("/resend-otp", ResendOTP);
router.post("/login", Login);
router.post("/forgot-password", ForgotPassword);
router.post("/verify-forgot-otp", VerifyForgotOTP);
router.post("/reset-password", ResetPassword);
router.post("/verify-login-otp", VerifyLoginOTP);
router.post("/refresh-token", refreshTokenController);

// Device/Splash Routes
router.post("/device-check", splashCheck);

// Review Routes
router.post("/add-review", AddReview);
router.get("/reviews/:vehicleId", GetVehicleReviews);

// Vehicle Routes
router.post("/add-vehicle", AddVehicle);
router.get("/my-vehicles", GetMyVehicles);

// Admin/Dashboard Stats
router.get("/all-stats", getAllStats);

export default router