// controllers/quizController.js (email verification bypassed)

import quizzes from "../data/quizzes.json" with { type: "json" };
import QuizAttempt from "../models/QuizAttempt.js";
// import EmailToken from "../models/EmailToken.js";          // Commented out (not used)
// import VerifiedEmail from "../models/VerifiedEmail.js";    // Commented out (not used)
import crypto from "crypto";
import { sendMail } from "../utils/mailerquiz.js";
import "dotenv/config";

/* ===============================
   REQUEST VERIFICATION (disabled)
================================ */
// export const requestVerification = async (req, res) => { ... };  // Fully commented out

/* ===============================
   VERIFY EMAIL (disabled)
================================ */
// export const verifyEmail = async (req, res) => { ... };  // Fully commented out

export const submitQuiz = async (req, res) => {
  try {
    const { email, answers } = req.body;
    if (!email || !answers) return res.status(400).json({ message: "Missing data" });

    // Email verification check removed
    // const verified = await VerifiedEmail.findOne({ email });
    // if (!verified) return res.status(403).json({ message: "Email not verified" });

    const lastAttempt = await QuizAttempt.findOne({ email }).sort({ attemptedAt: -1 });
    if (lastAttempt && lastAttempt.nextAllowedAttempt > new Date()) {
      return res.status(403).json({
        message: "Retake locked",
        nextAllowedAttempt: lastAttempt.nextAllowedAttempt,
      });
    }

    let score = 0;
    quizzes.forEach((q) => {
      const userAnswer = answers[q.id];
      if (!userAnswer) return;

      if (q.type === "mcq" && userAnswer === q.correctAnswer) score++;
      if (q.type === "output" && String(userAnswer).trim() === String(q.correctAnswer).trim()) score++;
    });

    const percentage = Math.round((score / quizzes.length) * 100);
    const passed = percentage >= 50;
    const nextAllowedAttempt = passed ? null : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const attempt = await QuizAttempt.create({
      email,
      score,
      percentage,
      passed,
      answers,
      attemptedAt: new Date(),
      nextAllowedAttempt,
    });

    await sendMail({
      to: email,
      subject: "Quiz Result",
      html: `
        <h2>Quiz Result</h2>
        <p>Email: <strong>${email}</strong></p>
        <p>Score: ${score}/${quizzes.length}</p>
        <p>Percentage: ${percentage}%</p>
        <p>Status: ${passed ? "PASSED" : "FAILED"}</p>
      `,
    });

    res.json({ score, percentage, passed, attemptId: attempt._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Submission failed" });
  }
};
