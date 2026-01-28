import express from "express";
import { submitApplication } from "../controllers/application.controller.js";
import Application from "../models/Application.js";
import { z } from "zod";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post(
  "/apply",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "doc1", maxCount: 1 },
    { name: "doc2", maxCount: 1 },
    { name: "doc3", maxCount: 1 },
    { name: "doc4", maxCount: 1 },
    { name: "doc5", maxCount: 1 },
  ]),
  submitApplication
);

router.get("/latest", async (req, res) => {
  try {
    const application = await Application.findOne().sort({ createdAt: -1 });

    if (!application) {
      return res.status(404).json(null);
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch application" });
  }
});


// Zod schema for query validation
const searchSchema = z.object({
  query: z
    .string()
    .min(3, "Query must be at least 3 characters")
    .max(100)
});

// GET /application/search?query=<id-or-email>
router.get("/search", async (req, res) => {
  try {
    const parsed = searchSchema.parse({ query: req.query.query });
    const { query } = parsed;

    let application;

    if (query.includes("@")) {
      // Search by email
      application = await Application.findOne({ email: query }).lean();
    } else if (/^\d{6,13}$/.test(query)) {
      // Search by SA ID number (6–13 digits)
      application = await Application.findOne({ idNumber: query }).lean();
    } else {
      return res.status(400).json({ error: "Invalid search query" });
    }

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(application);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
