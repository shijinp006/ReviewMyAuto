import jwt from "jsonwebtoken";

export const refreshTokenController = async (req, res) => {
    try {

        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token missing"
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(403).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        const userId = decoded.id;

        const newAccessToken = jwt.sign(
            { id: userId },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { id: userId },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "30d" }
        );

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            refreshToken: newRefreshToken
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};