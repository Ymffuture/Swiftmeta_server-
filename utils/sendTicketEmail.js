import axios from "axios";

export const sendTicketEmail = async ({
  to_email,
  ticket_id,
  subject,
  message,
}) => {
  return axios.post("https://api.emailjs.com/api/v1.0/email/send", {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email,
      ticket_id,
      subject,
      message,
    },
  });
};
