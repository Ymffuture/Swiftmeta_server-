import express from "express";
import Contact from "../models/Contact.js";

const router = express.Router();

/* -----------------------------
   POST: Save contact message
------------------------------ */
router.post("/", async (req, res) => {
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
    console.error("Contact POST error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* -----------------------------
   GET: Contact history (names)
------------------------------ */
router.get("/", async (req, res) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name createdAt");

    res.json(contacts);
  } catch (err) {
    console.error("Contact GET error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
