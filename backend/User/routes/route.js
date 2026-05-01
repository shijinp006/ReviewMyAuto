import express from "express";
import { RegisterUser, Login } from "../controls/Auth.js";
import { splashCheck } from "../controls/Splash.js"
import { refreshTokenController } from "../controls/GenerateRefreshToken.js";
import { AddReview, GetVehicleReviews } from "../controls/Review.js";
import { AddVehicle, GetMyVehicles } from "../controls/Vehicle.js";
import { getAllStats } from "../controls/Admin.js";
import verifyToken from "../../Middleware/veryifyToken.js";

const router = express.Router();

// Auth Routes
router.post("/register", RegisterUser)
router.post("/login", Login)
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