import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";



// Email regex validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone regex validation (Indian format: 10 digits starting with 6-9)
const phoneRegex = /^[6-9]\d{9}$/;

// Generate JWT Token
const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1d"
    });
};

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "30d"
    });
};



// Register User

export const RegisterUser = async (req, res) => {
    try {
        const { userName, fullName, email, phone, password } = req.body;

        // headers from Flutter
        const deviceId = req.headers["x-device-id"] || "DEVICEID124"
        const deviceType = req.headers["x-platform"] || "android"
        const deviceName = req.headers["x-device-name"];
        const deviceCategory = req.headers["x-device-category"] || deviceType;
        const location = req.headers["x-location"];
        const appVersion = req.headers["x-app-version"];

        // Required fields
        if (!userName || !fullName || !email || !phone || !password || !deviceId || !deviceType) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "All fields and device information are required"
            });
        }

        // Email validation
        if (!emailRegex.test(email)) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Invalid email address"
            });
        }

        // Phone validation
        if (!phoneRegex.test(phone)) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Invalid Indian phone number"
            });
        }

        // Password match



        // Check existing user
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (existingUser) {
            return res.status(200).json({
                success: false,
                errorCode: "USER_001",
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            userName,
            fullName,
            email,
            phone,
            password: hashedPassword
        });

        // Save splash config entry
        await deviceSchema.create({
            device: {
                deviceId,
                deviceType,
                deviceName,
                deviceCategory,
                location,
                lastLogin: new Date()
            },
            userIds: [user._id]
        });

        // Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        return res.status(201).json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                appVersion
            },
            message: "User registered successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });

    }
};
// Login User
export const Login = async (req, res) => {

    try {

        const deviceId = req.headers["x-device-id"] || "DEVICEID124"
        const deviceType = req.headers["x-platform"] || "android"
        const appVersion = req.headers["x-app-version"];

        const { email, password, } = req.body;

        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(200).json({
                success: false,
                errorCode: "USER_002",
                message: "Invalid credentials"
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(200).json({
                success: false,
                errorCode: "AUTH_003",
                message: "Invalid credentials"
            });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Update device session last login
        await deviceSchema.findOneAndUpdate(
            { "device.deviceId": deviceId },
            {
                $set: { "device.lastLogin": new Date() },
                $addToSet: { userIds: user._id }
            },
            { upsert: true }
        );

        res.status(200).json({
            success: true,
            data: {
                accessToken: accessToken,
                refreshToken: refreshToken
            },
            message: "Login successful"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });

    }
};
// Logout User
export const Logout = async (req, res) => {

    // res.clearCookie("accessToken");
    // res.clearCookie("refreshToken");
    // res.clearCookie("deviceId");

    res.json({
        success: true,
        message: "Logged out successfully"
    });
};
