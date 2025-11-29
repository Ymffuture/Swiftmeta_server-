import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import multer from "multer";

import User from "../models/User.js";
import auth from "../middleware/auth.js";
import cloud from "../config/cloudinary.js";

const router = express.Router();

// ------------------- HELPERS -------------------

// Generate 6 digit OTP
function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP
const hash = (txt) => crypto.createHash("sha256").update(txt).digest("hex");

// ------------------- EMAIL -------------------

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "Famacloud.ai@gmail.com", // your Gmail
    pass: "ffpf jnlu iqna rexl" ,       // Gmail App Password
  },
  logger: true,
  debug: true,
});

// ------------------- MULTER -------------------

const upload = multer({ storage: multer.memoryStorage() });

// ------------------- REGISTER -------------------

router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email)
      return res.status(400).json({ message: "Phone + email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    // Upload avatar to Cloudinary if file exists
    let imageUrl = "";
    if (req.file) {
      const uploadResult = await cloud.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "users", resource_type: "image" }
      );
      imageUrl = uploadResult.secure_url;
    }

    // OTP setup
    const code = makeCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      phone,
      email,
      name: name || phone,
      avatar: imageUrl,
      emailOtp: { code: hash(code), expiresAt },
      emailVerified: false,
    });

    await user.save();

    // Send Gmail OTP
    let mail;
    try {
      mail = await transporter.sendMail({
        from: `"No Reply" <quorvexinstitute@gmail.com>`,
        to: email,
        subject: "Email Verification Code",
        text: `Your verification code is: ${code}\nThe code expires in 15 minutes.`,
      });
    } catch (mailError) {
      console.error("📧 Gmail Error:", mailError);
      return res
        .status(500)
        .json({ message: "Verification email failed to send via Gmail" });
    }

    console.log("✅ Gmail verification OTP sent:", mail.messageId);
    res.json({ message: "Registration successful, verification email sent" });
  } catch (e) {
    console.error("❌ Registration Error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- EMAIL VERIFICATION -------------------

router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailOtp || user.emailOtp.code !== hash(code))
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.emailOtp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.emailOtp = null;
    user.emailVerified = true;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (e) {
    console.error("❌ Verify Email Error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------- LOGIN -------------------

// Login with phone
router.post("/login-phone", async (req, res) => {
  const { phone } = req.body;
  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: "User not found" });

  const token = jwt.sign({ sub: user._id, phone }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.json({ token, user });
});

// Login with email + OTP
router.post("/login-email", async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (!user.emailOtp || user.emailOtp.code !== hash(code))
    return res.status(400).json({ message: "Invalid OTP" });

  if (user.emailOtp.expiresAt < new Date())
    return res.status(400).json({ message: "OTP expired" });

  user.emailOtp = null;
  user.emailVerified = true;
  await user.save();

  const token = jwt.sign({ sub: user._id, email }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.json({ token, user });
});

// ------------------- PROFILE UPDATE -------------------

router.put("/profile", auth, async (req, res) => {
  const { name, avatar } = req.body;
  req.user.name = name || req.user.phone;
  req.user.avatar = avatar || req.user.avatar;
  await req.user.save();
  res.json({ user: req.user });
});

export default router;
