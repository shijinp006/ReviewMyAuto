import mongoose from "mongoose";

const splashConfigSchema = new mongoose.Schema({
    maintenanceMode: {
        type: Boolean,
        default: false
    },

    minAppVersion: {
        type: String,
        default: "1.0.0"
    },

    latestAppVersion: {
        type: String,
        default: "1.0.0"
    },

    maintenanceMessage: {
        type: String,
        default: "Server under maintenance. Please try later."
    },
    deviceId: {
        type: String
    },

    userIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ]

}, { timestamps: true });

export default mongoose.model("SplashConfig", splashConfigSchema);