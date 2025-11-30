// routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import User from "../models/User.js";

const router = express.Router();
const upload = multer(); // handles multipart form data

const NODE_ENV = process.env.NODE_ENV || "development";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const JWT_SECRET = process.env.JWT_SECRET;

if (!EMAIL_USER || !EMAIL_PASS || !JWT_SECRET) {
  console.warn("⚠️ Missing EMAIL_USER, EMAIL_PASS, or JWT_SECRET in environment");
}

// -------------------
// Nodemailer setup
// -------------------
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 20_000,
  socketTimeout: 20_000,
  greetingTimeout: 15_000,
});

transporter.verify(err => {
  if (err) console.error("❌ Nodemailer verify failed:", err);
  else console.log("✅ Nodemailer ready");
});

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

// -------------------
// Routes
// -------------------

// Test email
router.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"SwiftMeta Test" <${EMAIL_USER}>`,
      to: EMAIL_USER,
      subject: "SMTP Test",
      text: `Test successful at ${new Date().toISOString()}`,
    });
    res.json({ ok: true, response: info.response });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------
// Registration & Email OTP
// -------------------
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email) return res.status(400).json({ message: "Phone and email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists) return res.status(400).json({ message: "Phone or email already registered" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      phone,
      email,
      name,
      emailOtp: { code, expiresAt },
      verified: false,
    });

    await user.save();

    if (NODE_ENV !== "development") {
      await transporter.sendMail({
        from: `"SwiftMeta" <${EMAIL_USER}>`,
        to: email,
        subject: "SwiftMeta — email verification code",
        text: `Your OTP is: ${code}`,
      });
    }

    res.json({
      message: "Registered successfully",
      otp: NODE_ENV === "development" ? code : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error while registering" });
  }
});

// Verify Email OTP
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user || !user.emailOtp)
      return res.status(400).json({ message: "User not found or OTP not requested" });

    if (!isOtpValid(user.emailOtp, code))
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.emailOtp = undefined;
    user.verified = true;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error verifying email" });
  }
});

// -------------------
// Request Email OTP (login)
// -------------------
router.post("/request-login-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "No account linked to this email" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.emailOtp = { code, expiresAt };
    await user.save();
console.log(code) 
    if (NODE_ENV !== "development") {
      await transporter.sendMail({
        from: `"SwiftMeta" <${EMAIL_USER}>`,
        to: email,
        subject: "Login OTP",
        text: `Your login OTP: ${code}`,
      });
    }

    res.json({
      message: "OTP generated",
      otp: NODE_ENV === "development" ? code : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REQUEST LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error requesting login OTP" });
  }
});

// Verify Email Login OTP
router.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user || !user.emailOtp) return res.status(400).json({ message: "OTP not requested" });

    if (!isOtpValid(user.emailOtp, code))
      return res.status(400).json({ message: "Invalid or expired OTP" });

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
// Request Phone OTP
// -------------------
router.post("/request-phone-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: "No account linked to this phone" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.phoneOtp = { code, expiresAt };
    await user.save();

    res.json({
      message: "Phone OTP generated",
      otp: NODE_ENV === "development" ? code : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REQUEST PHONE OTP ERROR:", err);
    res.status(500).json({ message: "Server error requesting phone OTP" });
  }
});

// Verify Phone OTP
router.post("/verify-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: "Phone and OTP required" });

    const user = await User.findOne({ phone });
    if (!user || !user.phoneOtp) return res.status(400).json({ message: "OTP not requested" });

    if (!isOtpValid(user.phoneOtp, code))
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const token = generateToken(user);
    user.phoneOtp = undefined;
    await user.save();

    res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("VERIFY PHONE OTP ERROR:", err);
    res.status(500).json({ message: "Server error verifying phone OTP" });
  }
});

// -------------------
// Email + Password login
// -------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.verified) return res.status(403).json({ message: "Email not verified" });

    const token = generateToken(user);
    res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error logging in" });
  }
});

export default router;
