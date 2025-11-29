import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ES Modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup for memory
const upload = multer({ storage: multer.memoryStorage() });

// Helpers
const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hash = (txt) => crypto.createHash("sha256").update(txt).digest("hex");

// Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "famacloud.ai@gmail.com",
    pass: process.env.EMAIL_PASS,
  },
});

// ---------------- REGISTER ----------------
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name, password } = req.body;
    if (!phone || !email)
      return res.status(400).json({ message: "Phone and email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists) return res.status(400).json({ message: "User already exists" });

    let avatarUrl = "";
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "users" }
      );
      avatarUrl = uploadResult.secure_url;
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
    const emailCode = makeOtp();
    const emailExpires = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      phone,
      email,
      name: name || phone,
      password: hashedPassword,
      avatar: avatarUrl,
      emailOtp: { code: hash(emailCode), expiresAt: emailExpires },
      emailVerified: false,
    });

    await user.save();

    // Send OTP
    await transporter.sendMail({
      from: `"No Reply" <famacloud.ai@gmail.com>`,
      to: email,
      subject: "Verify your email",
      text: `Your verification code is: ${emailCode} (expires in 15 mins)`,
    });

    res.status(201).json({ message: "Registered, check email for OTP" });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- VERIFY EMAIL ----------------
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailOtp || user.emailOtp.code !== hash(code))
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.emailOtp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.emailVerified = true;
    user.emailOtp = null;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (e) {
    console.error("VERIFY EMAIL ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- LOGIN PHONE (Send OTP) ----------------
router.post("/login-phone-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.emailVerified) return res.status(403).json({ message: "Verify email first" });

    const otp = makeOtp();
    user.tempOtp = hash(otp);
    user.tempOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: `"No Reply" <quorvexinstitute@gmail.com>`,
      to: user.email,
      subject: "Login OTP",
      text: `Your login OTP is: ${otp} (expires in 10 mins)`,
    });

    res.json({ message: "OTP sent to email" });
  } catch (e) {
    console.error("LOGIN PHONE OTP ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- VERIFY PHONE OTP ----------------
router.post("/login-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.tempOtp || user.tempOtp !== hash(code))
      return res.status(400).json({ message: "Invalid OTP" });

    if (Date.now() > user.tempOtpExpires)
      return res.status(400).json({ message: "OTP expired" });

    const token = jwt.sign({ sub: user._id, phone }, process.env.JWT_SECRET, { expiresIn: "30d" });
    user.tempOtp = null;
    user.tempOtpExpires = null;
    await user.save();

    res.json({ token, user: { name: user.name, avatar: user.avatar, phone: user.phone } });
  } catch (e) {
    console.error("VERIFY PHONE OTP ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- PROFILE UPDATE ----------------
router.put("/profile", auth, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name } = req.body;
    if (name) user.name = name;

    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "users" }
      );
      user.avatar = uploadResult.secure_url;
    }

    await user.save();
    res.json({ user: { name: user.name, avatar: user.avatar } });
  } catch (e) {
    console.error("PROFILE UPDATE ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
