import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please use a valid email address",
      ],
      index: true,
    },

    subject: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },

    // Useful for rate limiting & abuse prevention
    ipAddress: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["new", "read", "replied"],
      default: "new",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pagination & sorting performance
ContactSchema.index({ createdAt: -1 });

export default mongoose.model("Contact", ContactSchema);
