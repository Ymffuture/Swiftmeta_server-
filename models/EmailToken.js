// models/EmailToken.js
import mongoose from "mongoose";

const emailTokenSchema = new mongoose.Schema({
  email: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

export default mongoose.model("EmailToken", emailTokenSchema);
