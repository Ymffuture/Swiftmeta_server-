import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import axios from "axios";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js"; // make sure this exists and exports configured v2
import User from "../models/User.js";

const router = express.Router();
const upload = multer();

const NODE_ENV = process.env.NODE_ENV || "development";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const JWT_SECRET = process.env.JWT_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!EMAIL_USER || !EMAIL_PASS || !JWT_SECRET || !BREVO_API_KEY) {
  console.warn("⚠️ Missing environment variables");
}

// =======================
// SMTP Transporter
// =======================
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  tls: { rejectUnauthorized: true },
  pool: true,
  maxConnections: 5,
  maxMessages: 200,
  connectionTimeout: 20000,
  socketTimeout: 20000,
  greetingTimeout: 10000,
});

transporter.verify(err => {
  if (err) console.error("❌ Brevo SMTP verify failed:", err.message);
  else console.log("✅ Brevo SMTP ready");
});

// =======================
// Helpers
// =======================
const makeCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const isOtpValid = (otpObj, code) =>
  otpObj && otpObj.code === code && otpObj.expiresAt > new Date();

const generateToken = (user) =>
  jwt.sign({ sub: user._id, email: user.email, phone: user.phone }, JWT_SECRET, {
    expiresIn: "30d",
  });

const sendSms = async (recipient, content, sender = "SwiftMeta") => {
  const url = "https://api.brevo.com/v3/transactionalSMS/send";
  const data = {
    sender,
    recipient,
    content,
    type: "transactional",
  };
  const config = {
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
  };
  await axios.post(url, data, config);
};

// =======================
// Cloudinary upload helper
// =======================
function uploadToCloudinary(buffer, options = { folder: "swiftmeta_users" }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// =======================
// JWT BLACKLIST FOR LOGOUT
// =======================
const tokenBlacklist = new Set();

function checkBlacklist(req, res, next) {
  const header = req.headers.authorization;
  if (!header)
    return res.status(401).json({ message: "No token provided" });

  const token = header.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "No token provided" });

  if (tokenBlacklist.has(token))
    return res.status(401).json({ message: "Token has been logged out" });

  next();
}

// =======================
// Routes
// =======================

// Test email
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

// ---------------------------
// Register (with avatar upload)
// ---------------------------
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email)
      return res.status(400).json({ message: "Phone and email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists)
      return res.status(400).json({ message: "Phone or email already registered" });

    // Upload avatar if provided
    let avatarUrl = undefined;
    if (req.file && req.file.buffer) {
      try {
        const uploaded = await uploadToCloudinary(req.file.buffer, { folder: "swiftmeta_users", quality: "auto" });
        avatarUrl = uploaded.secure_url;
      } catch (uploadErr) {
        console.error("CLOUDINARY UPLOAD ERROR:", uploadErr);
        return res.status(500).json({ message: "Failed to upload avatar" });
      }
    }

    const emailCode = makeCode();
    const phoneCode = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      phone,
      email,
      name,
      avatar: avatarUrl,
      emailOtp: { code: emailCode, expiresAt },
      phoneOtp: { code: phoneCode, expiresAt },
      verified: false,
    });

    await user.save();
    console.log("📩 Email OTP:", emailCode);
    console.log("📱 Phone OTP:", phoneCode);

    if (NODE_ENV !== "development") {
      await transporter.sendMail({
        from: `"SwiftMeta" <${EMAIL_USER}>`,
        to: email,
        subject: "Account verification",
        text: `Your email verification code is: ${emailCode}`,
      });
      await sendSms(phone, `Your phone verification code is: ${phoneCode}`);
    }

    res.json({
      message: "Registered successfully",
      avatar: avatarUrl,
      emailOtp: NODE_ENV === "development" ? emailCode : undefined,
      phoneOtp: NODE_ENV === "development" ? phoneCode : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error while registering" });
  }
});

// ---------------------------
// Verify Email
// ---------------------------
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.emailOtp)
      return res.status(400).json({ message: "User not found or OTP not requested" });

    if (!isOtpValid(user.emailOtp, code))
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.emailOtp = undefined;
    user.verified = !user.phoneOtp;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error verifying email" });
  }
});

// ---------------------------
// Verify Phone
// ---------------------------
router.post("/verify-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;

    const user = await User.findOne({ phone });
    if (!user || !user.phoneOtp)
      return res.status(400).json({ message: "User not found or OTP not requested" });

    if (!isOtpValid(user.phoneOtp, code))
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.phoneOtp = undefined;
    user.verified = !user.emailOtp;
    await user.save();

    res.json({ message: "Phone verified successfully" });
  } catch (err) {
    console.error("VERIFY PHONE ERROR:", err);
    res.status(500).json({ message: "Server error verifying phone" });
  }
});

// ---------------------------
// Request Login OTP (Email)
// ---------------------------
router.post("/request-login-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "No account linked to this email" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.emailOtp = { code, expiresAt };
    await user.save();

    console.log("🔐 Email Login OTP:", code);

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

// ---------------------------
// Verify Login OTP (Email)
// ---------------------------
router.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.emailOtp)
      return res.status(400).json({ message: "OTP not requested" });

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

// ---------------------------
// Request Login OTP (Phone)
// ---------------------------
router.post("/request-login-otp-phone", async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(400).json({ message: "No account linked to this phone" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.phoneOtp = { code, expiresAt };
    await user.save();

    console.log("🔐 Phone Login OTP:", code);

    if (NODE_ENV !== "development") {
      await sendSms(phone, `Your login code is: ${code}. It expires in 10 minutes.`);
    }

    res.json({
      message: "OTP sent",
      otp: NODE_ENV === "development" ? code : undefined,
      expiresAt,
    });
  } catch (err) {
    console.error("REQUEST PHONE LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error requesting phone login OTP" });
  }
});

// ---------------------------
// Verify Login OTP (Phone)
// ---------------------------
router.post("/verify-login-otp-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;

    const user = await User.findOne({ phone });
    if (!user || !user.phoneOtp)
      return res.status(400).json({ message: "OTP not requested" });

    if (!isOtpValid(user.phoneOtp, code))
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const token = generateToken(user);

    user.phoneOtp = undefined;
    await user.save();

    res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("VERIFY PHONE LOGIN OTP ERROR:", err);
    res.status(500).json({ message: "Server error verifying phone login OTP" });
  }
});

// =======================
// LOGOUT
// =======================
router.post("/logout", checkBlacklist, (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header)
      return res.status(400).json({ message: "No token provided" });

    const token = header.split(" ")[1];
    if (!token)
      return res.status(400).json({ message: "No token provided" });

    tokenBlacklist.add(token);

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("LOGOUT ERROR:", err);
    res.status(500).json({ message: "Server error logging out" });
  }
});

export default router;
