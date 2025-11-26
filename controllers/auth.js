import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: 'yourgmail@gmail.com', pass: 'yourapppassword' },
});

export const register = async (req, res) => {
  const { phone, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ phone, email, password: hashed });
  await user.save();
  res.status(201).json({ message: 'User registered' });
};

export const login = async (req, res) => {
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

export const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  const user = await User.findOne({ phone });
  if (user.tempOtp === otp) {
    const token = jwt.sign({ id: user._id }, 'secretkey');
    res.json({ token });
  } else {
    res.status(400).json({ message: 'Invalid OTP' });
  }
};

export const updateUsername = async (req, res) => {
  const { username } = req.body;
  const user = await User.findById(req.userId);
  user.username = username;
  await user.save();
  res.json({ message: 'Username updated' });
};
