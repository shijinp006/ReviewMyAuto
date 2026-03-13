import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: [true, "Username is required"],
            trim: true,
            minlength: [3, "Username must be at least 3 characters"],
            maxlength: [30, "Username must not exceed 30 characters"],
            match: [
                /^[a-zA-Z0-9_-]+$/,
                "Username can only contain letters, numbers, underscores, and hyphens"
            ]
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                "Please provide a valid email address"
            ]
        },

        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"],
            unique: true,
            trim: true,
            match: [
                /^[6-9]\d{9}$/,
                "Phone number must be a valid 10-digit Indian number starting with 6-9"
            ]
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            select: false
        },


        resetPasswordToken: {
            type: String
        },

        resetPasswordExpire: {
            type: Date
        }

    },
    {
        timestamps: true
    }
);




const User = mongoose.model("User", userSchema);

export default User;