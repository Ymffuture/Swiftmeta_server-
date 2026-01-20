import { jwtVerify, createRemoteJWKSet } from "jose";

const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL;

// Fetch public keys dynamically (BEST PRACTICE)
const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json`)
);

export const authenticateSupabase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    const token = authHeader.replace("Bearer ", "");

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_PROJECT_URL}/auth/v1`,
      audience: "authenticated",
    });

    // Attach user info
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    console.error("Supabase JWT error:", err);
    res.status(401).json({ error: "Unauthorized" });
  }
};
