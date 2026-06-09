import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import deviceSchema from "../models/deviceSchema.js";
import twilio from "twilio";
import nodemailer from "nodemailer";
import dns from "dns";
let twilioClient = null;
import { Resend } from "resend";

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

        // 📧 Email OTP
        const emailOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // 📱 Phone OTP
        const phoneOtp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const expiresAt = Date.now() + 5 * 60 * 1000;

        const DemoEmail = "autopulseindia13@gmail.com"
        // 💾 Store in session
        req.session.registrationData = {
            userDetails: {
                userName,
                fullName,
                email,
                countryCode,
                phone,
                password
            },
            emailOtp,
            phoneOtp,
            expiresAt
        };

        // 📧 send email OTP
        await sendOTPEmail(DemoEmail, emailOtp);

        // 📱 send phone OTP (SMS service required)
        // await sendPhoneOTP(phone, phoneOtp);

        return res.status(200).json({
            success: true,
            message: "OTP sent to email and phone"
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
        const { emailOtp, phoneOtp } = req.body;

        const sessionData = req.session.registrationData;

        if (!sessionData) {
            return res.status(200).json({
                success: false,
                message: "Registration session expired"
            });
        }

        if (!emailOtp && !phoneOtp) {
            return res.status(200).json({
                success: false,
                message: " OTPs are required"
            });
        }

        const { userDetails, expiresAt } = sessionData;

        // ⏳ expiry check
        if (Date.now() > expiresAt) {
            req.session.registrationData = null;

            return res.status(200).json({
                success: false,
                message: "OTP expired"
            });
        }

        // 📧 Email OTP check
        if (sessionData.emailOtp !== String(emailOtp)) {
            return res.status(200).json({
                success: false,
                message: "Invalid email OTP"
            });
        }

        // 📱 Phone OTP check
        // if (sessionData.phoneOtp !== String(phoneOtp)) {
        //     return res.status(200).json({
        //         success: false,
        //         message: "Invalid phone OTP"
        //     });
        // }

        const {
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password
        } = userDetails;

        // 🔍 Check existing user
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }, { userName }]
        });

        if (existingUser) {
            req.session.registrationData = null;

            return res.status(200).json({
                success: false,
                message: "User already exists"
            });
        }

        // 🔐 Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 👤 Create user
        const user = await User.create({
            userName,
            fullName,
            email,
            countryCode,
            phone,
            password: hashedPassword,
            isVerified: true
        });

        // 📱 Device tracking
        const deviceId = req.headers["x-device-id"] || "DEVICEID124";
        const deviceType = req.headers["x-platform"] || "android";
        const deviceName = req.headers["x-device-name"];
        const deviceCategory = req.headers["x-device-category"] || deviceType;
        const location = req.headers["x-location"];

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

        // 🧹 Clear session
        req.session.registrationData = null;

        // 🔑 Generate JWT
        const accessToken = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role || "user"
            },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "1d" }
        );

  
        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                accessToken
            },
            message: "Registration completed successfully"
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

        // const { email, password } = req.body;

        const email = "autopulseindia13@gmail.com"
        const password = "1234abcd"

        const user = await User.findOne({ email })
            .select("+password");

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

        // Store data in session
        req.session.loginData = {
            userId: user._id.toString(),
            email: user.email,
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000
        };

        await sendOTPEmail(email, otp);

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",

        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// 2. Verify OTP API
export const VerifyLoginOtp = async (req, res) => {

    try {
        const { otp } = req.body;

        const data = req.session.loginData;

        // return res.status(200).json({
        //     success: true,
        //     data : data,
        //     message: "OTP verification endpoint hit"
        // });

        // if (!data) {
        //     return res.status(200).json({
        //         success: false,
        //         message: "Session expired"
        //     });
        // }

        if (data.expiresAt < Date.now()) {
            return res.status(200).json({
                success: false,
                message: "OTP expired"
            });
        }

        if (data.otp !== otp) {
            return res.status(200).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // 🎯 Generate JWT after OTP success
        const token = jwt.sign(
            {
                id: data.userId,
                email: data.email
            },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "7d" }
        );

      

        // clear session (important)
        req.session.loginData = null;

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token
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

        const { type } = req.body;

        const record = req.session.loginData;

        if (!record) {
            return res.status(200).json({
                success: false,
                message: "Session expired"
            });
        }

        const now = Date.now();

        if (
            now - record.firstResendAt >
            10 * 60 * 1000
        ) {
            record.resendCount = 0;
            record.firstResendAt = now;
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

        record.otp = newOtp;
        record.expiresAt =
            now + 5 * 60 * 1000;

        record.resendCount += 1;

        if (type === "email") {

            await sendOTPEmail(
                record.email,
                newOtp
            );

        } else if (type === "phone") {

            await sendOTPSms(
                record.phone,
                record.countryCode,
                newOtp,
                `Your OTP is ${newOtp}`
            );

        } else {

            return res.status(400).json({
                success: false,
                message: "Invalid type"
            });

        }

        await req.session.save();

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

        if (!email)
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Email is required",
            });

        const user = await User.findOne({ email });
        if (!user)
            return res.status(200).json({
                success: false,
                errorCode: "USER_003",
                message: "User not found",
            });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        // 🧠 store in session instead of Map
        req.session.forgotPassword = {
            email,
            otp,
            expiresAt,
            verified: false,
        };

        const textMsg = `Your OTP to reset password is: ${otp}. It is valid for 5 minutes.`;

        await sendOTPEmail(email, otp, "Password Reset OTP", textMsg);

        return res.status(200).json({
            success: true,
            message: "Password reset OTP sent successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message,
        });
    }
};

export const VerifyForgotOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        const record = req.session.forgotPassword;

        if ( !otp)
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Email and OTP are required",
            });

        if (!record )
            return res.status(200).json({
                success: false,
                errorCode: "OTP_003",
                message: "No password reset request found",
            });

        if (Date.now() > record.expiresAt) {
            req.session.forgotPassword = null;
            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "OTP has expired",
            });
        }

        if (record.otp !== String(otp))
            return res.status(200).json({
                success: false,
                errorCode: "OTP_001",
                message: "Invalid OTP",
            });

        // mark verified
        req.session.forgotPassword.verified = true;

        return res.status(200).json({
            success: true,
            message:
                "OTP verified successfully. You can now reset your password.",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message,
        });
    }
};

export const ResetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        const record = req.session.forgotPassword;

        if (!email || !newPassword)
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Email and new password are required",
            });

        if (!record || !record.verified || record.email !== email)
            return res.status(200).json({
                success: false,
                errorCode: "AUTH_005",
                message: "Unauthorized. Please verify OTP first.",
            });

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        // clear session
        req.session.forgotPassword = null;

        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message,
        });
    }
};
export const Logout = async (req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
};
