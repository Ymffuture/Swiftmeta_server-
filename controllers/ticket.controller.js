import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";
import emailjs from '@emailjs/nodejs';

/* ---------------------------------
   EmailJS Initialization
---------------------------------- */
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY_2,
  privateKey: process.env.EMAILJS_PRIVATE_KEY_2,
});

/* ---------------------------------
   Helper: Send Email Notification (fire-and-forget)
---------------------------------- */
const sendEmailNotification = async (templateId, params) => {
  if (!process.env.EMAILJS_SERVICE_ID_2 || !templateId) {
    return; // Skip silently if not configured
  }

  try {
    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID_2,
      templateId,
      params
    );
    console.log(`Email sent successfully using template: ${templateId}`);
  } catch (err) {
    console.error(`Failed to send email with template ${templateId}:`, err);
    // Failure is non-blocking
  }
};

/* ---------------------------------
   Create Ticket
---------------------------------- */
export const createTicket = async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    const ticket = await Ticket.create({
      ticketId: generateTicketId(),
      email,
      subject: subject || "No subject",
      status: "open",
      lastReplyBy: "user",
      messages: [{ sender: "user", message }],
    });

    // ----- Email Notifications -----
    // 1. Confirmation to the user
    sendEmailNotification(process.env.EMAILJS_TEMPLATE_USER, {
      to_email: email,
      ticket_id: ticket.ticketId,
      subject: ticket.subject,
      message_content: message,
      notification_type: "ticket_created", // Helps template show right subject/message
      is_admin: false,
    });

    // 2. Notification to admin (new ticket)
    if (process.env.ADMIN_EMAIL && process.env.EMAILJS_TEMPLATE_ADMIN) {
      sendEmailNotification(process.env.EMAILJS_TEMPLATE_ADMIN, {
        to_email: process.env.ADMIN_EMAIL,
        from_email: email,
        ticket_id: ticket.ticketId,
        subject: ticket.subject,
        message_content: message,
        notification_type: "new_ticket",
        is_admin: true,
      });
    }

    res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
};

/* ---------------------------------
   Reply to Ticket
---------------------------------- */
export const replyToTicket = async (req, res) => {
  try {
    const { message, sender } = req.body;

    if (!message || !sender) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    if (!["user", "admin"].includes(sender)) {
      return res.status(400).json({ error: "Invalid sender" });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    if (ticket.status === "closed") {
      return res.status(400).json({ error: "Ticket is closed" });
    }

    ticket.messages.push({ sender, message });
    ticket.lastReplyBy = sender;
    ticket.status = sender === "admin" ? "open" : "pending";

    await ticket.save();

    // ----- Email Notifications -----
    if (sender === "admin") {
      // Notify USER about admin reply
      sendEmailNotification(process.env.EMAILJS_TEMPLATE_USER, {
        to_email: ticket.email,
        ticket_id: ticket.ticketId,
        message_content: message,
        notification_type: "admin_reply",
        is_admin: false,
      });
    }

    if (sender === "user" && process.env.ADMIN_EMAIL && process.env.EMAILJS_TEMPLATE_ADMIN) {
      // Notify ADMIN about user reply
      sendEmailNotification(process.env.EMAILJS_TEMPLATE_ADMIN, {
        to_email: process.env.ADMIN_EMAIL,
        from_email: ticket.email,
        ticket_id: ticket.ticketId,
        message_content: message,
        notification_type: "user_reply",
        is_admin: true,
      });
    }

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reply" });
  }
};

/* ---------------------------------
   Close Ticket
---------------------------------- */
export const closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      { status: "closed" },
      { new: true, runValidators: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Notify USER that ticket is closed
    sendEmailNotification(process.env.EMAILJS_TEMPLATE_USER, {
      to_email: ticket.email,
      ticket_id: ticket.ticketId,
      message_content: "Your support ticket has been closed. Thank you for using our support!",
      notification_type: "ticket_closed",
      is_admin: false,
    });

    res.status(200).json({
      message: "Ticket closed successfully",
      ticket,
    });
  } catch (err) {
    console.error("Close ticket error:", err);
    res.status(500).json({ error: "Failed to close ticket" });
  }
};

/* ---------------------------------
   Get Ticket by ID + Get All Tickets (unchanged)
---------------------------------- */
export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getAllTickets = async (_req, res) => {
  try {
    const tickets = await Ticket.find()
      .sort({ updatedAt: -1 })
      .select("-messages");
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};
