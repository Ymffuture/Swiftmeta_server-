import quizzes from "../data/quizzes.json" with { type: "json" };
import QuizAttempt from "../models/QuizAttempt.js";
import EmailToken from "../models/EmailToken.js";
import VerifiedEmail from "../models/VerifiedEmail.js";
import crypto from "crypto";
import { sendMail } from "../utils/mailerquiz.js";
import "dotenv/config";

export const requestVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    // Remove old tokens for this email
    await EmailToken.deleteMany({ email });

    const token = crypto.randomBytes(32).toString("hex");

    await EmailToken.create({
      email,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${token}`;

    await sendMail({
      to: email,
      subject: "Confirm your email address",
      html: `
      <div style="max-width:520px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.6;">
        <h2 style="margin-bottom:12px;">Verify your email address</h2>
        <p>Thanks for starting the coding assessment. Please confirm your email to continue.</p>
        <div style="margin:24px 0;">
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">
            Verify Email
          </a>
        </div>
        <p style="font-size:14px;color:#4b5563;">If the button doesn’t work, copy this link:</p>
        <p style="font-size:13px;background:#f3f4f6;padding:12px;border-radius:6px;word-break:break-all;">
          ${verifyUrl}
        </p>
        <p style="font-size:13px;color:#6b7280;">This link expires in <strong>15 minutes</strong>.</p>
      </div>
      `,
    });

    res.json({ message: "Verification email sent" });
  } catch (err) {
    console.error('Verification request error:', err.message, err.stack);
    res.status(500).json({ message: "Failed to send email", error: err.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token required" });

    const record = await EmailToken.findOne({ token });
    if (!record) {
      console.log('No token found for:', token);
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    if (new Date(record.expiresAt) < new Date()) {
      console.log('Expired token:', token);
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await VerifiedEmail.updateOne(
      { email: record.email },
      { $setOnInsert: { email: record.email } },
      { upsert: true }
    );

    await EmailToken.deleteOne({ _id: record._id });

    res.json({ verified: true });
  } catch (err) {
    console.error('Verification error:', err.message, err.stack);
    res.status(500).json({ message: "Verification failed", error: err.message });
  }
};

export const submitQuiz = async (req, res) => {
  try {
    const { email, answers } = req.body;
    if (!email || !answers) return res.status(400).json({ message: "Missing data" });

    const verified = await VerifiedEmail.findOne({ email });
    if (!verified) {
      console.log('Unverified email attempt:', email);
      return res.status(403).json({ message: "Email not verified" });
    }

    const lastAttempt = await QuizAttempt.findOne({ email }).sort({ attemptedAt: -1 });
    if (lastAttempt && lastAttempt.nextAllowedAttempt > new Date()) {
      console.log('Retake locked for:', email, 'until:', lastAttempt.nextAllowedAttempt);
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
    console.log('Calculated score for', email, ':', score);

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
    console.log('Attempt saved:', attempt._id);

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
    console.error('Quiz submission error:', err.message, err.stack);
    res.status(500).json({ message: "Submission failed", error: err.message });
  }
};

// Optional: Test email endpoint for debugging
export const testEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body; // Allow custom input for testing
    await sendMail({
      to: to || 'test@example.com',
      subject: subject || 'Test Email',
      html: html || '<p>This is a test email.</p>',
    });
    res.json({ message: 'Test email sent' });
  } catch (err) {
    console.error('Test email error:', err.message, err.stack);
    res.status(500).json({ message: 'Test failed', error: err.message });
  }
};
