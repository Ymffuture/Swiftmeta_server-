import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import multer from "multer";
import User from "../models/User.js";

const router = express.Router();
const upload = multer(); // ✅ enables multipart body parsing

function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Correct OAuth2 transporter config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN, // ❗ fixed key
  },
});

// ✅ Register + send email OTP
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ message: "Request body missing" });

    const { phone, email, name } = req.body;
    if (!phone || !email) return res.status(400).json({ message: "Phone and email required" });

    let user = await User.findOne({ $or: [{ phone }, { email }] });
    if (user) return res.status(400).json({ message: "Phone or email already registered" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user = new User({ phone, email, name, emailOtp: { code, expiresAt } });
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "SwiftMeta — email verification code",
      text: `Your OTP is: ${code}`,
    });

    res.json({ message: "Registered, OTP sent to email" });
  } catch (err) {
    console.error("REGISTER FAILED:", err);
    res.status(500).json({ message: "Server error while registering" });
  }
});

// ✅ Verify email OTP
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code required" });

    const user = await User.findOne({ email });
    if (!user || !user.emailOtp) return res.status(400).json({ message: "User not found or OTP missing" });

    if (user.emailOtp.code !== code || user.emailOtp.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.emailOtp = undefined;
    await user.save();

    res.json({ message: "Email verified" });
  } catch (err) {
    console.error("OTP VERIFY FAILED:", err);
    res.status(500).json({ message: "Server error while verifying OTP" });
  }
});

// ✅ Request login OTP by phone (SMS later)
router.post("/request-phone-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: "No account linked to this phone number" });

    const code = makeCode();
    user.phoneOtp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();

    res.json({ message: "OTP generated (SMS service pending)" });
  } catch (err) {
    console.error("PHONE OTP FAILED:", err);
    res.status(500).json({ message: "Server error while generating phone OTP" });
  }
});

// ✅ Verify login OTP and issue JWT
router.post("/verify-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: "Phone and code required" });

    const user = await User.findOne({ phone });
    if (!user || !user.phoneOtp) return res.status(400).json({ message: "OTP not requested" });

    if (user.phoneOtp.code !== code || user.phoneOtp.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const token = jwt.sign(
      { sub: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    user.phoneOtp = undefined;
    await user.save();

    res.json({ token, user });
  } catch (err) {
    console.error("LOGIN VERIFY FAILED:", err);
    res.status(500).json({ message: "Server error during OTP login" });
  }
});

// ✅ Update profile name
router.put("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    const { name } = req.body;
    if (name) user.name = name.trim();
    await user.save();

    res.json({ user });
  } catch (err) {
    console.error("PROFILE UPDATE FAILED:", err);
    res.status(500).json({ message: "Server error updating profile" });
  }
});

export default router;
