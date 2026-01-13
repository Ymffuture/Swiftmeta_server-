import mongoose from "mongoose";

const VerifiedEmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"], // Custom error message
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          // Basic regex for email format (RFC-compliant is overkill here)
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre-save hook for optional logging (remove in production if not needed)
VerifiedEmailSchema.pre("save", function (next) {
  console.log(`Verifying email: ${this.email}`); // Helps debug in controller
  next();
});

// Post-save hook to handle duplicate errors gracefully
VerifiedEmailSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    next(new Error("This email is already verified")); // Custom message for controller catch blocks
  } else {
    next(error);
  }
});

export default mongoose.model("VerifiedEmail", VerifiedEmailSchema);
