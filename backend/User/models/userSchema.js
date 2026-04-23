import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            trim: true,
            minlength: [3, "Username must be at least 3 characters"],
            maxlength: [30, "Username must not exceed 30 characters"],
            match: [
                /^[a-zA-Z0-9._-]+$/,
                "Username can only contain letters, numbers, underscores, dots, and hyphens"
            ]
        },

        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true
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

        phone: {
            type: String,
            required: [true, "Phone number is required"],
            unique: true,
            trim: true,
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            select: false
        },

        dateOfBirth: {
            type: Date
        },

        totalVotes: {
            type: Number,
            default: 0
        },

        rank: {
            type: String,
            enum: ["beginner", "intermediate", "pro", "expert"],
            default: "beginner"
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        profIcon: {
            type: String,
            default: ""
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