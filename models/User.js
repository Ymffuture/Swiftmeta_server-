const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  email: { type: String, required: true },
  username: { type: String, default: function() { return this.phone; } },
  password: { type: String, required: true },
});

module.exports = mongoose.model('User', userSchema);
