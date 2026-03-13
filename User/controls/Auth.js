import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";



// Email regex validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone regex validation (Indian format: 10 digits starting with 6-9)
const phoneRegex = /^[6-9]\d{9}$/;

// Generate JWT Token
const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "30d"
    });
};

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "30d"
    });
};

// Set Cookie with Token
const setAuthCookies = (res, accessToken, refreshToken, deviceId) => {

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie("deviceId", deviceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

};
// Register User

export const RegisterUser = async (req, res) => {

    try {

        const { userName, email, phoneNumber, password, confirmPassword, deviceId } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: "Device ID required"
            })
        }
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be valid Indian number"
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            userName,
            email,
            phoneNumber,
            password: hashedPassword,

        });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        setAuthCookies(res, accessToken, refreshToken, deviceId);

        res.status(201).json({
            success: true,
            message: "User registered successfully"
        });

    } catch (error) {

        res.status(500).json({
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
