import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendOtpEmail(to, code) {
  const html = `<p>Your SwiftMeta OTP code is: <strong>${code}</strong></p>
                <p>It will expire in 10 minutes.</p>`;
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "SwiftMeta — Your OTP code",
    html
  });
}

