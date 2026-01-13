import mongoose from "mongoose";

const emailTokenSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      index: true, // For faster deleteMany({ email }) and findOne({ email })
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); // Basic email format check
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true, // Prevents collisions
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      expires: 0, // TTL index: Auto-delete when expiresAt is reached (MongoDB handles this)
    },
  },
  { timestamps: true } // Adds createdAt/updatedAt for debugging token generation time
);

// Pre-save hook for logging (optional, remove in prod if verbose)
emailTokenSchema.pre("save", function (next) {
  console.log(`Creating token for email: ${this.email}, expires at: ${this.expiresAt}`);
  next();
});

// Post-save hook for better duplicate error handling
emailTokenSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    next(new Error("Token already exists")); // Custom message for controller catch
  } else {
    next(error);
  }
});

export default mongoose.model("EmailToken", emailTokenSchema);
