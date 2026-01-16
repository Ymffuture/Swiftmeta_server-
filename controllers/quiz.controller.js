import quizzes from "../data/quizzes.json" with { type: "json" };
import QuizAttempt from "../models/QuizAttempt.js";
import EmailToken from "../models/EmailToken.js";
import VerifiedEmail from "../models/VerifiedEmail.js";
import crypto from "crypto";
import "dotenv/config";

/* ======================================================
   REQUEST EMAIL VERIFICATION (SEND DATA TO FRONTEND)
====================================================== */
export const requestVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    // Remove previous tokens
    await EmailToken.deleteMany({ email });

    const token = crypto.randomBytes(32).toString("hex");

    await EmailToken.create({
      email,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${token}`;

    // ✅ SEND PAYLOAD FOR EMAILJS
    res.json({
      emailPayload: {
        to_email: email,
        subject: "Confirm your email address",
        message: `Click the link below to verify your email:\n\n${verifyUrl}`,
        verify_url: verifyUrl,
      },
    });
  } catch (err) {
    console.error("Verification request error:", err);
    res.status(500).json({ message: "Failed to request verification" });
  }
};

/* ======================================================
   VERIFY EMAIL TOKEN
====================================================== */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) return res.status(400).json({ message: "Token required" });

    const record = await EmailToken.findOne({ token });
    if (!record || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await VerifiedEmail.updateOne(
      { email: record.email },
      { $setOnInsert: { email: record.email } },
      { upsert: true }
    );

    await EmailToken.deleteOne({ _id: record._id });

    res.json({ verified: true, email: record.email }); // ✅ return email
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};


/* ======================================================
   SUBMIT QUIZ (RETURN RESULT + EMAILJS PAYLOAD)
====================================================== */
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

    const lastAttempt = await QuizAttempt.findOne({ email }).sort({
      attemptedAt: -1,
    });

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
      if (
        q.type === "output" &&
        String(userAnswer).trim() === String(q.correctAnswer).trim()
      )
        score++;
    });

    const percentage = Math.round((score / quizzes.length) * 100);
    const passed = percentage >= 50;

    const nextAllowedAttempt = passed
      ? null
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const attempt = await QuizAttempt.create({
      email,
      score,
      percentage,
      passed,
      answers,
      attemptedAt: new Date(),
      nextAllowedAttempt,
    });

    // ✅ EMAILJS RESULT PAYLOAD
    res.json({
      score,
      percentage,
      passed,
      attemptId: attempt._id,
      emailPayload: {
        to_email: email,
        ticket_id: attempt._id.toString(),
        subject: "Quiz Result",
        message: `
Email: ${email}
Score: ${score}/${quizzes.length}
Percentage: ${percentage}%
Status: ${passed ? "PASSED" : "FAILED"}
        `,
      },
    });
  } catch (err) {
    console.error("Quiz submission error:", err);
    res.status(500).json({ message: "Submission failed" });
  }
};
