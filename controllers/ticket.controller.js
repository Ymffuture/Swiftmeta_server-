import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";

/* Create Ticket */
export const createTicket = async (req, res) => {
  const { email, subject, message } = req.body;

  const ticket = await Ticket.create({
    ticketId: generateTicketId(),
    email,
    subject,
    messages: [{ sender: "user", message }],
  });

  res.status(201).json(ticket);
};

/* Get Ticket by ID */
export const getTicketById = async (req, res) => {
  const ticket = await Ticket.findOne({ ticketId: req.params.id });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json(ticket);
};

/* Reply to Ticket */
export const replyToTicket = async (req, res) => {
  const { message, sender } = req.body;

  const ticket = await Ticket.findOneAndUpdate(
    { ticketId: req.params.id },
    {
      $push: { messages: { sender, message } },
      status: sender === "admin" ? "pending" : "open",
    },
    { new: true }
  );

  res.json(ticket);
};
