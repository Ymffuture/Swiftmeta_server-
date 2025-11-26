import dotenv from "dotenv";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import uploadRoutes from "./routes/uploads.js";
import geminiRouter from "./routes/gemini.js";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*", 
             methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,  }));

app.use(express.json());

// serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/gemini", geminiRouter);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log("Server started on port", PORT));
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });
