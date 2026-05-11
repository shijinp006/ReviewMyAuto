import Review from "../models/reviewSchema.js";
import Vehicle from "../models/vehicleSchema.js";

/**
 * @desc    Add a new review for a vehicle
 * @route   POST /api/user/reviews/add
 * @access  Private
 */
export const AddReview = async (req, res) => {
    try {
        const { rating, comment, images } = req.body;

        // Extracting IDs from headers as requested
        const userId = req.headers["x-user-id"] || "6a01a1789be3d353d893d05"; // Default for testing
        const vehicleId = req.headers["x-vehicle-id"] || "6a01ac05824d84ce29fbb089"; // Default for testing

        if (!userId) {
            return res.status(200).json({
                success: false,
                errorCode: "AUTH_001",
                message: "User ID is required in headers (x-user-id)"
            });
        }

        if (!vehicleId) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Vehicle ID is required in headers (x-vehicle-id)"
            });
        }

        // 1. Basic field validation
        if (rating === undefined || !comment) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "Rating and comment are required"
            });
        }

        // 2. Validate rating range
        if (rating < 1 || rating > 5) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_002",
                message: "Rating must be between 1 and 5"
            });
        }

        // 3. Check if the vehicle exists
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
            return res.status(200).json({
                success: false,
                errorCode: "VEHICLE_001",
                message: "Vehicle not found"
            });
        }

        // 4. Create the review
        // Note: The unique index on { userId, vehicleId } in the schema 
        // will automatically prevent duplicate reviews.
        const review = await Review.create({
            userId,
            vehicleId,
            rating,
            comment,
            images: images || [],
            status: "pending" // Default status is pending for moderation
        });

        // 5. Return success
        return res.status(201).json({
            success: true,
            data: review,
            message: "Review submitted successfully and is pending approval"
        });

    } catch (error) {
        // Handle Mongoose unique constraint error (User already reviewed this vehicle)
        if (error.code === 11000) {
            return res.status(200).json({
                success: false,
                errorCode: "REVIEW_001",
                message: "You have already submitted a review for this vehicle"
            });
        }

        // Handle other potential errors (like invalid ObjectId format)
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message || "An internal server error occurred"
        });
    }
};

/**
 * @desc    Get all reviews for a specific vehicle
 * @route   GET /api/user/reviews/:vehicleId
 * @access  Public
 */
export const GetVehicleReviews = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const reviews = await Review.find({ vehicleId, status: "approved" })
            .populate("userId", "userName profIcon rank")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};
