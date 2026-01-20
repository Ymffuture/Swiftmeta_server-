import { jwtVerify } from "jose";

// Replace with your Supabase project settings
const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_JWT_PUBLIC_KEY; // from Supabase JWT settings

export const authenticateSupabase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SUPABASE_PUBLIC_KEY));

    // Supabase userId is in payload.sub
    req.userId = payload.sub;

    next();
  } catch (err) {
    console.error("Supabase Auth Error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};
