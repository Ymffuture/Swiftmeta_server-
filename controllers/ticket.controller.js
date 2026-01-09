import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";

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

    res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
};

/* ---------------------------------
   Get Ticket by ID
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
    ticket.status = sender === "admin" ? "open" : "pending"; // Admin reply marks ticket open

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reply" });
  }
};

/* ---------------------------------
   Get All Tickets (Admin)
---------------------------------- */
export const getAllTickets = async (_req, res) => {
  try {
    const tickets = await Ticket.find()
      .sort({ updatedAt: -1 })
      .select("-messages"); // exclude messages for list view

    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

/* ---------------------------------
   Close Ticket
---------------------------------- */
export const closeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.status = "closed";
    await ticket.save();

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to close ticket" });
  }
};
