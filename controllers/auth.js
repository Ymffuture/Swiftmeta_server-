const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: 'yourgmail@gmail.com', pass: 'yourapppassword' },
});

exports.register = async (req, res) => {
  const { phone, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ phone, email, password: hashed });
  await user.save();
  res.status(201).json({ message: 'User registered' });
};

exports.login = async (req, res) => {
  const { phone } = req.body;
  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  // Save OTP temporarily, e.g., in user model or session
  user.tempOtp = otp;
  await user.save();

  transporter.sendMail({
    to: user.email,
    subject: 'OTP Code',
    text: `Your OTP is ${otp}`,
  });

  res.json({ message: 'OTP sent' });
};

exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  const user = await User.findOne({ phone });
  if (user.tempOtp === otp) {
    const token = jwt.sign({ id: user._id }, 'secretkey');
    res.json({ token });
  } else {
    res.status(400).json({ message: 'Invalid OTP' });
  }
};

exports.updateUsername = async (req, res) => {
  const { username } = req.body;
  const user = await User.findById(req.userId);
  user.username = username;
  await user.save();
  res.json({ message: 'Username updated' });
};
