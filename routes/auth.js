import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// 6 digit code
function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// hash OTP
const hash = (txt) => crypto.createHash("sha256").update(txt).digest("hex");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Register
router.post("/register", async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email)
      return res.status(400).json({ message: "Phone + email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      phone,
      email,
      name: name || phone,
      emailOtp: { code: hash(code), expiresAt },
    });
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verification Code",
      text: `Your OTP is: ${code}`,
    });

    res.json({ message: "Registered, OTP sent", devPreviewOtp: code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify Email OTP
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "Not found" });

  if (!user.emailOtp || user.emailOtp.code !== hash(code))
    return res.status(400).json({ message: "Invalid OTP" });

  if (user.emailOtp.expiresAt < new Date())
    return res.status(400).json({ message: "Expired OTP" });

  user.emailOtp = undefined;
  await user.save();
  res.json({ message: "Verified" });
});

// Login with phone only
router.post("/login-phone", async (req, res) => {
  const { phone } = req.body;
  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: "No user" });

  const token = jwt.sign({ sub: user._id, phone }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  res.json({ token, user });
});

// Rename display name
router.put("/profile", auth, async (req, res) => {
  const { name, avatar } = req.body;
  req.user.name = name || req.user.phone;
  req.user.avatar = avatar;
  await req.user.save();
  res.json({ user: req.user });
});

export default router;
