import mongoose from "mongoose";

const QuizAttemptSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    score: {
      type: Number,
      required: true,
      min: 0,
    },

    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    passed: {
      type: Boolean,
      required: true,
    },
    answers: {
      type: Map,
      of: String,
      required: true,
    },

    attemptedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    nextAllowedAttempt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

QuizAttemptSchema.index({ email: 1, attemptedAt: -1 });

export default mongoose.model("QuizAttempt", QuizAttemptSchema);
