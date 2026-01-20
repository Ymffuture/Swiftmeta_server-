import express from "express";
import Contact from "../models/Contact.js";

const router = express.Router();

/* -----------------------------
   POST /api/contact
   Save a new contact
------------------------------ */
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }

    // Save with default status 'pending'
    const newContact = await Contact.create({ name, email, subject, message });

    res.status(201).json(newContact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

/* -----------------------------
   GET /api/contact
   Fetch contact history with pagination
   ?skip=0&limit=4
------------------------------ */
router.get("/", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 4;

    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});


// routes/contact.js
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "approved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



   // DELETE /api/contact/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Contact.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
