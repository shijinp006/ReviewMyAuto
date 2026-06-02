import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";
import twilio from "twilio";
import nodemailer from "nodemailer";
import dns from "dns";
let twilioClient = null;

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

export const sendOTPEmail = async (
    email,
    otp
) => {
    const transporter =
        nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Registration OTP",
        html: `
            <h2>OTP Verification</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>Valid for 5 minutes.</p>
        `
    });
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

        if (
            !userName ||
            !fullName ||
            !email ||
            !countryCode ||
            !phone ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({
            $or: [
                { email },
                { phone },
                { userName }
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const expiresAt =
            Date.now() + 5 * 60 * 1000;

        registrationStore.set(email, {
            userDetails: {
                userName,
                fullName,
                email,
                countryCode,
                phone,
                password
            },
            otp,
            expiresAt
        });

        req.session.registrationEmail = email;

        await sendOTPEmail(email, otp);

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


export const VerifyRegistrationOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        const email = req.session.registrationEmail;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Registration session expired"
            });
        }

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required"
            });
        }

        const record = registrationStore.get(email);

        if (!record) {
            return res.status(400).json({
                success: false,
                message: "OTP session not found"
            });
        }

        if (Date.now() > record.expiresAt) {
            registrationStore.delete(email);

            return res.status(400).json({
                success: false,
                message: "OTP expired"
            });
        }

        if (record.otp !== String(otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        const {
            userName,
            fullName,
            countryCode,
            phone,
            password
        } = record.userDetails;

        const existingUser = await User.findOne({
            $or: [
                { email },
                { phone },
                { userName }
            ]
        });

        if (existingUser) {
            registrationStore.delete(email);

            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const user = await User.create({
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password: hashedPassword,
            isVerified: true
        });

        const deviceId =
            req.headers["x-device-id"] || "DEVICEID124";

        const deviceType =
            req.headers["x-platform"] || "android";

        const deviceName =
            req.headers["x-device-name"];

        const deviceCategory =
            req.headers["x-device-category"] ||
            deviceType;

        const location =
            req.headers["x-location"];

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

        delete req.session.registrationEmail;

        const accessToken =
            generateAccessToken(user._id);

        const refreshToken =
            generateRefreshToken(user._id);

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                accessToken,
                refreshToken
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

        const user = await User.findOne({ email })
            .select("+password");

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const emailOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const mobileOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        loginOtpStore.set(email, {
            userId: user._id,
            emailOtp,
            mobileOtp,
            expiresAt: Date.now() + 5 * 60 * 1000
        });

        req.session.loginEmail = email;

        await sendOTPEmail(email, emailOtp);

        await sendOTPSms(
            user.phone,
            user.countryCode,
            mobileOtp
        );

        return res.status(200).json({
            success: true,
            message:
                "OTP sent to email and mobile"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// 2. Verify OTP API
export const VerifyLoginOTP = async (req, res) => {
    try {

        const {
            emailOtp,
            mobileOtp
        } = req.body;

        const email =
            req.session.loginEmail;

        if (!email) {
            return res.status(400).json({
                success: false,
                message:
                    "Session expired. Please login again."
            });
        }

        const record =
            loginOtpStore.get(email);

        if (!record) {
            return res.status(400).json({
                success: false,
                message:
                    "OTP session not found"
            });
        }

        if (
            Date.now() >
            record.expiresAt
        ) {

            loginOtpStore.delete(email);

            return res.status(400).json({
                success: false,
                message:
                    "OTP expired"
            });
        }

        if (
            record.emailOtp !==
            String(emailOtp)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid Email OTP"
            });
        }

        if (
            record.mobileOtp !==
            String(mobileOtp)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid Mobile OTP"
            });
        }

        const user =
            await User.findById(
                record.userId
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "User not found"
            });
        }

        const accessToken =
            generateAccessToken(
                user._id
            );

        const refreshToken =
            generateRefreshToken(
                user._id
            );

        loginOtpStore.delete(email);

        delete req.session.loginEmail;

        return res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken
            },
            message:
                "Login successful"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// 3. Resend OTP API
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

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        record.otp = newOtp;
        record.expiresAt = now + 5 * 60 * 1000;
        record.resendCount += 1;

        const textMsg = `Your new OTP for registration is: ${newOtp}. It is valid for 5 minutes.`;

        try {
            await sendOTPEmail(email, newOtp, 'Your Resend Registration OTP', textMsg);
            // await sendOTPSms(record.userDetails.phone, record.userDetails.countryCode, newOtp, textMsg);
        } catch (err) {
            console.error("Failed to resend OTP:", err.message);
            return res.status(200).json({ success: false, errorCode: "EMAIL_001", message: `Failed to resend OTP: ${err.message}` });
        }

        return res.status(200).json({ success: true, message: "OTP resent successfully" });

    } catch (error) {
        return res.status(500).json({ success: false, errorCode: "SERVER_001", message: error.message });
    }
};



// 5. Forgot Password Flow

export const ForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(200).json({ success: false, errorCode: "VALID_001", message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(200).json({ success: false, errorCode: "USER_003", message: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        forgotPasswordStore.set(email, { otp, expiresAt, verified: false });

        const textMsg = `Your OTP to reset password is: ${otp}. It is valid for 5 minutes.`;

        await sendOTPEmail(email, otp, 'Password Reset OTP', textMsg);
        // await sendOTPSms(user.phone, user.countryCode, otp, textMsg);

        return res.status(200).json({ success: true, message: "Password reset OTP sent successfully" });
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
