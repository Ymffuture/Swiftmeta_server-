import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import User from "../models/User.js";
import { sendOtpEmail } from "../utils/mailer.js";
import "dotenv/config";

const router = express.Router();
const upload = multer();

const NODE_ENV = process.env.NODE_ENV || "development";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn("⚠️ Missing JWT_SECRET");
}

/* =====================
   HELPERS
===================== */
const makeCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const isOtpValid = (otpObj, code) =>
  otpObj && otpObj.code === code && otpObj.expiresAt > new Date();

const generateToken = (user) =>
  jwt.sign(
    { sub: user._id, email: user.email, phone: user.phone },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

/* =====================
   CLOUDINARY
===================== */
function uploadToCloudinary(buffer, options = { folder: "swiftmeta_users" }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* =====================
   REGISTER
===================== */
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email)
      return res.status(400).json({ message: "Phone and email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists)
      return res.status(400).json({ message: "Already registered" });

    let avatar;
    if (req.file?.buffer) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      avatar = uploaded.secure_url;
    }

    const emailCode = makeCode();
    const phoneCode = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      phone,
      email,
      name,
      avatar,
      emailOtp: { code: emailCode, expiresAt },
      phoneOtp: { code: phoneCode, expiresAt },
      verified: false,
    });

    if (NODE_ENV !== "development") {
      await sendOtpEmail({
        to: email,
        subject: "Verify your SwiftMeta account",
        code: emailCode,
        expiresMinutes: 15,
      });
    }

    res.json({
      message: "Registered successfully",
      emailOtp: NODE_ENV === "development" ? emailCode : undefined,
      phoneOtp: NODE_ENV === "development" ? phoneCode : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

/* =====================
   VERIFY EMAIL
===================== */
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findOne({ email });
  if (!user || !isOtpValid(user.emailOtp, code))
    return res.status(400).json({ message: "Invalid or expired OTP" });

  user.emailOtp = undefined;
  user.verified = !user.phoneOtp;
  await user.save();

  res.json({ message: "Email verified" });
});

/* =====================
   REQUEST LOGIN OTP
===================== */
router.post("/request-login-otp", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const code = makeCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.emailOtp = { code, expiresAt };
  await user.save();

  if (NODE_ENV !== "development") {
    await sendOtpEmail({
      to: email,
      subject: "Your SwiftMeta login code",
      code,
      expiresMinutes: 10,
    });
  }

  res.json({
    message: "OTP sent",
    otp: NODE_ENV === "development" ? code : undefined,
    expiresAt,
  });
});

/* =====================
   VERIFY LOGIN OTP
===================== */
router.post("/verify-login-otp", async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });

  if (!user || !isOtpValid(user.emailOtp, code))
    return res.status(400).json({ message: "Invalid OTP" });

  const token = generateToken(user);
  user.emailOtp = undefined;
  await user.save();

  res.json({ token, user });
});

export default router;
