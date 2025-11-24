import express from "express";
import User from "../models/User.js";
import { generateOtp } from "../utils/otp.js";
import { sendOtpEmail } from "../utils/mailer.js";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { sendSmsViaTwilio } from "../utils/twilio.js"; // optional wrapper

const router = express.Router();

const otpLimiter = rateLimit({ windowMs: 60*1000, max: 3, message: "Too many OTP requests" });

// register: phone + email -> create user (username defaults to phone)
router.post("/register", otpLimiter, async (req, res) => {
  const { phone, email } = req.body;
  if (!phone || !email) return res.status(400).json({ message: "phone,email required" });

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ phone, email, username: phone });
  } else {
    user.email = email; // update email if changed
    await user.save();
  }

  // create OTP and send to email (and optional SMS)
  const code = generateOtp();
  user.otp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
  await user.save();

  await sendOtpEmail(email, code);
  // optionally SMS:
  // await sendSmsViaTwilio(phone, `Your OTP: ${code}`);

  res.json({ ok: true, message: "OTP sent to email" });
});

// verify OTP (both register & login)
router.post("/verify-otp", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ message: "phone, code required" });

  const user = await User.findOne({ phone });
  if (!user || !user.otp || user.otp.code !== code || new Date() > user.otp.expiresAt) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  // clear OTP, sign JWT
  user.otp = null;
  await user.save();

  const token = jwt.sign({ sub: user._id, phone: user.phone }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

  res.json({ ok: true, token, user: { id: user._id, phone: user.phone, username: user.username, avatarUrl: user.avatarUrl } });
});

// request OTP by phone (login)
router.post("/request-otp", otpLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "phone required" });

  let user = await User.findOne({ phone });
  if (!user) {
    // optionally create user with placeholder email (or reject)
    user = await User.create({ phone, email: `${phone}@swiftmeta.local`, username: phone });
  }

  const code = generateOtp();
  user.otp = { code, expiresAt: new Date(Date.now() + 10*60*1000) };
  await user.save();

  // send via Twilio or fallback to email if available
  if (process.env.TWILIO_ACCOUNT_SID) {
    await sendSmsViaTwilio(phone, `Your SwiftMeta OTP is ${code}`);
  } else {
    // fallback: send to email if exist or respond with success (for dev)
    if (user.email) await sendOtpEmail(user.email, code);
  }

  res.json({ ok: true, message: "OTP sent" });
});

export default router;
