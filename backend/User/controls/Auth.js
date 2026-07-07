import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";
import twilio from "twilio";
import nodemailer from "nodemailer";
import dns from "dns";
let twilioClient = null;
import { Resend } from "resend";
import { Otp } from "../models/otpSchema.js"

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
const loginOtpStore = new Map()
const forgotPasswordStore = new Map();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOTPEmail = async (email, otp) => {
    const { data, error } = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Registration OTP",
        html: `
            <h2>OTP Verification</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>Valid for 5 minutes.</p>
        `
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

// Helper to send SMS
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

// 1. Register API
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

        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

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
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({
            $or: [
                { email },
                { phone }
            ]
        });

        if (existingUser) {
            return res.status(200).json({
                success: false,
                message: "User already exists"
            });
        }

        const emailOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const phoneOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // Remove old OTP for this device
        await Otp.deleteMany({
            deviceId
        });

        await Otp.create({
            deviceId,
            email,
            emailotp: emailOtp,
            mobileotp: phoneOtp,
            userDetails: {
                userName,
                fullName,
                email,
                countryCode,
                phone,
                password
            },
            expiresAt
        });
        const demoEmail = "autopulseindia13@gmail.com"
        await sendOTPEmail(
            demoEmail,
            emailOtp
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

export const VerifyRegistrationOTP = async (
    req,
    res
) => {
    try {

        const {
            emailOtp,
            phoneOtp
        } = req.body;

        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

        if (!emailOtp && !phoneOtp) {
            return res.status(200).json({
                success: false,
                message:
                    "Both email and phone OTPs are required"
            });
        }

        const otpRecord =
            await Otp.findOne({
                deviceId
            });

        if (!otpRecord) {
            return res.status(200).json({
                success: false,
                message:
                    "Registration session expired"
            });
        }

        if (
            Date.now() >
            new Date(
                otpRecord.expiresAt
            ).getTime()
        ) {

            await Otp.deleteOne({
                _id: otpRecord._id
            });

            return res.status(200).json({
                success: false,
                message: "OTP expired"
            });
        }

        if (
            emailOtp &&
            emailOtp !== String(otpRecord.emailotp)
        ) {
            return res.status(200).json({
                success: false,
                message:
                    "Invalid email OTP"
            });
        }

        if (
            phoneOtp &&
            phoneOtp !== "123456"
        ) {
            return res.status(200).json({
                success: false,
                message: "Invalid phone OTP"
            });
        }

        const {
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password
        } = otpRecord.userDetails;

        const existingUser =
            await User.findOne({
                $or: [
                    { email },
                    { phone },

                ]
            });

        if (existingUser) {

            await Otp.deleteOne({
                _id: otpRecord._id
            });

            return res.status(200).json({
                success: false,
                message:
                    "User already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const user =
            await User.create({
                userName,
                fullName,
                email,
                countryCode,
                phone,
                password:
                    hashedPassword,
                isVerified: true
            });

        const deviceType =
            req.headers["X-Platform"] ||
            "android";

        const deviceName =
            req.headers["X-App-Version"];

        const deviceCategory =
            req.headers[
            "X-Device-Category"
            ] || deviceType;

        const location =
            req.headers["X-Location"];

        await deviceSchema.create({
            device: {
                deviceId,
                deviceType,
                deviceName,
                deviceCategory,
                location,
                lastLogin:
                    new Date()
            },
            userIds: [user._id]
        });

        await Otp.deleteOne({
            _id: otpRecord._id
        });

        const accessToken =
            jwt.sign(
                {
                    userId: user._id,
                    email: user.email,
                    role:
                        user.role ||
                        "user"
                },
                process.env.JWT_ACCESS_SECRET,
                {
                    expiresIn: "1d"
                }
            );

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                accessToken
            },
            message:
                "Registration completed successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

export const Login = async (req, res) => {
    try {

        const { email, password } = req.body;

        // const email = "autopulseindia13@gmail.com";
        // const password = "1234abcd";

        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

        const user = await User.findOne({
            email
        }).select("+password");

        if (!user) {
            return res.status(200).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.status(200).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Remove previous OTPs for this device
        await Otp.deleteMany({
            deviceId
        });

        await Otp.create({
            email: user.email,
            deviceId,
            emailotp: otp,
            mobileotp: otp,
            userId: user._id,
            expiresAt: new Date(
                Date.now() + 5 * 60 * 1000
            )
        });

        const demoEmail = "autopulseindia13@gmail.com"

        await sendOTPEmail(
            demoEmail,
            otp
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// 2. Verify OTP API
export const VerifyLoginOtp = async (
    req,
    res
) => {
    try {

        const { otp } = req.body;

        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

        if (!otp) {
            return res.status(200).json({
                success: false,
                message: "OTP is required"
            });
        }

        const data =
            await Otp.findOne({
                deviceId
            });

        if (!data) {
            return res.status(200).json({
                success: false,
                message:
                    "OTP expired or not found"
            });
        }

        if (
            data.expiresAt <
            new Date()
        ) {

            await Otp.deleteOne({
                _id: data._id
            });

            return res.status(200).json({
                success: false,
                message: "OTP expired"
            });
        }

        if (
            data.emailotp !==
            String(otp)
        ) {
            return res.status(200).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        const token =
            jwt.sign(
                {
                    id: data.userId,
                    email:
                        data.email
                },
                process.env.JWT_ACCESS_SECRET,
                {
                    expiresIn: "7d"
                }
            );

        await Otp.deleteOne({
            _id: data._id
        });

        return res.status(200).json({
            success: true,
            message:
                "Login successful",
            token
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message:
                error.message
        });

    }
};
// 3. Resend OTP API
export const ResendOTP = async (req, res) => {
    try {

        const { type } = req.body;

        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

        const record = await Otp.findOne({
            deviceId
        });

        if (!record) {
            return res.status(200).json({
                success: false,
                message: "OTP session expired"
            });
        }

        const now = Date.now();

        // Reset resend counter after 10 minutes
        if (
            now -
            new Date(record.firstResendAt).getTime() >
            10 * 60 * 1000
        ) {
            record.resendCount = 0;
            record.firstResendAt = new Date(now);
        }

        if (record.resendCount >= 3) {
            return res.status(200).json({
                success: false,
                message:
                    "Maximum resend attempts reached"
            });
        }

        const newOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        record.emailotp = newOtp;

        record.expiresAt = new Date(
            now + 5 * 60 * 1000
        );

        record.resendCount += 1;

        await record.save();

        if (type === "email") {

            await sendOTPEmail(
                record.email,
                newOtp
            );

        } else {

            return res.status(400).json({
                success: false,
                message: "Invalid type"
            });

        }

        return res.status(200).json({
            success: true,
            message: "OTP resent successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// 5. Forgot Password Flow

export const ForgotPassword = async (req, res) => {
    try {

        const { email } = req.body;
        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

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

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        await Otp.deleteMany({ email });

        await Otp.create({
            email: user.email,
            deviceId,
            emailotp: otp,
            mobileotp: otp,
            userId: user._id,
            expiresAt: new Date(
                Date.now() + 5 * 60 * 1000
            ),
            verified: false
        });

        const textMsg =
            `Your OTP to reset password is: ${otp}. It is valid for 5 minutes.`;

        await sendOTPEmail(
            email,
            otp,
            "Password Reset OTP",
            textMsg
        );

        return res.status(200).json({
            success: true,
            message:
                "Password reset OTP sent successfully"
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
        const deviceId =
            req.headers["X-Device-Id"] ||
            "DEVICEID124";

        if (!otp) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "OTP is required"
            });
        }

        const record = await Otp.findOne({
            deviceId
        });

        if (!record) {
            return res.status(200).json({
                success: false,
                errorCode: "OTP_003",
                message:
                    "No password reset request found"
            });
        }

        if (
            Date.now() >
            new Date(record.expiresAt).getTime()
        ) {

            await Otp.deleteOne({
                _id: record._id
            });

            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "OTP has expired"
            });
        }

        if (
            record.emailotp !== String(otp)
        ) {
            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "Invalid OTP"
            });
        }

        record.verified = true;

        await record.save();

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

        const {
            email,
            newPassword
        } = req.body;
        const deviceId = req.headers["X-Device-Id"] || "DEVICEID124";

        if (
            !email ||
            !newPassword
        ) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message:
                    "Email and new password are required"
            });
        }

        const record =
            await Otp.findOne({
                deviceId,
            });


        if (
            !record
        ) {
            return res.status(200).json({
                success: false,
                errorCode: "AUTH_005",
                message:
                    "Unauthorized. Please verify OTP first."
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                newPassword,
                10
            );

        await User.findOneAndUpdate(
            { email },
            {
                password:
                    hashedPassword
            }
        );

        await Otp.deleteOne({
            _id: record._id
        });

        return res.status(200).json({
            success: true,
            message:
                "Password reset successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });

    }
};

