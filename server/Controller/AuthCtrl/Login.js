import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../../Model/UserSchema.js"; // make sure your model is exported as default
import twilio from "twilio";
dotenv.config();

// ------------------------ LOGIN ------------------------
// ✅ Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const Login = async (req, res) => {
  try {
    const { mobile } = req.body;

    // 1️⃣ Validate input
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid 10-digit mobile number starting with 6-9",
      });
    }

    // 2️⃣ Check if user exists in DB
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please signup first.",
      });
    }

    // 3️⃣ Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // 4️⃣ Create OTP JWT (valid 5 minutes)
    const otpToken = jwt.sign({ id: user._id, otp }, process.env.JWT_SECRET, {
      expiresIn: "5m",
    });

    // 5️⃣ Send OTP via Twilio SMS
    await client.messages.create({
      body: `Your OTP for login is ${otp}. It is valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER, // Twilio number
      to: `+91${mobile}`, // user mobile with country code
    });

    // 6️⃣ Send response with OTP token
    return res.status(200).json({
      success: true,
      message: "OTP sent successfully. Please check your mobile.",
      otpToken,
    });
  } catch (error) {
    console.error("Login Error:", error);

    // Twilio-specific errors
    if (error.code === 21608) {
      return res.status(400).json({
        success: false,
        message:
          "Trial Twilio accounts can only send SMS to verified numbers. Please verify this number in Twilio Console.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
// ------------------------ SIGNUP ------------------------
export const Sign = async (req, res) => {
  try {
    const { name, mobile, address } = req.body;
    console.log(name, mobile, address);

    // ✅ 1. Validate inputs
    if (!name || !mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid name and mobile number" });
    }

    // ✅ 2. Check if user already exists in DB
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists. Please login instead." });
    }

    // ✅ 3. Create new user in DB
    const newUser = await User.create({ name, mobile, address });

    // ✅ 4. Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, name: newUser.name, mobile: newUser.mobile },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // ✅ 5. Send response
    return res.status(201).json({
      success: true,
      message: "Signup successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        mobile: newUser.mobile,
        address: newUser.address,
      },
      token,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
