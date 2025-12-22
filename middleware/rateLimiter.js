import rateLimit from "express-rate-limit";

export const quizLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: "Too many attempts. Try again later." }
});
