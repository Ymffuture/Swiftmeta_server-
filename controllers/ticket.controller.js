import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";
import { sendTicketEmail } from "../utils/sendTicketEmail.js";

/* -----------------------------
   Create Ticket
------------------------------ */
export const createTicket = async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    if (!email || !message) return res.status(400).json({ error: "Email and message required" });

    const ticketId = generateTicketId();

    const ticket = await Ticket.create({
      ticketId,
      email,
      subject: subject || "No subject",
      status: "open",
      lastReplyBy: "user",
      messages: [{ sender: "user", message, createdAt: new Date() }],
    });

    // Send creation email (non-blocking)
    sendTicketEmail({
      to_email: email,
      ticket_id: ticketId,
      subject: ticket.subject,
      message: `Your ticket has been created.\nTicket ID: ${ticketId}`,
    }).catch(console.error);

    return res.status(201).json(ticket);
  } catch (err) {
    console.error("Create ticket error:", err);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
};

/* -----------------------------
   Get Ticket by ID
------------------------------ */
export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    return res.json(ticket);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

/* -----------------------------
   Reply to Ticket
------------------------------ */
export const replyToTicket = async (req, res) => {
  try {
    const { message, sender } = req.body;
    if (!message?.trim() || !sender) return res.status(400).json({ error: "Message and sender required" });
    if (!["user", "admin"].includes(sender)) return res.status(400).json({ error: "Invalid sender" });

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.status === "closed") return res.status(403).json({ error: "Ticket is closed" });

    const now = new Date();
    ticket.messages.push({ sender, message: message.trim(), createdAt: now });
    ticket.lastReplyBy = sender;
    ticket.lastMessageAt = now;

    if (sender === "user") ticket.status = "pending";
    if (sender === "admin") ticket.status = "open";

    await ticket.save();

    if (sender === "admin") {
      sendTicketEmail({
        to_email: ticket.email,
        ticket_id: ticket.ticketId,
        subject: `Re: ${ticket.subject}`,
        message: "An admin has replied to your ticket.",
      }).catch(console.error);
    }

    return res.json(ticket);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to add reply" });
  }
};

/* -----------------------------
   Get All Tickets (Admin)
------------------------------ */
export const getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ lastMessageAt: -1 }).select("-messages");
    return res.json(tickets);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

/* -----------------------------
   Close Ticket
------------------------------ */
export const closeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.status === "closed") return res.json(ticket);

    ticket.status = "closed";
    ticket.lastReplyBy = "admin";
    ticket.closedAt = new Date();
    ticket.messages.push({
      sender: "system",
      message: "Ticket closed by support staff.",
      createdAt: new Date(),
    });

    await ticket.save();

    sendTicketEmail({
      to_email: ticket.email,
      ticket_id: ticket.ticketId,
      subject: `Ticket Closed: ${ticket.subject}`,
      message: "Your ticket has been closed.",
    }).catch(console.error);

    return res.json(ticket);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to close ticket" });
  }
};
