import jwt from "jsonwebtoken";
import DeviceSession from "../models/deviceSchema.js";

export const refreshTokenController = async (req, res) => {

    try {

        const deviceId =
            req.headers["x-device-id"] || "DEVICEID124";

        const userId =
            req.headers["x-user-id"] || "6a01a1789be3d353d893d05c";

        if (!deviceId || !userId) {

            return res.status(400).json({
                success: false,
                errorCode: "VALID_001",
                message:
                    "Device ID and User ID are required"
            });
        }

        // Find Device
        const device = await DeviceSession.findOne({

            "device.deviceId": deviceId,

            userIds: userId
        });

        if (!device) {

            return res.status(404).json({
                success: false,
                errorCode: "DEVICE_001",
                message:
                    "User not found on this device"
            });
        }

        // Generate Token
        const token = jwt.sign(

            {
                id: userId,
                deviceId
            },

            process.env.JWT_ACCESS_SECRET,

            {
                expiresIn: "30d"
            }
        );

        return res.status(200).json({

            success: true,

            data: {
                token
            },

            message: "Token created successfully"
        });

    } catch (error) {

        return res.status(500).json({

            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};