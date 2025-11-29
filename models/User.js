import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, required: true },  // ✅ enforce phone exists
    email: { type: String, unique: true, required: true },  // ✅ enforce email exists
    name: { type: String, default: function () { return this.phone } }, // ✅ fallback
    avatar: { type: String, default: "" }, // ✅ always defined so React doesn't break
    EmailVerified: { type: Boolean, default: false }, // ✅ OTP can now mark verification
    
    emailOtp: {
      code: String,
      expiresAt: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", schema);
