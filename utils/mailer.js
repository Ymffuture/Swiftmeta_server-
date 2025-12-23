import { Resend } from "resend";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP email using Resend
 */
export async function sendOtpEmail(to, code) {
  if (!to || !code) {
    throw new Error("Missing email or OTP code");
  }

  try {
    const response = await resend.emails.send({
      from: "OTP Login Request <onboarding@resend.dev>",
      to,
      subject: "SwiftMeta — Your OTP Code",
      html: `
        <div style="
          max-width: 480px;
          margin: 0 auto;
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          color: #111827;
        ">

          <h2 style="margin-bottom: 12px;">Your OTP Code</h2>

          <p>
            Use the verification code below to continue.
          </p>

          <div style="
            margin: 24px 0;
            padding: 16px;
            background: #f3f4f6;
            border-radius: 8px;
            text-align: center;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 6px;
          ">
            ${code}
          </div>

          <p style="font-size: 14px; color: #4b5563;">
            This code will expire in <strong>10 minutes</strong>.
          </p>

          <p style="font-size: 13px; color: #6b7280;">
            If you did not request this code, you can safely ignore this email.
          </p>

          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="font-size: 12px; color: #9ca3af;">
            SwiftMeta · Do not reply to this email
          </p>
        </div>
      `,
    });

    return response;
  } catch (error) {
    console.error("❌ OTP email failed:", error);
    throw new Error("Failed to send OTP email");
  }
}
