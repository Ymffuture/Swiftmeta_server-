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
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // 🚫 HARD RULE: Closed tickets never auto-reopen
    if (ticket.status === "closed") {
      return res.status(403).json({
        error: "This ticket is closed and cannot receive new replies",
      });
    }

    ticket.messages.push({ sender, message });
    ticket.lastReplyBy = sender;

    // ✅ SAFE status logic
    if (sender === "user") {
      ticket.status = "pending";
    } else if (sender === "admin") {
      ticket.status = "open";
    }

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    console.error("Reply error:", err);
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

/* ---------------------------------
   Update Ticket Status (Admin)
---------------------------------- */
// PUT /api/tickets/:ticketId/status
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

    // Build update object safely
    const update = {
      status,
      lastReplyBy: "system",
    };

    // Add system message only when closing
    if (status === "closed") {
      update.$push = {
        messages: {
          sender: "system",
          message: "Ticket closed by admin.",
        },
      };
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      update,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      message: "Ticket status updated successfully",
      ticket,
    });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({
      error: "Failed to update ticket status",
    });
  }
};

