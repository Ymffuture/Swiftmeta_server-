import mongoose from "mongoose";

export default mongoose.model(
  "EmailToken",
  new mongoose.Schema({
    email: String,
    token: String,
    expiresAt: Date
  })
);
