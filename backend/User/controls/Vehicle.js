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
            brandLogo
        } = req.body;

        // Extracting userId from headers (following the pattern used in Review.js)
        const userId = req.headers["x-user-id"] || "6a01a1789be3d353d893d05c"; // Default fallback for testing if needed

        // 1. Validation
        if (!type || !brand || !model || !year || !fuel || !regNo) {
            return res.status(200).json({
                success: false,
                errorCode: "VALID_001",
                message: "All required fields (type, brand, model, year, fuel, regNo) must be provided"
            });
        }

        // 2. Check if vehicle already exists (Registration number should be unique)
        const existingVehicle = await Vehicle.findOne({ regNo: regNo.toUpperCase() });
        if (existingVehicle) {
            return res.status(200).json({
                success: false,
                errorCode: "VEHICLE_002",
                message: "A vehicle with this registration number is already registered"
            });
        }

        // 3. Dynamic Brand Logo logic (Using a reliable logo API as a "Google-like" source)
        // If no logo is provided, we generate one using the brand name
        const finalBrandLogo = brandLogo || `https://logo.clearbit.com/${brand.toLowerCase().replace(/\s+/g, '')}.com`;

        // 4. Create the vehicle
        const vehicle = await Vehicle.create({
            type,
            brand,
            model,
            year,
            fuel,
            isHybrid: isHybrid || false,
            variant,
            regNo: regNo.toUpperCase(),
            brandLogo: finalBrandLogo,
            userId
        });

        return res.status(201).json({
            success: true,
            data: vehicle,
            message: "Vehicle added successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            errorCode: "SERVER_001",
            message: error.message
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
        const userId = req.headers["x-user-id"] || "69e9a226c6e1a7f9c1be8f28";

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
