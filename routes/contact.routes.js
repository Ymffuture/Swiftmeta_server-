import express from "express";
import Contact from "../models/Contact.js";
import { contactRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

/* ----------------------------------
   POST /contact
----------------------------------- */
router.post("/", contactRateLimit, async (req, res) => {
  try {
    const { name, email, subject = "", message } = req.body;

    // Strong validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required",
      });
    }

    if (message.length < 10 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must be between 10 and 2000 characters",
      });
    }

    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    res.status(201).json({
      success: true,
      data: {
        id: contact._id,
        name: contact.name,
      },
    });
  } catch (err) {
    console.error("CONTACT POST ERROR:", err);

    // Mongoose validation error
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(err.errors)[0].message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ----------------------------------
   GET /contact?page=1&limit=5
----------------------------------- */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name subject createdAt status"),
      Contact.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error("CONTACT GET ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
