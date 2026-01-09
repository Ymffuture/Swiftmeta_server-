import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";

/* ---------------------------------
   Create Ticket
---------------------------------- */
export const createTicket = async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are required" });
  }

  const ticket = await Ticket.create({
    ticketId: generateTicketId(),
    email,
    subject,
    status: "open",
    lastReplyBy: "user",
    messages: [{ sender: "user", message }],
  });

  res.status(201).json(ticket);
};

/* ---------------------------------
   Get Ticket by ID
---------------------------------- */
export const getTicketById = async (req, res) => {
  const ticket = await Ticket.findOne({
    ticketId: req.params.id,
  });

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  res.json(ticket);
};

/* ---------------------------------
   Reply to Ticket
---------------------------------- */
export const replyToTicket = async (req, res) => {
  const { message, sender } = req.body;

  if (!message || !sender) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const ticket = await Ticket.findOneAndUpdate(
    { ticketId: req.params.id },
    {
      $push: { messages: { sender, message } },
      lastReplyBy: sender,
      status: sender === "admin" ? "open" : "pending",
    },
    { new: true }
  );

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  res.json(ticket);
};

/* ---------------------------------
   NEW: Get All Tickets (Admin)
---------------------------------- */
export const getAllTickets = async (_req, res) => {
  const tickets = await Ticket.find()
    .sort({ updatedAt: -1 })
    .select("-messages"); // faster list view

  res.json(tickets);
};

/* ---------------------------------
   NEW: Close Ticket
---------------------------------- */
export const closeTicket = async (req, res) => {
  const ticket = await Ticket.findOneAndUpdate(
    { ticketId: req.params.id },
    { status: "closed" },
    { new: true }
  );

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  res.json(ticket);
};
