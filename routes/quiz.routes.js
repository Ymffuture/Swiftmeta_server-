import express from "express";
import {
  requestVerification,
  verifyEmail,
  submitQuiz
} from "../controllers/quiz.controller.js";
import { quizLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/verify-email", requestVerification);
router.get("/verify", verifyEmail);
router.post("/submit", quizLimiter, submitQuiz);

export default router;
