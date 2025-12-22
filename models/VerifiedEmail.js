import mongoose from "mongoose";

export default mongoose.model(
  "VerifiedEmail",
  new mongoose.Schema({
    email: { type: String, unique: true }
  })
);
