const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        return res
            .status(401)
            .json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(
            token.replace("Bearer ", ""),
            process.env.JWT_SECRET
        );

        // Fetch user from DB to ensure latest role is used
        const user = await User.findById(decoded.id).select("-password"); // Exclude password
        if (!user) {
            return res
                .status(401)
                .json({ error: "Unauthorized: User not found" });
        }

        req.user = user; // Attach full user object (including role)
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expired." });
        }
        res.status(403).json({ error: "Invalid token." });
    }
};

module.exports = authMiddleware;
