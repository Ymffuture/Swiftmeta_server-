import express from "express";
const router = express.Router();

import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

// helper to make 6-digit code
function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// register — creates user + sends email OTP
router.post("/register", async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email) {
      return res.status(400).json({ message: "Phone and email required" });
    }

    let user = await User.findOne({ $or: [{ phone }, { email }] });
    if (user) {
      return res.status(400).json({ message: "Phone or email already registered" });
    }

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    user = new User({ phone, email, name, emailOtp: { code, expiresAt } });
    await user.save();

    // send email OTP
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "SwiftMeta — email verification code",
      text: `Your verification code is: ${code}`
    });

    return res.json({ message: "Registered, OTP sent", devPreviewOtp: code });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// verify email OTP
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ message: "Email and code required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  if (!user.emailOtp || user.emailOtp.code !== code || user.emailOtp.expiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  user.emailOtp = undefined;
  await user.save();

  return res.json({ message: "Email verified" });
});

// request phone login OTP
router.post("/request-phone-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ message: "Phone required" });
  }

  let user = await User.findOne({ phone });
  if (!user) {
    user = new User({ phone, email: `${phone}@phone.local` });
    await user.save();
  }

  const code = makeCode();
  user.phoneOtp = { code, expiresAt: new Date(Date.now() + 1000 * 60 * 10) }; // 10 min
  await user.save();

  return res.json({ message: "OTP sent", devPreviewOtp: code });
});

// verify PHONE OTP → returns JWT
router.post("/verify-phone", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ message: "Phone and code required" });
  }

  const user = await User.findOne({ phone });
  if (!user || !user.phoneOtp || user.phoneOtp.code !== code || user.phoneOtp.expiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  const token = jwt.sign(
    { sub: user._id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  user.phoneOtp = undefined;
  await user.save();

  return res.json({ token });
});

// update profile rename
router.put("/profile", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = auth.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { name } = req.body;
    user.name = name || user.name;
    await user.save();

    res.json({ user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Correct ES6 export
export default router;
