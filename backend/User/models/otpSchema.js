const otpSchema = new mongoose.Schema({

    email: String,

    otp: String,

    expiresAt: Date,

    resendCount: {
        type: Number,
        default: 0
    }

}, { timestamps: true });
export default mongoose.model(
    "OTP",
    otpSchema
);