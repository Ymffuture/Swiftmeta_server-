import express from "express";
import Contact from "../models/Contact.js";
import { contactRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

/* ----------------------------------
   POST /contact
----------------------------------- */
router.post("/", contactRateLimit, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
    });

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (err) {
    console.error("CONTACT POST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------------------------
   GET /contact?page=1&limit=5
----------------------------------- */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name subject createdAt"),
      Contact.countDocuments(),
    ]);

    res.json({
      data: contacts,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("CONTACT GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
