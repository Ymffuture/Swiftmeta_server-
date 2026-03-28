// controllers/post.js
// ✅ FIX: `PROCESS.ENV.*` (uppercase) is not defined in Node.js — only
// `process.env.*` (lowercase) is. The uppercase references caused Cloudinary
// to initialise with undefined credentials, silently failing every image upload.

import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import Post from "../models/Post.js";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import multer from "multer";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dest = path.join(__dirname, "..", "uploads");

const router = express.Router();

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

// ✅ Lowercase process.env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.diskStorage({
  destination: dest,
  filename: (_, file, cb) => {
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage });

export function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = d.sub;
    req.userPhone = d.phone;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export const createPost = [
  auth,
  upload.single("image"),
  async (req, res) => {
    try {
      const { content } = req.body;
      let imageUrl = "";

      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.secure_url;
        fs.unlinkSync(req.file.path);
      }

      const post = new Post({
        user: req.userId,
        content,
        image: imageUrl,
        likes: [],
        comments: [],
      });
      await post.save();

      const saved = await Post.findById(post._id)
        .populate("user", "name avatar")
        .populate("comments.user", "name avatar");

      res.status(201).json({
        _id: saved._id,
        content: saved.content,
        image: saved.image,
        likes: saved.likes,
        comments: saved.comments,
        author: {
          _id: saved.user._id,
          name: saved.user.name,
          avatar: saved.user.avatar,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Post failed" });
    }
  },
];

export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name avatar")
      .populate("comments.user", "name avatar");

    const mapped = posts.map((p) => ({
      _id: p._id,
      content: p.content,
      image: p.image,
      likes: p.likes,
      comments: p.comments,
      author: {
        name: p.user?.name,
        avatar: p.user?.avatar,
        _id: p.user?._id,
      },
    }));

    res.json(mapped);
  } catch {
    res.status(500).json({ message: "Load posts error" });
  }
};

export default router;
