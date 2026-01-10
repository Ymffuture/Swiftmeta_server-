// controllers/ticketController.js
import Ticket from "../models/Ticket.js";
import { generateTicketId } from "../utils/generateTicketId.js";
import { sendTicketEmail } from "../utils/sendTicketEmail.js";

/* ---------------------------------
   Create Ticket
---------------------------------- */
export const createTicket = async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    const ticketId = generateTicketId();

    const ticket = await Ticket.create({
      ticketId,
      email,
      subject: subject || "No subject",
      status: "open",
      lastReplyBy: "user",
      messages: [{ sender: "user", message, createdAt: new Date() }],
    });

    // Send ticket creation email (non-blocking)
    sendTicketEmail({
      to_email: email,
      ticket_id: ticketId,
      subject: ticket.subject,
      message: "Your support ticket has been created successfully.\n\nTicket ID: " + ticketId,
    }).catch((err) => {
      console.error("Creation email failed:", err.message);
    });

    return res.status(201).json(ticket);
  } catch (err) {
    console.error("Create ticket error:", err);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
};

/* ---------------------------------
   Get Ticket by ID (public or authenticated)
---------------------------------- */
export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.json(ticket);
  } catch (err) {
    console.error("Get ticket error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/* ---------------------------------
   Reply to Ticket (user or admin)
---------------------------------- */
export const replyToTicket = async (req, res) => {
  try {
    const { message, sender } = req.body;

    if (!message?.trim() || !sender) {
      return res.status(400).json({ error: "Message and sender are required" });
    }

    if (!["user", "admin"].includes(sender)) {
      return res.status(400).json({ error: "Sender must be 'user' or 'admin'" });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.status === "closed") {
      return res.status(403).json({ 
        error: "This ticket has been closed. You cannot add new replies." 
      });
    }

    // Add the new reply
    ticket.messages.push({
      sender,
      message: message.trim(),
      createdAt: new Date(),
    });

    ticket.lastReplyBy = sender;

    // ─── Status logic (most common pattern in 2024-2026 support systems) ───
    if (sender === "user") {
      ticket.status = "pending"; // User replied → waiting for admin
    }
    // When admin replies → usually we just keep "open" (or "in-progress" if you have that status)
    // We don't force it unless you specifically want to

    // Optional: more explicit version (uncomment if preferred)
    // else if (sender === "admin" && ticket.status !== "closed") {
    //   ticket.status = "open";
    // }

    // Notify user only when admin replies
    if (sender === "admin") {
      sendTicketEmail({
        to_email: ticket.email,
        ticket_id: ticket.ticketId,
        subject: `Re: ${ticket.subject}`,
        message: "An admin has replied to your ticket. Please check your ticket for details.",
      }).catch((err) => console.error("Reply notification email failed:", err.message));
    }

    await ticket.save();

    return res.json(ticket);
  } catch (err) {
    console.error("Reply error:", err);
    return res.status(500).json({ error: "Failed to add reply" });
  }
};

/* ---------------------------------
   Get All Tickets (Admin only - recommend adding auth middleware)
---------------------------------- */
export const getAllTickets = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const tickets = await Ticket.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select("-messages"); // exclude heavy messages array in list view

    const total = await Ticket.countDocuments(query);

    return res.json({
      tickets,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (err) {
    console.error("Get all tickets error:", err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

/* ---------------------------------
   Close Ticket (usually admin only)
---------------------------------- */
export const closeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.status === "closed") {
      return res.json(ticket); // idempotent - already closed
    }

    ticket.status = "closed";
    ticket.lastReplyBy = "admin"; // most systems mark closing as admin action

    // Optional: add a system message
    ticket.messages.push({
      sender: "system",
      message: "Ticket has been closed by support staff.",
      createdAt: new Date(),
    });

    await ticket.save();

    // Optional: notify user that ticket is closed
    sendTicketEmail({
      to_email: ticket.email,
      ticket_id: ticket.ticketId,
      subject: `Ticket Closed: ${ticket.subject}`,
      message: "Your ticket has been closed. Thank you for using our support system!",
    }).catch((err) => console.error("Close notification failed:", err.message));

    return res.json(ticket);
  } catch (err) {
    console.error("Close ticket error:", err);
    return res.status(500).json({ error: "Failed to close ticket" });
  }
};
