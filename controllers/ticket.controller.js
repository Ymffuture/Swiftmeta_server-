import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";

/* ---------------------------------
   Create Ticket
---------------------------------- */
export const createTicket = async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({
        error: "Email and message are required",
      });
    }

    const ticket = await Ticket.create({
      ticketId: generateTicketId(),
      email,
      subject: subject || "No subject",
      status: "open",
      lastReplyBy: "user",
      messages: [
        {
          sender: "user",
          message,
        },
      ],
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({
      error: "Failed to create ticket",
    });
  }
};

/* ---------------------------------
   Get Ticket by Ticket ID
---------------------------------- */
// GET /api/tickets/:ticketId
export const getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    res.json(ticket);
  } catch (err) {
    console.error("Get ticket error:", err);
    res.status(500).json({
      error: "Server error",
    });
  }
};

/* ---------------------------------
   Reply to Ticket
---------------------------------- */
// POST /api/tickets/:ticketId/reply
export const replyToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, sender } = req.body;

    if (!message || !sender) {
      return res.status(400).json({
        error: "Message and sender are required",
      });
    }

    if (!["user", "admin"].includes(sender)) {
      return res.status(400).json({
        error: "Invalid sender",
      });
    }

    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    // 🚫 HARD RULE: CLOSED MEANS CLOSED
    if (ticket.status === "closed") {
      return res.status(403).json({
        error: "This ticket is closed and cannot receive new replies",
      });
    }

    ticket.messages.push({
      sender,
      message,
    });

    ticket.lastReplyBy = sender;

    // ✅ Status rules
    if (sender === "user") {
      ticket.status = "pending";
    }

    if (sender === "admin") {
      ticket.status = "open";
    }

    await ticket.save();

    res.json(ticket);
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({
      error: "Failed to reply to ticket",
    });
  }
};

/* ---------------------------------
   Get All Tickets (Admin)
---------------------------------- */
// GET /api/tickets
export const getAllTickets = async (_req, res) => {
  try {
    const tickets = await Ticket.find()
      .sort({ updatedAt: -1 })
      .select("-messages");

    res.json(tickets);
  } catch (err) {
    console.error("Get all tickets error:", err);
    res.status(500).json({
      error: "Failed to fetch tickets",
    });
  }
};

/* ---------------------------------
   Update Ticket Status (Admin)
---------------------------------- */
// PUT /api/tickets/:ticketId/close
export const closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["open", "pending", "closed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Allowed: open, pending, closed",
      });
    }

    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    // Idempotent close
    if (ticket.status === status) {
      return res.json({
        message: "Status already set",
        ticket,
      });
    }

    ticket.status = status;
    ticket.lastReplyBy = "system";

    if (status === "closed") {
      ticket.messages.push({
        sender: "system",
        message: "Ticket closed by admin.",
      });
    }

    await ticket.save();

    res.json({
      message: "Ticket status updated successfully",
      ticket,
    });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({
      error: "Failed to update ticket status",
    });
  }
};
