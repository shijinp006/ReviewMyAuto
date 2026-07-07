import Vehicle from "../models/vehicleSchema.js";

/**
 * @desc    Add a new vehicle
 * @route   POST /api/vehicles/add
 * @access  Private
 */
export const AddVehicle = async (req, res) => {
    try {
        const {
            type,
            brand,
            model,
            year,
            fuel,
            isHybrid,
            variant,
            regNo,
        } = req.body;

        const userId =
            req.headers["X-User-Id"] ||
            "6a1ef8a4e13b65f39d3067d3";

        // Validate required fields
        if (!type || !brand || !model || !year || !fuel || !regNo) {
            return res.status(400).json({
                success: false,
                errorCode: "VALID_001",
                message:
                    "Type, Brand, Model, Year, Fuel and Registration Number are required.",
            });
        }

        // Vehicle Images are required
        if (
            !req.files ||
            !req.files.vehicleImages ||
            req.files.vehicleImages.length === 0
        ) {
            return res.status(400).json({
                success: false,
                errorCode: "VALID_002",
                message: "Please upload at least one vehicle image.",
            });
        }

        // Check duplicate registration number
        const existingVehicle = await Vehicle.findOne({
            regNo: regNo.toUpperCase(),
        });

        if (existingVehicle) {
            return res.status(400).json({
                success: false,
                errorCode: "VEHICLE_001",
                message: "Vehicle already exists.",
            });
        }

        // Brand Logo (Optional)
        let brandLogo = "";

        if (
            req.files.brandLogo &&
            req.files.brandLogo.length > 0
        ) {
            brandLogo = `/public/uploads/${req.files.brandLogo[0].filename}`;
        }

        // Vehicle Images (Required)
        const vehicleImages = req.files.vehicleImages.map((file) => {
            return `/public/uploads/${file.filename}`;
        });

        // Create Vehicle
        const vehicle = await Vehicle.create({
            type,
            brand,
            model,
            year,
            fuel,
            isHybrid:
                isHybrid === true || isHybrid === "true",
            variant,
            regNo: regNo.toUpperCase(),
            brandLogo,
            vehicleImages,
            userId,
        });

        return res.status(201).json({
            success: true,
            message: "Vehicle added successfully.",
            data: vehicle,
        });
    } catch (error) {
        console.error("Add Vehicle Error:", error);

        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message,
        });
    }
};

/**
 * @desc    Get all vehicles for the logged-in user
 * @route   GET /api/vehicles/my-vehicles
 * @access  Private
 */
export const GetMyVehicles = async (req, res) => {
    try {
        const userId = req.headers["X-User-Id"] || "6a1ef8a4e13b65f39d3067d3";

        const vehicles = await Vehicle.find({ userId }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: vehicles.length,
            data: vehicles
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
        });
    }
};
