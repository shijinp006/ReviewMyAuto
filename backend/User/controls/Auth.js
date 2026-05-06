import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";
import nodemailer from "nodemailer";
import twilio from "twilio";
import dns from "dns";
import { Resend } from "resend";
// dns.setDefaultResultOrder("ipv4first");

// let twilioClient = null;

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

// Stores
const registrationStore = new Map();
const forgotPasswordStore = new Map();

// --- EMAIL / SMS HELPERS (Commented out — using demo OTP mode) ---
const resend = new Resend("re_hh46a3fM_N1ppDv1UmWjEKp3wheXHJpTZ");

const sendOTPEmail = async (email, otp) => {
    try {
        const response = await resend.emails.send({
            from: "shijinp9404@gmail.com",
            to: email,
            subject: "Your OTP Code",
            html: `<h2>Your OTP is: ${otp}</h2>`
        });

        console.log("✅ Email sent:", response);

    } catch (err) {
        console.error("❌ Email error:", err);
        throw err;
    }
};
// const sendOTPSms = async (phone, countryCode, otp, text) => {
//     if (!phone || !countryCode) return;
//     if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
//         twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
//     }
//     if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
//         try {
//             const formattedPhone = countryCode.startsWith('+') ? `${countryCode}${phone}` : `+${countryCode}${phone}`;
//             await twilioClient.messages.create({
//                 body: text,
//                 from: process.env.TWILIO_PHONE_NUMBER,
//                 to: formattedPhone
//             });
//         } catch (err) {
//             console.error("Failed to send SMS", err);
//         }
//     }
// };

// 1. Register API — generates demo OTP and returns it in response
export const RegisterUser = async (req, res) => {
    try {
        const { userName, fullName, email, countryCode, phone, password } = req.body;

        if (!userName || !fullName || !email || !countryCode || !phone || !password) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "All fields are required"
            });
        }

        if (!emailRegex.test(email)) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Invalid email address"
            });
        }

        if (!phoneRegex.test(phone)) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Invalid phone number"
            });
        }

        const existingUser = await User.findOne({
            $or: [{ email }, { phone }, { userName }]
        });

        if (existingUser) {
            return res.status(200).json({
                success: false,
                errorCode: "USER_001",
                message: "User already exists"
            });
        }

        // ✅ Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        registrationStore.set(email, {
            userDetails: { userName, fullName, email, countryCode, phone, password },
            otp,
            expiresAt,
            resendCount: 0,
            firstResendAt: Date.now()
        });

        // ✅ Send email
        try {
            await sendOTPEmail(email, otp);
        } catch (err) {
            console.error("❌ FULL EMAIL ERROR:", err);

            return res.status(200).json({
                success: false,
                errorCode: "EMAIL_001",
                message: err.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your email"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};

// 2. Verify OTP API
export const VerifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const deviceId = req.headers["x-device-id"] || "DEVICEID124";
        const deviceType = req.headers["x-platform"] || "android";
        const deviceName = req.headers["x-device-name"];
        const deviceCategory = req.headers["x-device-category"] || deviceType;
        const location = req.headers["x-location"];
        const appVersion = req.headers["x-app-version"];

        if (!email || !otp) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Email and OTP are required"
            });
        }

        const record = registrationStore.get(email);

        if (!record) {
            return res.status(200).json({
                success: false,
                errorCode: "OTP_002",
                message: "OTP session not found or expired. Please register again."
            });
        }

        if (Date.now() > record.expiresAt) {
            registrationStore.delete(email);
            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "OTP has expired"
            });
        }

        if (record.otp !== String(otp)) {
            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "Invalid OTP"
            });
        }

        // OTP Valid. Create user.
        const { userName, fullName, countryCode, phone, password } = record.userDetails;

        const existingUser = await User.findOne({
            $or: [{ email }, { phone }, { userName }]
        });

        if (existingUser) {
            registrationStore.delete(email);
            return res.status(200).json({
                success: false,
                errorCode: "USER_001",
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password: hashedPassword,
            isVerified: true
        });

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

        registrationStore.delete(email);

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

// 3. Resend OTP API — generates new demo OTP and returns it
export const ResendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(200).json({ success: false, errorCode: "VALID_001", message: "Email is required" });
        }

        const record = registrationStore.get(email);

        if (!record) {
            return res.status(200).json({ success: false, errorCode: "OTP_003", message: "No pending registration found for this email" });
        }

        const now = Date.now();

        if (now - record.firstResendAt > 10 * 60 * 1000) {
            record.resendCount = 0;
            record.firstResendAt = now;
        }

        if (record.resendCount >= 3) {
            return res.status(200).json({ success: false, errorCode: "OTP_004", message: "Maximum resend attempts reached. Please try again after 10 minutes." });
        }

        // Generate new demo OTP
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        record.otp = newOtp;
        record.expiresAt = now + 5 * 60 * 1000;
        record.resendCount += 1;

        // Demo mode: return OTP in response instead of sending email
        // TODO: Uncomment sendOTPEmail when email service is configured
        // await sendOTPEmail(email, newOtp, 'Your Resend Registration OTP', `Your new OTP is: ${newOtp}. Valid for 5 minutes.`);

        return res.status(200).json({
            success: true,
            data: { otp: newOtp }, // Demo OTP — remove this in production
            message: "New OTP generated successfully"
        });

    } catch (error) {
        return res.status(500).json({ success: false, errorCode: "SERVER_001", message: error.message });
    }
};

// 4. Login User
export const Login = async (req, res) => {
    try {
        const deviceId = req.headers["x-device-id"] || "DEVICEID124";
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(200).json({
                success: false,
                errorCode: "USER_002",
                message: "Invalid credentials"
            });
        }

        if (!user.isVerified) {
            return res.status(200).json({
                success: false,
                errorCode: "AUTH_004",
                message: "Account is not verified. Please complete verification."
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
                accessToken,
                refreshToken
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

// 5. Forgot Password Flow — generates demo OTP and returns it

export const ForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(200).json({ success: false, errorCode: "VALID_001", message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(200).json({ success: false, errorCode: "USER_003", message: "User not found" });

        // Generate demo OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        forgotPasswordStore.set(email, { otp, expiresAt, verified: false });

        // Demo mode: return OTP in response instead of sending email
        // TODO: Uncomment sendOTPEmail when email service is configured
        // await sendOTPEmail(email, otp, 'Password Reset OTP', `Your OTP to reset password is: ${otp}. Valid for 5 minutes.`);

        return res.status(200).json({
            success: true,
            data: { otp }, // Demo OTP — remove this in production
            message: "Password reset OTP generated successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, errorCode: "SERVER_001", message: error.message });
    }
};

export const VerifyForgotOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(200).json({ success: false, errorCode: "VALID_001", message: "Email and OTP are required" });

        const record = forgotPasswordStore.get(email);
        if (!record) return res.status(200).json({ success: false, errorCode: "OTP_003", message: "No password reset request found" });

        if (Date.now() > record.expiresAt) {
            forgotPasswordStore.delete(email);
            return res.status(200).json({ success: false, errorCode: "OTP_001", message: "OTP has expired" });
        }

        if (record.otp !== String(otp)) {
            return res.status(200).json({ success: false, errorCode: "OTP_001", message: "Invalid OTP" });
        }

        record.verified = true;

        return res.status(200).json({ success: true, message: "OTP verified successfully. You can now reset your password." });
    } catch (error) {
        return res.status(500).json({ success: false, errorCode: "SERVER_001", message: error.message });
    }
};

export const ResetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) return res.status(200).json({ success: false, errorCode: "VALID_001", message: "Email and new password are required" });

        const record = forgotPasswordStore.get(email);
        if (!record || !record.verified) {
            return res.status(200).json({ success: false, errorCode: "AUTH_005", message: "Unauthorized. Please verify OTP first." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        forgotPasswordStore.delete(email);

        return res.status(200).json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, errorCode: "SERVER_001", message: error.message });
    }
};

export const Logout = async (req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
};
