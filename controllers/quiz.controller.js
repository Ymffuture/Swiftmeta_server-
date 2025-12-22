import quizzes from "../data/quizzes.json" assert { type: "json" };
import QuizAttempt from "../models/QuizAttempt.js";
import EmailToken from "../models/EmailToken.js";
import VerifiedEmail from "../models/VerifiedEmail.js";
import crypto from "crypto";

export const requestVerification = async (req, res) => {
  const { email } = req.body;

  const token = crypto.randomBytes(32).toString("hex");

  await EmailToken.create({
    email,
    token,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  console.log(`VERIFY LINK: http://localhost:3000/verify?token=${token}`);

  res.json({ message: "Verification email sent" });
};

export const verifyEmail = async (req, res) => {
  const { token } = req.query;

  const record = await EmailToken.findOne({ token });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ message: "Invalid token" });
  }

  await VerifiedEmail.create({ email: record.email });
  await record.deleteOne();

  res.json({ verified: true });
};

export const submitQuiz = async (req, res) => {
  const { email, answers } = req.body;

  const verified = await VerifiedEmail.findOne({ email });
  if (!verified) {
    return res.status(403).json({ message: "Email not verified" });
  }

  const last = await QuizAttempt.findOne({ email }).sort({ attemptedAt: -1 });
  if (last && last.nextAllowedAttempt > new Date()) {
    return res.status(403).json({
      message: "Retake locked",
      nextAllowedAttempt: last.nextAllowedAttempt
    });
  }

  let score = 0;

  quizzes.forEach(q => {
    const userAnswer = answers[q.id];
    if (
      q.type === "mcq" && userAnswer === q.correctAnswer ||
      q.type === "output" &&
      String(userAnswer).trim() === String(q.correctAnswer).trim()
    ) {
      score++;
    }
  });

  const percentage = (score / quizzes.length) * 100;
  const passed = percentage >= 50;

  const nextAllowedAttempt = passed
    ? null
    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

  await QuizAttempt.create({
    email,
    score,
    percentage,
    passed,
    answers,
    nextAllowedAttempt
  });

  res.json({ score, percentage, passed });
};
