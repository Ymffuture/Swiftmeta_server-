import dotenv from "dotenv";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import winston from "winston";

import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import uploadRoutes from "./routes/uploads.js";
import geminiRouter from "./routes/gemini.js";

dotenv.config();

const app = express();

// ✅ Fix __dirname in ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Secure Winston Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/server.log" })
  ]
});

// ✅ CORS properly configured (Blocks wildcard if credentials are used)
const allowedOrigin = process.env.FRONTEND_URL || "https://swiftmeta.vercel.app" ;

app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

// ✅ Prevent abuse globally
app.use("/api/", rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

// ✅ Tighter rate limit for auth endpoints
app.use("/api/auth", rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }));

// ✅ Serve uploads safely using fixed directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ JWT Auth Guard Middleware
function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized - No token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
}

// ✅ Mount protected routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", requireAuth, postRoutes);
app.use("/api/uploads", requireAuth, uploadRoutes);
app.use("/api/gemini", requireAuth, geminiRouter);

// ✅ Global error handler (must be last)
app.use((err, req, res, next) => {
  logger.error("Unhandled Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// ✅ Stable MongoDB connection
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  autoIndex: false
})
  .then(() => {
    logger.info("✅ MongoDB Connected");
    app.listen(PORT, () => logger.info(`🚀 Server Running on Port ${PORT}`));
  })
  .catch(err => {
    logger.error("❌ MongoDB Connection Failed:", err);
  });
