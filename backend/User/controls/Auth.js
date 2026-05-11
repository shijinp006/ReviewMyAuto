import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";
import OTP from "../models/otpSchema.js";
// import nodemailer from "nodemailer";
import twilio from "twilio";
// import dns from "dns";
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




// --- EMAIL / SMS HELPERS (Commented out — using demo OTP mode) ---
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (email, otp) => {
    try {
        console.log("📤 Sending to:", email);

        const response = await resend.emails.send({
            from: `Review My Auto <${process.env.EMAIL_SERVICE}>`,
            to: process.env.EMAIL, // For testing with Resend's inbox. Change to 'email' in production.
            subject: "Your OTP Code",
            html: `<h2>Your OTP is: ${otp}</h2>`
        });

        if (response.error) {
            console.error("❌ Resend error:", response.error);
            throw new Error(response.error.message);
        }

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

        const {
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password
        } = req.body;

        // Validation
        if (
            !userName ||
            !fullName ||
            !email ||
            !countryCode ||
            !phone ||
            !password
        ) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "All fields are required"
            });
        }

        // Existing user check
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

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create unverified user
        const user = await User.create({
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password: hashedPassword,
            isVerified: false
        });

        // Generate OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Delete old OTP if exists
        await OTP.deleteMany({ email });

        // Save OTP
        await OTP.create({
            email,
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000
        });

        // Send email
        await sendOTPEmail(email, otp);

        return res.status(201).json({
            success: true,
            message: "OTP sent successfully",
            otp: otp // Demo OTP — remove this in production
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

        const { otp } = req.body;

        // Device Headers
        const deviceId =
            req.headers["x-device-id"] || "DEVICEID124";

        const deviceType =
            req.headers["x-platform"] || "android";

        const deviceName =
            req.headers["x-device-name"];

        const deviceCategory =
            req.headers["x-device-category"] || deviceType;

        const location =
            req.headers["x-location"];

        const appVersion =
            req.headers["x-app-version"];

        // Validation
        if (!otp) {

            return res.status(200).json({

                success: false,
                errorCode: "VALID_001",
                message: "OTP is required"
            });
        }

        // Find OTP
        const otpRecord = await OTP.findOne({
            otp: String(otp)
        });

        if (!otpRecord) {

            return res.status(200).json({

                success: false,
                errorCode: "OTP_002",
                message: "OTP not found"
            });
        }

        // Check Expiry
        if (
            Date.now() > otpRecord.expiresAt
        ) {

            await OTP.deleteOne({
                _id: otpRecord._id
            });

            return res.status(200).json({

                success: false,
                errorCode: "OTP_001",
                message: "OTP expired"
            });
        }

        // Find & Verify User
        const user = await User.findOneAndUpdate(

            {
                email: otpRecord.email
            },

            {
                isVerified: true
            },

            {
                new: true
            }
        );

        if (!user) {

            return res.status(200).json({

                success: false,
                errorCode: "USER_003",
                message: "User not found"
            });
        }

        // Save Device
        await deviceSchema.findOneAndUpdate(

            {
                "device.deviceId": deviceId
            },

            {
                $set: {

                    "device.deviceId":
                        deviceId,

                    "device.deviceType":
                        deviceType,

                    "device.deviceName":
                        deviceName,

                    "device.deviceCategory":
                        deviceCategory,

                    "device.location":
                        location,

                    "device.lastLogin":
                        new Date()
                },

                $addToSet: {
                    userIds: user._id
                }
            },

            {
                upsert: true,
                new: true
            }
        );

        // Delete OTP
        await OTP.deleteOne({
            _id: otpRecord._id
        });

        // Generate Token
        const accessToken =
            generateAccessToken(
                user._id,
                deviceId
            );

        return res.status(200).json({

            success: true,

            data: {

                accessToken,
                appVersion
            },

            message:
                "Account verified successfully"
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

        // Validate Email
        if (!email) {

            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Email is required"
            });
        }

        // Generate OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Send OTP Email
        await sendOTPEmail(email, otp);

        return res.status(200).json({

            success: true,
            message: "OTP sent successfully",
            otp: otp

            // Remove in production
            // otp
        });

    } catch (error) {

        return res.status(500).json({

            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};
// 4. Login User
// LOGIN API
export const Login = async (req, res) => {

    try {

        const deviceId =
            req.headers["x-device-id"] || "DEVICEID124";

        const { email, password } = req.body;

        // Find User
        const user = await User
            .findOne({ email })
            .select("+password");

        if (!user) {

            return res.status(200).json({
                success: false,
                errorCode: "USER_002",
                message: "Invalid credentials"
            });
        }

        // Check Verification
        if (!user.isVerified) {

            return res.status(200).json({
                success: false,
                errorCode: "AUTH_004",
                message:
                    "Account is not verified"
            });
        }

        // Check Password
        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {

            return res.status(200).json({
                success: false,
                errorCode: "AUTH_003",
                message: "Invalid credentials"
            });
        }

        // Generate Login OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Save OTP
        await OTP.findOneAndUpdate(

            { email },

            {
                otp,
                expiresAt:
                    Date.now() + 5 * 60 * 1000
            },

            {
                upsert: true,
                new: true
            }
        );

        // Send OTP Mail
        await sendOTPEmail(email, otp);

        return res.status(200).json({

            success: true,

            message:
                "Login OTP sent successfully",
            otp: otp
        });

    } catch (error) {

        return res.status(500).json({

            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};

// VERIFY LOGIN OTP API
export const VerifyLoginOTP = async (req, res) => {

    try {

        const deviceId =
            req.headers["x-device-id"] || "DEVICEID124";

        const deviceType =
            req.headers["x-platform"];

        const appVersion =
            req.headers["x-app-version"];

        const { otp } = req.body;

        // Validate
        if (!otp) {

            return res.status(200).json({

                success: false,
                errorCode: "VALID_001",
                message: "OTP is required"
            });
        }

        // Find OTP Record
        const otpRecord = await OTP.findOne({
            otp: String(otp)
        });

        if (!otpRecord) {

            return res.status(200).json({

                success: false,
                errorCode: "OTP_002",
                message: "Invalid OTP"
            });
        }

        // Check Expiry
        if (
            Date.now() > otpRecord.expiresAt
        ) {

            await OTP.deleteOne({
                _id: otpRecord._id
            });

            return res.status(200).json({

                success: false,
                errorCode: "OTP_001",
                message: "OTP expired"
            });
        }

        // Find User
        const user = await User.findOne({
            email: otpRecord.email
        });

        if (!user) {

            return res.status(200).json({

                success: false,
                errorCode: "USER_003",
                message: "User not found"
            });
        }

        // Generate Tokens
        const accessToken =
            generateAccessToken(
                user._id,
                deviceId
            );


        // Save Device Session
        await deviceSchema.findOneAndUpdate(

            {
                "device.deviceId": deviceId
            },

            {
                $set: {

                    "device.deviceId":
                        deviceId,

                    "device.deviceType":
                        deviceType,

                    "device.lastLogin":
                        new Date()
                },

                $addToSet: {
                    userIds: user._id
                }
            },

            {
                upsert: true,
                new: true
            }
        );

        // Delete OTP
        await OTP.deleteOne({
            _id: otpRecord._id
        });

        return res.status(200).json({

            success: true,

            data: {

                accessToken,

                appVersion,
                deviceType
            },

            message:
                "Login successful"
        });

    } catch (error) {

        return res.status(500).json({

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

        if (!email) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Email is required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({
                success: false,
                errorCode: "USER_003",
                message: "User not found"
            });
        }

        // Generate OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const expiresAt = Date.now() + 5 * 60 * 1000;

        // Store OTP
        forgotPasswordStore.set(email, {
            otp,
            expiresAt,
            verified: false
        });

        // Send OTP Email
        await sendOTPEmail(email, otp);

        return res.status(200).json({
            success: true,
            message: "Password reset OTP sent successfully",
            otp: otp // Demo OTP — remove this in production

        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};

export const VerifyForgotOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({
                success: false,
                errorCode: "VALID_001",
                message: "OTP is required"
            });
        }

        // Get first OTP record
        const record = forgotPasswordStore.values().next().value;

        if (!record) {
            return res.status(404).json({
                success: false,
                errorCode: "OTP_003",
                message: "No OTP found"
            });
        }

        // Check expiry
        if (Date.now() > record.expiresAt) {

            return res.status(400).json({
                success: false,
                errorCode: "OTP_001",
                message: "OTP has expired"
            });
        }

        // Check OTP
        if (record.otp !== String(otp)) {

            return res.status(400).json({
                success: false,
                errorCode: "OTP_002",
                message: "Invalid OTP"
            });
        }

        // Mark verified
        record.verified = true;

        return res.status(200).json({
            success: true,
            message:
                "OTP verified successfully. You can now reset your password."
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
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
