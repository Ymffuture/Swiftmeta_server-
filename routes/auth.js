import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import User from "../models/User.js";

const router = express.Router();
const upload = multer();

const NODE_ENV = process.env.NODE_ENV || "development";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const JWT_SECRET = process.env.JWT_SECRET;

if (!EMAIL_USER || !EMAIL_PASS || !JWT_SECRET) {
  console.warn("⚠️ Missing EMAIL_USER, EMAIL_PASS, or JWT_SECRET in environment");
}

// -------------------
// Brevo SMTP setup
// -------------------
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // TLS
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  tls: { rejectUnauthorized: true },
  pool: true,
  maxConnections: 5,
  maxMessages: 200,
  connectionTimeout: 20_000,
  socketTimeout: 20_000,
  greetingTimeout: 10_000,
});

transporter.verify(err => {
  if (err) console.error("❌ Brevo SMTP verify failed:", err.message);
  else console.log("✅ Brevo SMTP ready");
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

// SMTP test email
router.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"SwiftMeta Test" <${EMAIL_USER}>`,
      to: EMAIL_USER,
      subject: "Brevo SMTP Test",
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
    console.log("📩 Registration OTP:", code);

    if (NODE_ENV !== "development") {
      await transporter.sendMail({
        from: `"SwiftMeta" <${EMAIL_USER}>`,
        to: email,
        subject: "Account verification",
        text: `Your verification code is: ${code}`,
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

// Verify email
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
// Login email OTP
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
    console.log("🔐 Login OTP:", code);

    if (NODE_ENV !== "development") {
      await transporter.sendMail({
        from: `"SwiftMeta Auth" <${EMAIL_USER}>`,
        to: email,
        subject: "Login code",
        text: `Your login code is: ${code}. It expires in 10 minutes.`,
      });
    }

    res.json({
      message: "OTP sent",
      otp: NODE_ENV === "development" ? code : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REQUEST LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error requesting login OTP" });
  }
});

// Verify login OTP
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

export default router;
