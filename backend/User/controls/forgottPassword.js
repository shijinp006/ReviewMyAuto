import User from "../models/userSchema.js";
import crypto from "crypto";


export const forgotPassword = async (req, res) => {

    try {

        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({ message: "User not found" });
        }

        const token = crypto.randomBytes(32).toString("hex");

        user.resetToken = token;
        user.resetTokenExpire = Date.now() + 10 * 60 * 1000;

        await user.save();

    
        res.json({
            message: "Reset token generated"
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }

};

export const resetPassword = async (req, res) => {

    try {

        const token = req.cookies.resetToken;
        const { newPassword } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Token missing" });
        }

        const user = await User.findOne({
            resetToken: token,
            resetTokenExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(200).json({ message: "Token invalid or expired" });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        user.password = hash;
        user.resetToken = undefined;
        user.resetTokenExpire = undefined;

        await user.save();

        res.clearCookie("resetToken");

        res.json({
            message: "Password updated successfully"
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}