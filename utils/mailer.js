import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendOtpEmail(to, code) {
  const html = `<p>Your SwiftMeta OTP code is: <strong>${code}</strong></p>
                <p>It will expire in 10 minutes.</p>`;
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "SwiftMeta — Your OTP code",
    html
  });
}
 
