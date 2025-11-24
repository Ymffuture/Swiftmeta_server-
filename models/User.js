const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true }, // login id
  email: { type: String, required: true, unique: true },
  name: { type: String }, // display name (can rename)
  emailOtp: {
    code: String,
    expiresAt: Date
  },
  phoneOtp: {
    code: String,
    expiresAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
