// models/QuizAttempt.js
import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema({
  email: { type: String, required: true },
  score: { type: Number, required: true },
  percentage: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  answers: { type: mongoose.Schema.Types.Mixed, required: true },
  attemptedAt: { type: Date, default: Date.now },
  nextAllowedAttempt: { type: Date },
});

export default mongoose.model("QuizAttempt", quizAttemptSchema);
