import mongoose from "mongoose";
import User from "../models/userSchema.js";
import Vehicle from "../models/vehicleSchema.js";
import DeviceSession from "../models/deviceSchema.js";
import Review from "../models/reviewSchema.js";

/**
 * @desc    Get aggregate stats for Dashboard (Users, Vehicles, Devices, Reviews)
 * @route   GET /api/admin/all-stats
 * @access  Private (Ideally Admin)
 */
export const getAllStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // 1. Fetch data filtered to logged-in user only
        const [
            user,
            vehicles,
            devices,
            reviewStats
        ] = await Promise.all([
            User.findById(userId),
            Vehicle.find({ userId }).sort({ createdAt: -1 }).populate("userId", "userName"),
            DeviceSession.find({ userIds: userId }).sort({ createdAt: -1 }),
            Review.aggregate([
                { $match: { userId: userObjectId } },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // 2. Format Review stats into a clean object
        const reviewCounts = {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0
        };

        reviewStats.forEach(stat => {
            if (stat._id) {
                reviewCounts[stat._id] = stat.count;
                reviewCounts.total += stat.count;
            }
        });

        // 3. Return combined data as a single flat object
        return res.status(200).json({
            success: true,
            user,
            vehicles,
            devices,
            reviewCounts,
            message: "All data fetched successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};
