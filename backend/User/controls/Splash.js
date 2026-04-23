import DeviceSession from "../models/deviceSchema.js";
import jwt from "jsonwebtoken";

export const splashCheck = async (req, res) => {
    try {

        let accessToken = req.headers["authorization"];
        if (accessToken && accessToken.startsWith('Bearer ')) {
            accessToken = accessToken.split(' ')[1];
        }
        const refreshToken = req.headers["x-refresh-token"];
        // const deviceId = req.cookies?.deviceId;
        // console.log(deviceId, "deiviceId");
        const deviceId = req.headers["x-device-id"] || "DEVICEID123" || "DEVICEID124";
        const deviceType = req.headers["x-platform"];
        const appVersion = req.headers["x-app-version"];

        /* 1️⃣ Access Token Check */
        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);

                return res.json({
                    success: true,
                    loggedIn: true,
                    userId: decoded.id
                });

            } catch (err) {
                // Access token expired → continue
            }
        }

        /* 2️⃣ Refresh Token Check */
        if (refreshToken) {
            try {

                const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

                const newAccessToken = jwt.sign(
                    { id: decoded.id },
                    process.env.JWT_ACCESS_SECRET,
                    { expiresIn: "15m" }
                );

                return res.json({
                    success: true,
                    loggedIn: true,
                    data: {
                        token: newAccessToken
                    }

                });

            } catch (err) {
                // Refresh token expired → continue
            }
        }

        /* 3️⃣ Device Session Check */
        if (deviceId) {

            const session = await DeviceSession.findOne({ "device.deviceId": deviceId });

            if (session) {

                return res.json({
                    success: true,
                    loggedIn: true,
                    userId: session.userIds
                });

            } else {
                return res.status(200).json({
                    success: false,
                    errorCode: "DEVICE_001",
                    message: "Device not registered"
                });
            }
        }

        /* 4️⃣ No Session Found */
        return res.json({
            success: true,
            loggedIn: false
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });

    }
};