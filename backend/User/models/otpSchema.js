import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            index: true
        },

        deviceId: {
            type: String,
            required: true,
            index: true
        },

        emailotp: {
            type: String,
            required: true
        },

        mobileotp: {
            type: String,
            required: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        userDetails: {
            userName: {
                type: String
            },

            fullName: {
                type: String
            },

            email: {
                type: String
            },

            countryCode: {
                type: String
            },

            phone: {
                type: String
            },

            password: {
                type: String
            }
        },

        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Auto delete expired OTPs
otpSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

export const Otp = mongoose.model(
    "Otp",
    otpSchema
);