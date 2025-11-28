import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Generate 6 digit OTP
function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP
const hash = (txt) => crypto.createHash("sha256").update(txt).digest("hex");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Register user and send OTP (OPTIONAL)
import cloud from "../config/cloudinary.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { phone, email, name } = req.body;
    if (!phone || !email)
      return res.status(400).json({ message: "Phone + email required" });

    const exists = await User.findOne({ $or: [{ phone }, { email }] });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    // Upload avatar if file exists
    let imageUrl = "";
    if (req.file) {
      const up = await cloud.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "users", resource_type: "image" }
      );
      imageUrl = up.secure_url;
    }

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

    // Send OTP email and validate delivery
    const mail = await transporter.sendMail({
      from: `"No Reply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Email Verification Code",
      text: `Your verification code is: ${code}\nThe code expires in 15 minutes.`,
    });

    if (!mail.messageId) {
      return res.status(500).json({ message: "Email not delivered" });
    }

    console.log("✅ Verification email sent:", mail.messageId);

    res.json({ message: "Registration successful, verification email sent" });
  } catch (e) {
    console.error("❌ Registration Error:", e);
    res.status(500).json({ message: "Server error, email not sent" });
  }
});


// Optional email verification (won't block login)
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "Not found" });

  if (!user.emailOtp || user.emailOtp.code !== hash(code))
    return res.status(400).json({ message: "Invalid OTP" });

  if (user.emailOtp.expiresAt < new Date())
    return res.status(400).json({ message: "Expired OTP" });

  user.emailOtp = undefined;
  user.emailVerified = true;
  user.emailOtp = null;
  user.emailVerified = true;
  await user.save();
  res.json({ message: "Email verified! But login was never blocked." });
});

// LOGIN WITH PHONE (NO OTP CHECK)
router.post("/login-phone", async (req, res) => {
  const { phone } = req.body;
  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: "No user found" });

  const token = jwt.sign({ sub: user._id, phone }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.json({ token, user });
});

// LOGIN WITH EMAIL + OTP CHECK (OPTIONAL login method)
router.post("/login-email", async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "No user found" });

  if (!user.emailOtp || user.emailOtp.code !== hash(code))
    return res.status(400).json({ message: "Invalid OTP" });

  if (user.emailOtp.expiresAt < new Date())
    return res.status(400).json({ message: "OTP expired" });

  user.emailOtp = undefined;
  user.emailVerified = true;
  await user.save();

  const token = jwt.sign({ sub: user._id, email }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.json({ token, user });
});

// Update profile
router.put("/profile", auth, async (req, res) => {
  const { name, avatar } = req.body;
  req.user.name = name || req.user.phone;
  req.user.avatar = avatar || req.user.avatar;
  await req.user.save();
  res.json({ user: req.user });
});

export default router;
