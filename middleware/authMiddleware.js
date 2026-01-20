import jwt from "jsonwebtoken";
import User from "../models/User.js"; // your User model

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user; // attach user to request
    next();
  } catch (err) {
    console.error("Auth Error:", err);
    res.status(401).json({ error: "Unauthorized" });
  }
};
