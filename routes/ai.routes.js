import express from "express";
import { analyzeTicket } from "../controllers/ai.controller.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
});

router.post("/analyze", aiLimiter, analyzeTicket);

export default router;
