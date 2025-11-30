import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import multer from "multer";
import User from "../models/User.js";

const router = express.Router();
const upload = multer(); // enables multipart body parsing

// Generate 6 digit OTP
function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Load env variables strictly
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const JWT_SECRET = process.env.JWT_SECRET;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn("⚠️ Missing EMAIL_USER or EMAIL_PASS in environment");
}

// Setup Gmail transporter using App Password
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
});

// Verify transporter at startup
transporter.verify((err) => {
  if (err) {
    console.error("❌ Nodemailer transporter verify failed:", err);
  } else {
    console.log("✅ Nodemailer transporter ready");
  }
});

// Test endpoint you can call to confirm email sending works
router.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"SwiftMeta Test" <${EMAIL_USER}>`,
      to: EMAIL_USER,
      subject: "SMTP Test",
      text: `Test successful at ${new Date().toISOString()}`,
    });
    return res.json({ ok: true, response: info.response });
  } catch (err) {
    console.error("TEST EMAIL ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
});

// Register and send email OTP
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email) return res.status(400).json({ message: "Phone and email required" });

    let user = await User.findOne({ $or: [{ phone }, { email }] });
    if (user) return res.status(400).json({ message: "Phone or email already registered" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user = new User({ phone, email, name, emailOtp: { code, expiresAt }, verified: false });
    await user.save();

    try {
      const info = await transporter.sendMail({
        from: `"SwiftMeta" <${EMAIL_USER}>`,
        to: email,
        subject: "SwiftMeta — email verification code",
        text: `Your OTP is: ${code}`,
      });
      console.log("📨 OTP email sent:", info.response);
    } catch (mailErr) {
      console.error("Failed to send OTP email:", mailErr);
      return res.status(500).json({ message: "Registered but failed to send OTP email", emailError: mailErr.message });
    }

    res.json({ message: "Registered, OTP sent to email" });
  } catch (err) {
    console.error("REGISTER FAILED:", err);
    res.status(500).json({ message: "Server error while registering" });
  }
});

// Verify email OTP
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
    user.verified = true;
    await user.save();

    res.json({ message: "Email verified" });
  } catch (err) {
    console.error("VERIFY EMAIL FAILED:", err);
    res.status(500).json({ message: "Server error verifying email" });
  }
});

// Request phone login OTP (SMS not implemented yet)
router.post("/request-phone-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: "No account linked to this phone" });

    const code = makeCode();
    user.phoneOtp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();

    res.json({ message: "Phone OTP generated (SMS service pending)" });
  } catch (err) {
    console.error("PHONE OTP FAILED:", err);
    res.status(500).json({ message: "Server error requesting phone OTP" });
  }
});

// Verify phone OTP and issue JWT login token
router.post("/verify-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: "Phone and code required" });

    const user = await User.findOne({ phone });
    if (!user || !user.phoneOtp) return res.status(400).json({ message: "OTP not requested" });

    if (user.phoneOtp.code !== code || user.phoneOtp.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const token = jwt.sign({ sub: user._id, phone: user.phone }, JWT_SECRET, { expiresIn: "30d" });

    user.phoneOtp = undefined;
    await user.save();

    res.json({ token, user });
  } catch (err) {
    console.error("LOGIN VERIFY FAILED:", err);
    res.status(500).json({ message: "Server error verifying login OTP" });
  }
});

// Standard login by email + password + email OTP (optional if you want emails on login)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.verified) return res.status(403).json({ message: "Email not verified" });

    const token = jwt.sign({ sub: user._id, phone: user.phone }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token, user });
  } catch (err) {
    console.error("LOGIN FAILED:", err);
    res.status(500).json({ message: "Server error while logging in" });
  }
});

export default router;
