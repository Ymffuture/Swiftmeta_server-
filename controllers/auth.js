import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import auth from "../middleware/auth.js"; // middleware to read JWT

// Convert dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary production config (replace with env vars)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for local temp before Cloudinary
const upload = multer({ dest: path.join(__dirname, "..", "uploads/temp") });

// Generate 6 digit OTP
const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Hash OTP before storage
const hashOtp = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const register = [
  upload.single("avatar"),
  async (req, res) => {
    try {
      const { phone, email, password, name } = req.body;

      if (!phone || !email || !password)
        return res.status(400).json({ message: "All fields required" });

      const exists = await User.findOne({ $or: [{ phone }, { email }] });
      if (exists)
        return res.status(400).json({ message: "User already exists" });

      let avatarUrl = "";

      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "avatars",
        });
        avatarUrl = result.secure_url;
        fs.unlinkSync(req.file.path); // clean local temp file
      }

      const hashedPass = await bcrypt.hash(password, 10);
      const otp = makeOtp();
      const user = new User({
        phone,
        email,
        name: name || phone,
        password: hashedPass,
        tempOtp: hashOtp(otp),
        tempOtpExpires: Date.now() + 15 * 60 * 1000, // 15 mins expiry
        avatar: avatarUrl,
        verified: false,
      });

      await user.save();

      // Send verification email
      await transporter.sendMail({
        to: email,
        subject: "Verify your email",
        text: `Welcome ${user.name}. Your verification code is: ${otp}`,
      });

      res.status(201).json({ message: "Registered, verification sent" });
    } catch (e) {
      console.error("Register error:", e);
      res.status(500).json({ message: "Failed registration" });
    }
  },
];

export const login = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (!user.verified)
      return res.status(403).json({ message: "Verify your email first" });

    const otp = makeOtp();
    user.tempOtp = hashOtp(otp);
    user.tempOtpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    // Await mail to detect Gmail failure
    await transporter.sendMail({
      to: user.email,
      subject: "Login OTP",
      text: `Your login code is: ${otp}`,
    });

    res.json({ message: "OTP sent to email" });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: "Login failed" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (!user.tempOtp || user.tempOtp !== hashOtp(otp))
      return res.status(400).json({ message: "Invalid OTP" });

    if (Date.now() > user.tempOtpExpires)
      return res.status(400).json({ message: "OTP expired" });

    const token = jwt.sign(
      { sub: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    user.tempOtp = undefined;
    await user.save();

    res.json({ token, user: { name: user.name, avatar: user.avatar } });
  } catch (e) {
    console.error("Verify OTP error:", e);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

// Update profile avatar or name
export const updateProfile = [
  auth,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const { name } = req.body;
      const user = await User.findById(req.userId);

      if (!user)
        return res.status(404).json({ message: "No user" });

      if (name) user.name = name;

      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "avatars",
        });
        user.avatar = result.secure_url;
        fs.unlinkSync(req.file.path);
      }

      await user.save();
      res.json({ user: { _id: user._id, name: user.name, avatar: user.avatar } });
    } catch (e) {
      console.error("Profile update error:", e);
      res.status(500).json({ message: "Profile update failed" });
    }
  },
];

export default router;
