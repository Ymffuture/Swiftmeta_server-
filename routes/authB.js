import { Router } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../models/UserB.js";
import { signToken } from "../utils/jwt.js";
import jwt from "jsonwebtoken";
import RevokedToken from "../models/RevokedToken.js";
import { auth } from "../middleware/authentication.js";

const router = Router();

/* ===========================
   GOOGLE CLIENT
=========================== */
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

/* ===========================
   EMAIL REGISTER
=========================== */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      provider: "email",
    });

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===========================
   EMAIL LOGIN
=========================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===========================
   GOOGLE LOGIN (ID TOKEN)
=========================== */
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token)
      return res.status(400).json({ error: "Missing Google token" });

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name,
        avatar: picture,
        provider: "google",
      });
    }

    const jwtToken = signToken(user);
    res.json({ token: jwtToken, user });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Google authentication failed" });
  }
});


       

/* ===========================
   LOGOUT
=========================== */
router.post("/logout", auth, async (req, res) => {
  try {
    const { jti, exp } = req.user;

    await RevokedToken.create({
      jti,
      expiresAt: new Date(exp * 1000),
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Returns current logged-in user
 */
router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select("_id email avatar provider createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      email: user.email,
      avatar: user.avatar || null,
      provider: user.provider,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;


export default router;
