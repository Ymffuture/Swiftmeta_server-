import express from "express";
import {
  createTicket,
  getTicketById,
  replyToTicket,
} from "../controllers/ticket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/:id", getTicketById);
router.post("/:id/reply", replyToTicket);

export default router;
