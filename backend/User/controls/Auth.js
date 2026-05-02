import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";
import nodemailer from "nodemailer";
import twilio from "twilio";

// Lazy initialization variables
let twilioClient = null;
let transporter = null;

// Email regex validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone regex validation (general: 7 to 15 digits)
const phoneRegex = /^\d{7,15}$/;

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

// In-memory store for OTPs (Key: email, Value: OTP)
const otpStore = new Map();

// Generate OTP for Registration
export const GenerateOTP = async (req, res) => {
    try {
        // Initialize Nodemailer lazily
        if (!transporter) {
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // Use STARTTLS on port 587
                family: 4, // Force IPv4 because user network doesn't support IPv6
                auth: {
                    user: process.env.EMAIL_USER || "shijinp9404@gmail.com",
                    pass: process.env.EMAIL_PASS || "zxpb fpwr mvac qior"
                }
            });
        }

        // Initialize Twilio lazily
        if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        }

        const { email, phone, countryCode } = req.body;

        if (!email && (!phone || !countryCode)) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Either Email or Phone with Country Code is required to generate OTP"
            });
        }

        const query = [];
        if (email) query.push({ email });
        if (phone) query.push({ phone });

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: query
        });

        if (existingUser) {
            return res.status(200).json({
                success: false,
                errorCode: "USER_001",
                message: "User already exists with this information"
            });
        }

        // Generate a 6-digit common OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const identifier = email || phone;

        // Store OTP in variable
        otpStore.set(identifier, otp);

        // Remove OTP after 10 minutes (600,000 ms) to allow enough time for SMS/Email
        setTimeout(() => {
            if (otpStore.get(identifier) === otp) {
                otpStore.delete(identifier);
            }
        }, 10 * 60 * 1000);

        // Send Email
        if (email) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER || "shijinp9404@gmail.com",
                    to: email,
                    subject: 'Your Registration OTP',
                    text: `Your OTP for registration is: ${otp}.  It is valid for 10 minutes.`
                });
            } catch (err) {
                console.error("Failed to send email:", err.message);
                return res.status(200).json({
                    success: false,
                    errorCode: "EMAIL_001",
                    message: `Failed to send email: ${err.message}`
                });
            }
        }

        // Send SMS
        if (phone && countryCode && twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                const formattedPhone = countryCode.startsWith('+') ? `${countryCode}${phone}` : `+${countryCode}${phone}`;
                await twilioClient.messages.create({
                    body: `Your OTP for registration is: ${otp}. It is valid for 10 minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: formattedPhone
                });
            } catch (err) {
                console.error("Failed to send SMS", err);
            }
        }

        return res.status(200).json({
            success: true,
            data: { otp }, // Keeping this here temporarily for testing without credentials
            message: "OTP generated and sent via Email and SMS successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};


// Register User

export const RegisterUser = async (req, res) => {
    try {
        const { userName, fullName, email, countryCode, phone, password, otp } = req.body;

        // headers from Flutter
        const deviceId = req.headers["x-device-id"] || "DEVICEID124"
        const deviceType = req.headers["x-platform"] || "android"
        const deviceName = req.headers["x-device-name"];
        const deviceCategory = req.headers["x-device-category"] || deviceType;
        const location = req.headers["x-location"];
        const appVersion = req.headers["x-app-version"];

        // Required fields (added otp to requirements)
        if (!userName || !fullName || !email || !countryCode || !phone || !password || !otp || !deviceId || !deviceType) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "All fields, OTP, and device information are required"
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
                message: "Invalid phone number"
            });
        }

        // Password match



        // Verify OTP
        const storedOtp = otpStore.get(email) || otpStore.get(phone);
        if (!storedOtp || storedOtp !== otp) {
            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "Invalid or expired OTP"
            });
        }

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
            countryCode,
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

        // Clear the OTP upon successful registration
        if (email) otpStore.delete(email);
        if (phone) otpStore.delete(phone);

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
