import jwt from "jsonwebtoken";
import crypto from "crypto";

export const signToken = (user) => {
  return jwt.sign(
    {
      sub: user._id,
      email: user.email,
      jti: crypto.randomUUID(), // unique token id
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
