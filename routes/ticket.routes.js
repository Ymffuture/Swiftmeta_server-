import express from "express";
import {
  createTicket,
  getTicketById,
  replyToTicket,
  getAllTickets,
  closeTicket,
} from "../controllers/ticket.controller.js";

const router = express.Router();

/* Create */
router.post("/", createTicket);

/* Admin: list all */
router.get("/", getAllTickets);

/* Get single */
router.get("/:id", getTicketById);

/* Reply */
router.post("/:id/reply", replyToTicket);

/* Close */
router.patch("/:ticketId/close", closeTicket);

export default router;
