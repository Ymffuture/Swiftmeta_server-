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
import auth from "../middleware/auth.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------- CLOUDINARY -------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------- MULTER -------------------
const uploadLocal = multer({ dest: path.join(__dirname, "..", "uploads/temp") });
const uploadMem = multer({ storage: multer.memoryStorage() });

// ------------------- HELPERS -------------------
const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (code) => crypto.createHash("sha256").update(code).digest("hex");

// ------------------- GMAIL OAUTH2 SETUP -------------------
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.FRONTEND_URL;
const REFRESH_TOKEN = process.env.JWT_SECRET;
const GMAIL_USER = process.env.EMAIL_USER; // must match OAuth account

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function getAccessToken() {
  const { token } = await oauth2Client.getAccessToken();
  if (!token) throw new Error("Failed to refresh Gmail access token");
  return token;
}

async function mailTransport() {
  const accessToken = await getAccessToken();
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: GMAIL_USER,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
      accessToken,
    },
  });
}

// ------------------- REGISTER -------------------

export const register = [
  uploadLocal.single("avatar"),
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
        fs.unlinkSync(req.file.path);
      }

      const hashedPass = await bcrypt.hash(password, 10);
      const otp = makeOtp();

      const user = new User({
        phone,
        email,
        name: name || phone,
        password: hashedPass,
        tempOtp: hashOtp(otp),
        tempOtpExpires: Date.now() + 15 * 60 * 1000,
        avatar: avatarUrl,
        verified: false,
      });

      await user.save();

      const transporter = await mailTransport();
      const mail = await transporter.sendMail({
        from: `"No Reply" <${GMAIL_USER}>`,
        to: email,
        subject: "Email Verification Code",
        text: `Your verification code is: ${otp}\nIt expires in 15 minutes.`,
      });

      console.log("✅ Gmail API OTP sent:", mail.messageId);
      res.status(201).json({ message: "Registered, OTP sent to email" });
    } catch (e) {
      console.error("❌ Register error:", e);
      res.status(500).json({ message: "Failed registration" });
    }
  },
];

// ------------------- LOGIN -------------------

export const login = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.verified)
      return res.status(403).json({ message: "Verify your email first" });

    const otp = makeOtp();
    user.tempOtp = hashOtp(otp);
    user.tempOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const transporter = await mailTransport();
    const mail = await transporter.sendMail({
      from: `"No Reply" <${GMAIL_USER}>`,
      to: user.email,
      subject: "Login verification code",
      text: `Your login OTP is: ${otp}\nIt expires in 10 minutes.`,
    });

    console.log("✅ Gmail API login OTP sent:", mail.messageId);
    res.json({ message: "OTP sent to email" });
  } catch (e) {
    console.error("❌ Login error:", e);
    res.status(500).json({ message: "Login failed" });
  }
};

// ------------------- VERIFY LOGIN OTP -------------------

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.tempOtp || user.tempOtp !== hashOtp(otp))
      return res.status(401).json({ message: "Invalid OTP" });

    if (Date.now() > user.tempOtpExpires)
      return res.status(401).json({ message: "OTP expired" });

    user.tempOtp = null;
    user.tempOtpExpires = null;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      message: "Login success",
      token,
      user: { name: user.name, phone: user.phone, avatar: user.avatar },
    });
  } catch (e) {
    console.error("❌ OTP verify error:", e);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

// ------------------- PROFILE UPDATE -------------------

export const updateProfile = [
  auth,
  uploadLocal.single("avatar"),
  async (req, res) => {
    try {
      const { name } = req.body;
      const user = await User.findById(req.userId);

      if (!user) return res.status(404).json({ message: "No user" });
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
      console.error("❌ Profile update error:", e);
      res.status(500).json({ message: "Profile update failed" });
    }
  },
];

export default router;
