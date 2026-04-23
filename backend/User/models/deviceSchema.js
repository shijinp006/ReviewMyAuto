import mongoose from "mongoose";

const splashConfigSchema = new mongoose.Schema({

  maintenanceMode: {
    type: Boolean,
    default: false
  },

  minAppVersion: {
    type: String,
    default: "1.0.0",
    required: true
  },

  latestAppVersion: {
    type: String,
    default: "1.0.0"
  },

  maintenanceMessage: {
    type: String,
    default: "Server under maintenance. Please try later."
  },

  device: {
    deviceId: {
      type: String,
      required: [true, "Device ID is required"],
      index: true
    },

    deviceName: {
      type: String,
      trim: true
    },

    deviceCategory: {
      type: String,
      trim: true
    },

    location: {
      type: String,
      trim: true
    },

    lastLogin: {
      type: Date,
      default: Date.now
    },

    deviceType: {
      type: String,
      enum: ["android", "ios", "web"],
      lowercase: true
    }
  },

  userIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]

}, { timestamps: true });

export default mongoose.model("SplashConfig", splashConfigSchema);