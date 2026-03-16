import DeviceSession from "../models/deviceSchema.js";
import jwt from "jsonwebtoken";

export const splashCheck = async (req, res) => {
    try {

        const accessToken = req.cookies?.accessToken;
        const refreshToken = req.cookies?.refreshToken;
        const deviceId = req.cookies?.deviceId;

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

                res.cookie("accessToken", newAccessToken, {
                    httpOnly: true,
                    sameSite: "strict"
                });

                return res.json({
                    success: true,
                    loggedIn: true,
                  
                });

            } catch (err) {
                // Refresh token expired → continue
            }
        }

        /* 3️⃣ Device Session Check */
        if (deviceId) {

            const session = await DeviceSession.findOne({ deviceId });

            if (session) {

                const newAccessToken = jwt.sign(
                    { id: session. userIds },
                    process.env.JWT_ACCESS_SECRET,
                    { expiresIn: "15m" }
                );

                const newRefreshToken = jwt.sign(
                    { id: session. userIds },
                    process.env.JWT_REFRESH_SECRET,
                    { expiresIn: "30d" }
                );

                res.cookie("accessToken", newAccessToken, {
                    httpOnly: true,
                    sameSite: "strict"
                });

                res.cookie("refreshToken", newRefreshToken, {
                    httpOnly: true,
                    sameSite: "strict"
                });

                return res.json({
                    success: true,
                    loggedIn: true,
                    userId: session.userIds
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
            message: "Splash check failed"
        });

    }
};