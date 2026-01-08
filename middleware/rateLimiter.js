import rateLimit from "express-rate-limit";

export const quizLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: "Too many attempts. Try again later." }
});

export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 submissions
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many contact requests. Please try again later.",
  },
});
