import dotenv from "dotenv";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";

import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import uploadRoutes from "./routes/uploads.js";
import geminiRouter from "./routes/gemini.js";
import quizRoutes from "./routes/quiz.routes.js";
import users from "./routes/Users.js";
import contactRoutes from "./routes/contact.routes.js";

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL ||  "http://localhost:5173/",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());

// Fix __dirname in ES Modules
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// serve uploaded images
app.use("/uploads", express.static(uploadDir));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/gemini", geminiRouter);
app.use("/api/users", users) ;
app.use("/api/quiz", quizRoutes);
app.use("/api/contact", contactRoutes);


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log("Server running on port", process.env.PORT || 5000)
    );
  })
  .catch((e) => console.error("Mongo error:", e));
