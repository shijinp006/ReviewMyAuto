import jwt from "jsonwebtoken";

export const refreshTokenController = async (req, res) => {
    try {

        const refreshToken = req.cookies.refreshToken;

        // if (!refreshToken) {
        //     return res.status(401).json({
        //         success: false,
        //         message: "Refresh token missing"
        //     });
        // }

        jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET,
            (err, decoded) => {

                if (err) {
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
                    sameSite: "strict"
                });

                res.cookie("refreshToken", newRefreshToken, {
                    httpOnly: true,
                    sameSite: "strict"
                });

                return res.json({
                    success: true,
                    message: "Token refreshed"
                });
            }
        );

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};