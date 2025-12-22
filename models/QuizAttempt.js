import mongoose from "mongoose";

const QuizAttemptSchema = new mongoose.Schema({
  email: { type: String, index: true },
  score: Number,
  percentage: Number,
  passed: Boolean,
  answers: Object,
  attemptedAt: { type: Date, default: Date.now },
  nextAllowedAttempt: Date
});

export default mongoose.model("QuizAttempt", QuizAttemptSchema);
