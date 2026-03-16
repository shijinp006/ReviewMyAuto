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
        expiresIn: "5s"
    });
};

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "5s"
    });
};

// Set Cookie with Token
const setAuthCookies = (res, accessToken, refreshToken, deviceId) => {

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 5000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 5000
    });

};
// Register User

export const RegisterUser = async (req, res) => {
    try {
        const { userName, email, phoneNumber, password, confirmPassword, deviceId } = req.body;

        // Required fields
        if (!userName || !email || !phoneNumber || !password || !confirmPassword || !deviceId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Email validation
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address"
            });
        }

        // Phone validation
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Indian phone number"
            });
        }

        // Password match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        // Check existing user
        const existingUser = await User.findOne({
            $or: [{ email }, { phoneNumber }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            userName,
            email,
            phoneNumber,
            password: hashedPassword
        });

        // Save device
        await Device.create({
            userId: user._id,
            deviceId
        });

        // Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        setAuthCookies(res, accessToken, refreshToken, deviceId);

        return res.status(201).json({
            success: true,
            accessToken,
            refreshToken,
            message: "User registered successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// Login User
export const Login = async (req, res) => {

    try {

        const { email, password, deviceId } = req.body;

        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        setAuthCookies(res, accessToken, refreshToken, deviceId);

        res.status(200).json({
            success: true,
            accessToken: accessToken,
            refreshToken: refreshToken,
            message: "Login successful"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// Logout User
export const Logout = async (req, res) => {

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.clearCookie("deviceId");

    res.json({
        success: true,
        message: "Logged out successfully"
    });
};
