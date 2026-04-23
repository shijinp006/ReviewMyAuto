import jwt from "jsonwebtoken"

const verifyToken = (req, res, next) => {
    // Get token from headers (supporting both plain token and Bearer token)
    let token = req.headers['authorization'] || req.headers['x-access-token'];

    if (token && token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access denied. No token provided"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = decoded; // Contains user ID
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

export default verifyToken