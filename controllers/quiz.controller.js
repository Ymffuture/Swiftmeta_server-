import quizzes from "../data/quizzes.json" with { type: "json" };
import QuizAttempt from "../models/QuizAttempt.js";
import EmailToken from "../models/EmailToken.js";
import VerifiedEmail from "../models/VerifiedEmail.js";
import crypto from "crypto";
import { sendMail } from "../utils/mailerquiz.js";

/* ===============================
   REQUEST EMAIL VERIFICATION
================================ */
export const requestVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await EmailToken.create({
      email,
      token,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${token}`;

    await sendMail({
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Email Verification</h2>
        <p>Click the button below to verify your email:</p>
        <a href="${verifyUrl}" style="
          padding:12px 20px;
          background:#111;
          color:#fff;
          border-radius:8px;
          text-decoration:none;
          display:inline-block;
        ">Verify Email</a>
        <p>This link expires in 10 minutes.</p>
      `
    });

    res.json({ message: "Verification email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send email" });
  }
};

/* ===============================
   VERIFY EMAIL
================================ */
export const verifyEmail = async (req, res) => {
  const { token } = req.query;

  const record = await EmailToken.findOne({ token });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  await VerifiedEmail.updateOne(
    { email: record.email },
    { email: record.email },
    { upsert: true }
  );

  await record.deleteOne();

  res.json({ verified: true });
};

/* ===============================
   SUBMIT QUIZ
================================ */
export const submitQuiz = async (req, res) => {
  try {
    const { email, answers } = req.body;

    if (!email || !answers) {
      return res.status(400).json({ message: "Missing data" });
    }

    const verified = await VerifiedEmail.findOne({ email });
    if (!verified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    const lastAttempt = await QuizAttempt.findOne({ email })
      .sort({ attemptedAt: -1 });

    if (lastAttempt && lastAttempt.nextAllowedAttempt > new Date()) {
      return res.status(403).json({
        message: "Retake locked",
        nextAllowedAttempt: lastAttempt.nextAllowedAttempt
      });
    }

    let score = 0;

    quizzes.forEach(q => {
      const userAnswer = answers[q.id];

      if (!userAnswer) return;

      if (
        q.type === "mcq" &&
        userAnswer === q.correctAnswer
      ) {
        score++;
      }

      if (
        q.type === "output" &&
        String(userAnswer).trim() === String(q.correctAnswer).trim()
      ) {
        score++;
      }
    });

    const percentage = Math.round((score / quizzes.length) * 100);
    const passed = percentage >= 50;

    const nextAllowedAttempt = passed
      ? null
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

    const attempt = await QuizAttempt.create({
      email,
      score,
      percentage,
      passed,
      answers,
      attemptedAt: new Date(),
      nextAllowedAttempt
    });

    /* OPTIONAL: Send result email */
    await sendMail({
      to: email,
      subject: "New Quiz Result",
      html: `
        <h2>New Quiz Submission</h2>
        <p>Email: <strong>${email}</strong></p>
        <p>Score: ${score}/${quizzes.length}</p>
        <p>Percentage: ${percentage}%</p>
        <p>Status: ${passed ? "PASSED" : "FAILED"}</p>
      `
    });

    res.json({
      score,
      percentage,
      passed,
      attemptId: attempt._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Submission failed" });
  }
};
