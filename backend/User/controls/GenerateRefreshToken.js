import jwt from "jsonwebtoken";
import DeviceSession from "../models/deviceSchema.js";

export const refreshTokenController  = async (req, res) => {
    try {

        const deviceId = req.headers["x-device-id"] || "DEVICEID123";
        const deviceType = req.headers["x-platform"];
        const appVersion = req.headers["x-app-version"];

        // check device
        const device = await DeviceSession.findOne({ "device.deviceId": deviceId });

        if (device) {

            // remove all userIds from this device
     

            // generate token
            const token = jwt.sign(
                { deviceId },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: "30d" }
            );

            return res.json({
                success: true,
                message: "Existing device found, users removed",
                token
            });
        }

        return res.status(404).json({
            success: false,
            message: "Device not found"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};