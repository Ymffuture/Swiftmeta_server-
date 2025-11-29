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
    const hashedCode = hash(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      phone,
      email,
      name: name?.trim() || phone,
      avatar: imageUrl,
      verified: false,
      emailOtp: { code: hashedCode, expiresAt },
    });

    await user.save();
    console.log("📌 OTP stored for:", email, user.emailOtp);

    // 🚀 send OTP mail and log it
    console.log("📤 Sending OTP to:", email);

    const mail = await transporter.sendMail({
      from: `"No Reply" <famacloud.ai@gmail.com>`,
      to: email,
      subject: "Email Verification Code",
      text: `Your verification code is: ${code}\nIt expires in 15 minutes.`,
    });

    console.log("✅ OTP mail sent:", mail.messageId);

    res.json({ message: "Verification email sent" });
  } catch (e) {
    console.error("❌ Registration error:", e);
    res.status(500).json({ message: "Server error" });
  }
});


// ------------------- EMAIL VERIFICATION -------------------

router.post("/verify-email", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailOtp || user.emailOtp.code !== hash(code))
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.emailOtp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.emailOtp = null;
    user.verified = true; // ✅ mark verified in DB
    await user.save();

    res.json({ message: "Verified successfully" });
  } catch (e) {
    console.error("❌ Verification Error:", e);
    res.status(500).json({ message: "Server error" });
  }
});


// ------------------- LOGIN -------------------

// Login with phone
router.post("/login-phone", async (req, res) => {
  try {
    const { phone, code } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailVerified)
      return res.status(403).json({ message: "Verify your email first" });

    if (!user.emailOtp || user.emailOtp.code !== hash(code))
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.emailOtp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.emailOtp = null;
    await user.save();

    const token = jwt.sign(
      { sub: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // ✅ Only return what frontend needs
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (e) {
    console.error("❌ Login failed:", e);
    res.status(500).json({ message: "Login failed" });
  }
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


router.post("/login-phone-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailVerified)
      return res.status(403).json({ message: "Verify your email first" });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.emailOtp = { code: hash(code), expiresAt };
    await user.save();

    await transporter.sendMail({
      to: user.email,
      subject: "Login verification code",
      text: `Your login code is: ${code}. It expires in 10 minutes.`,
    });

    res.json({ message: "OTP sent to email" });
  } catch (e) {
    console.error("❌ OTP request failed:", e);
    res.status(500).json({ message: "OTP request failed" });
  }
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
