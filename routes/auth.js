import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { v2 as cloudinary } from "cloudinary";

import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ------------------- HELPERS -------------------
const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (txt) => crypto.createHash("sha256").update(txt).digest("hex");

// ------------------- MULTER -------------------
const upload = multer({ storage: multer.memoryStorage() });

// ------------------- CLOUDINARY -------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------- GOOGLE OAUTH2 -------------------
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.FRONTEND_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

async function createTransporter() {
  const accessToken = await oAuth2Client.getAccessToken();
  return google.gmail({ version: "v1", auth: oAuth2Client });
}

async function sendEmail(to, subject, message) {
  const gmail = await createTransporter();

  const raw = Buffer.from(
    `From: "No Reply" <${process.env.EMAIL_USER}>\r\nTo: ${to}\r\nSubject: ${subject}\r\n\r\n${message}`
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

// ------------------- REGISTER -------------------
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    let avatarUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "avatars", resource_type: "image" }
      );
      avatarUrl = result.secure_url;
    }

    const hashedPass = await crypto.createHash("sha256").update(password).digest("hex");
    const otp = makeOtp();

    const user = new User({
      phone,
      email,
      name: name?.trim() || phone,
      password: hashedPass,
      avatar: avatarUrl,
      verified: false,
      tempOtp: hashOtp(otp),
      tempOtpExpires: Date.now() + 15 * 60 * 1000, // 15 min
    });

    await user.save();

    await sendEmail(email, "Email Verification Code", `Hello ${user.name},\nYour verification code is: ${otp}\nExpires in 15 mins.`);

    res.status(201).json({ message: "Registered successfully, verification sent" });
  } catch (e) {
    console.error("❌ Register error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- VERIFY OTP -------------------
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.tempOtp || user.tempOtp !== hashOtp(otp))
      return res.status(400).json({ message: "Invalid OTP" });

    if (Date.now() > user.tempOtpExpires)
      return res.status(400).json({ message: "OTP expired" });

    user.tempOtp = null;
    user.tempOtpExpires = null;
    user.verified = true;
    await user.save();

    const token = jwt.sign({ id: user._id, phone: user.phone }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.json({ message: "Verified successfully", token, user: { name: user.name, phone: user.phone, avatar: user.avatar } });
  } catch (e) {
    console.error("❌ OTP verify error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- LOGIN -------------------
router.post("/login", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.verified) return res.status(403).json({ message: "Verify your email first" });

    const otp = makeOtp();
    user.tempOtp = hashOtp(otp);
    user.tempOtpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    await sendEmail(user.email, "Login OTP", `Your login code is: ${otp}. Expires in 10 mins.`);

    res.json({ message: "OTP sent to email" });
  } catch (e) {
    console.error("❌ Login error:", e);
    res.status(500).json({ message: "Login failed" });
  }
});

// ------------------- UPDATE PROFILE -------------------
router.put("/profile", auth, upload.single("avatar"), async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "No user found" });

    if (name) user.name = name;
    if (req.file) {
      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "avatars", resource_type: "image" }
      );
      user.avatar = result.secure_url;
    }

    await user.save();
    res.json({ user: { name: user.name, avatar: user.avatar } });
  } catch (e) {
    console.error("❌ Profile update error:", e);
    res.status(500).json({ message: "Profile update failed" });
  }
});

export default router;
