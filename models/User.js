const UserSchema = new mongoose.Schema({
  phone: String,
  email: String,
  name: String,
  avatar: String,
  emailVerified: Boolean,

  // Add this block exactly:
  emailOtp: {
    code: String,
    expiresAt: Date
  }
});
