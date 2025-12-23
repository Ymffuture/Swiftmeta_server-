import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error("Missing email fields");
  }

  try {
    const data = await resend.emails.send({
      from: "Quiz System <onboarding@resend.dev>", // ✅ REQUIRED
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", data.id);
    return data;
  } catch (err) {
    console.error("❌ Email send failed:", err);
    throw new Error("Email delivery failed");
  }
};
