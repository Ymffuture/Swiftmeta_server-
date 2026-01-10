import axios from "axios";

export const sendTicketEmail = async ({
  to_email,
  ticket_id,
  subject,
  message,
}) => {
  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    access_token: process.env.EMAILJS_PRIVATE_KEY, // ✅ FIXED
    template_params: {
      to_email,
      ticket_id,
      subject,
      message,
    },
  };

  const response = await axios.post(
    "https://api.emailjs.com/api/v1.0/email/send",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};
