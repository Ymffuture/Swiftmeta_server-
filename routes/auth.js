import express from "express";
import jwt from "jsonwebtoken";
import { TransactionalEmailsApi, ApiClient } from "@getbrevo/brevo";
import multer from "multer";
import User from "../models/User.js";

const router = express.Router();
const upload = multer();

// -------------------
// Environment
// -------------------
const NODE_ENV = process.env.NODE_ENV || "development";
const EMAIL_USER = process.env.EMAIL_USER;
const JWT_SECRET = process.env.JWT_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY; // Must be Brevo SMTP/API key

if (!EMAIL_USER || !JWT_SECRET || !BREVO_API_KEY) {
  console.warn("⚠️ Missing required email or JWT environment variables");
}

// -------------------
// Brevo API setup
// -------------------
const client = ApiClient.instance;
client.authentications["api-key"].apiKey = BREVO_API_KEY;

const emailAPI = new TransactionalEmailsApi();

// -------------------
// Helpers
// -------------------
const makeCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const isOtpValid = (otpObj, code) =>
  otpObj && otpObj.code === code && otpObj.expiresAt > new Date();

const generateToken = (user) =>
  jwt.sign({ sub: user._id, email: user.email, phone: user.phone }, JWT_SECRET, {
    expiresIn: "30d",
  });

async function sendOTPEmail(to, otp, subject = "Your OTP Code") {
  await emailAPI.sendTransacEmail({
    sender: { email: EMAIL_USER, name: "SwiftMeta Auth" },
    to: [{ email: to }],
    subject,
    htmlContent: `
      <div style="font-family:sans-serif;padding:20px">
        <h2>Your code</h2>
        <p style="font-size:24px;font-weight:bold">${otp}</p>
        <p>Expires soon — don't share it.</p>
      </div>
    `
  });
}

// -------------------
// Routes
// -------------------

// Test email
router.get("/test-email", async (req, res) => {
  try {
    await emailAPI.sendTransacEmail({
      sender: { email: EMAIL_USER, name: "SwiftMeta Test" },
      to: [{ email: EMAIL_USER }],
      subject: "Brevo API Test",
      htmlContent: `<p>Test successful at ${new Date().toISOString()}</p>`
    });
    res.json({ ok: true, message: "Test email sent via Brevo API" });
  } catch (err) {
    console.error("TEST EMAIL ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------
// Registration Email OTP
// -------------------
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email) return res.status(400).json({ message: "Phone and email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists) return res.status(400).json({ message: "Phone or email already registered" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({ phone, email, name, emailOtp: { code, expiresAt }, verified: false });
    await user.save();

    console.log("📩 Registration OTP:", code);

    if (NODE_ENV !== "development") {
      await sendOTPEmail(email, code, "Account Verification Code");
    }

    res.json({ message: "Registered successfully", otp: NODE_ENV === "development" ? code : undefined, expiresAt });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error while registering" });
  }
});

// -------------------
// Login OTP
// -------------------
router.post("/request-login-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No user found with this email" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.emailOtp = { code, expiresAt };
    await user.save();

    console.log("🔐 Login OTP:", code);

    if (NODE_ENV !== "development") {
      await sendOTPEmail(email, code, "Your Login OTP");
    }

    res.json({ message: "OTP sent", otp: NODE_ENV === "development" ? code : undefined, expiresAt });
  } catch (err) {
    console.error("REQUEST LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error requesting login OTP" });
  }
});

// -------------------
// Verify Login OTP
// -------------------
router.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user || !user.emailOtp) return res.status(400).json({ message: "OTP not requested" });

    if (!isOtpValid(user.emailOtp, code)) return res.status(400).json({ message: "Invalid or expired OTP" });

    const token = generateToken(user);
    user.emailOtp = undefined;
    await user.save();

    res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("VERIFY LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error verifying login OTP" });
  }
});

// -------------------
// Password login
// -------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.verified) return res.status(403).json({ message: "Email not verified" });

    const token = generateToken(user);
    res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error logging in" });
  }
});

export default router;
