import "dotenv/config";
import nodemailer from "nodemailer";

/* ===============================
   CREATE TRANSPORTER
   =============================== */
export const transporter = nodemailer.createTransport({
  service: "gmail",
  secure: true, // forces TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

/* ===============================
   VERIFY TRANSPORTER ON STARTUP
   =============================== */
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("✅ Email transporter ready");
  }
});

/* ===============================
   SEND EMAIL HELPER
   =============================== */
export const sendMail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error("Missing email fields");
  }

  try {
    const info = await transporter.sendMail({
      from: `"Quiz System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: html.replace(/<[^>]*>/g, ""), // text fallback
      html,
    });

    return info;
  } catch (err) {
    console.error("❌ Failed to send email:", err);
    throw new Error("Email delivery failed");
  }
};
