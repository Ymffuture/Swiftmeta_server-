import mongoose from "mongoose";

const RevokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
});

// Auto-delete when expired
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RevokedToken", RevokedTokenSchema);
