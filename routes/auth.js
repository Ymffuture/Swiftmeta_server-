import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import User from "../models/User.js";
import sgMail from "@sendgrid/mail";

const router = express.Router();
const upload = multer();

function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const JWT_SECRET = process.env.JWT_SECRET;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;

sgMail.setApiKey(SENDGRID_KEY);

// Primary SMTP transporter (local dev mostly)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 20_000,
  socketTimeout: 20_000,
});

// Helper: send email using fallback
async function sendEmailFallback({ to, subject, text, html }) {
  // Try SMTP first
  try {
    const info = await transporter.sendMail({ from: EMAIL_USER, to, subject, text, html });
    console.log("✅ SMTP email sent:", info.response);
    return { ok: true, provider: "smtp" };
  } catch (smtpErr) {
    console.warn("⚠ SMTP failed, switching to SendGrid API:", smtpErr.message);
  }

  // Fallback to SendGrid API
  try {
    const msg = { from: EMAIL_USER, to, subject, text, html };
    await sgMail.send(msg);
    console.log("✅ SendGrid fallback email sent");
    return { ok: true, provider: "sendgrid" };
  } catch (sgErr) {
    console.error("❌ SendGrid fallback failed:", sgErr.message);
    return { ok: false, provider: "none", error: sgErr.message };
  }
}

// ---------- ROUTES -----------------

// Diagnostics
router.get("/email-diagnostics", async (req, res) => {
  try {
    await transporter.verify();
    res.json({ smtp: "reachable" });
  } catch (err) {
    res.json({ smtp: "blocked", error: err.message, code: err.code });
  }
});

// Test email
router.get("/test-email", async (req, res) => {
  const result = await sendEmailFallback({
    to: EMAIL_USER,
    subject: "Diagnostics Test",
    text: "If you see this, outbound email works",
  });
  res.json({ result });
});

// REGISTER + OTP
router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email) return res.status(400).json({ message: "Phone and email required" });

    let exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists) return res.status(400).json({ message: "Already registered" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({ phone, email, name, emailOtp: { code, expiresAt }, verified: false });
    await user.save();

    const mailResult = await sendEmailFallback({
      to: email,
      subject: "Email Verification Code",
      text: `Your OTP is: ${code}`,
      html: `<h2>Your OTP Code</h2><p>${code}</p><p>Expires in 15 minutes</p>`
    });

    return res.json({ message: "Registered, OTP delivery attempted", mail: mailResult });
  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// VERIFY EMAIL
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.emailOtp) return res.status(400).json({ message: "User not found or OTP missing" });

    if (user.emailOtp.code !== code || user.emailOtp.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.emailOtp = undefined;
    user.verified = true;
    await user.save();
    res.json({ message: "Verified ✅" });
  } catch (err) {
    console.error("VERIFY FAILED:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PHONE OTP REQUEST (send to EMAIL as placeholder)
router.post("/request-phone-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: "No account linked to this phone" });

    const code = makeCode();
    user.phoneOtp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();

    // Send OTP to email during login (temporary until SMS)
    const result = await sendEmailFallback({
      to: user.email,
      subject: "Login OTP Code",
      text: `Your login OTP: ${code}`,
      html: `<p>Login OTP: <strong>${code}</strong></p>`
    });

    res.json({ message: "Login OTP sent to email", mail: result });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "OTP failed" });
  }
});

// PHONE LOGIN VERIFY → JWT
router.post("/verify-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const user = await User.findOne({ phone });
    if (!user || !user.phoneOtp) return res.status(400).json({ message: "OTP missing" });

    if (user.phoneOtp.code !== code || user.phoneOtp.expiresAt < new Date()) {
      return res.status(400).json({ message: "Incorrect or expired OTP" });
    }

    const token = jwt.sign({ sub: user._id, phone }, JWT_SECRET, { expiresIn: "30d" });
    user.phoneOtp = undefined;
    await user.save();
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: "Verify failed" });
  }
});

export default router;
