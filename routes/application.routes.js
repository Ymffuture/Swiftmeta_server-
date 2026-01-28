import express from "express";
import { submitApplication } from "../controllers/application.controller.js";
import Application from "../models/Application.js";
import { z } from "zod";
import { upload } from "../middleware/upload.js";

const router = express.Router();

/* ---------------------------------------------------
   ZOD SCHEMA FOR APPLICATION VALIDATION
--------------------------------------------------- */
const applicationSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  idNumber: z.string().min(13).max(13).refine(isValidSouthAfricanID, {
    message: "Invalid South African ID number",
  }),
  email: z.string().email("Invalid email address"),
  location: z.string().min(2, "Location is required"),
  qualification: z.string().min(2, "Qualification is required"),
  experience: z.string().min(1, "Experience is required"),
  currentRole: z.string().optional(),
  portfolio: z.string().optional(),
});

/* ---------------------------------------------------
   SOUTH AFRICAN ID VALIDATION FUNCTION
--------------------------------------------------- */
function isValidSouthAfricanID(id) {
  if (!/^\d{13}$/.test(id)) return false;

  const year = parseInt(id.slice(0, 2), 10);
  const month = parseInt(id.slice(2, 4), 10);
  const day = parseInt(id.slice(4, 6), 10);
  const fullYear =
    year <= new Date().getFullYear() % 100 ? 2000 + year : 1900 + year;
  const date = new Date(fullYear, month - 1, day);

  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }
   
if (consent !== true) {
  return res.status(400).json({
    message: "Consent is required to process personal information",
  });
}
  // Citizenship digit (0 or 1)
  const citizenship = parseInt(id[10], 10);
  if (![0, 1].includes(citizenship)) return false;

  // Luhn checksum
  let sum = 0;
  let alternate = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/* ---------------------------------------------------
   SUBMIT APPLICATION ROUTE
--------------------------------------------------- */
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
  async (req, res) => {
    try {
      // Validate request body using Zod
      const parsed = applicationSchema.parse(req.body);

      // Check for duplicate email or ID
      const existing = await Application.findOne({
        $or: [{ email: parsed.email }, { idNumber: parsed.idNumber }],
      });

      if (existing) {
        return res.status(400).json({
          error:
            "You have already applied. Each ID and email can only be used once.",
        });
      }

      // Create new application
      const applicationData = {
        ...parsed,
        cv: req.files?.cv?.[0]?.path || "",
        doc1: req.files?.doc1?.[0]?.path || "",
        doc2: req.files?.doc2?.[0]?.path || "",
        doc3: req.files?.doc3?.[0]?.path || "",
        doc4: req.files?.doc4?.[0]?.path || "",
        doc5: req.files?.doc5?.[0]?.path || "",
      };

      const newApplication = new Application(applicationData);
      await newApplication.save();

      res.json({ message: "Application submitted successfully!" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0].message });
      }

      if (err.code === 11000) {
        return res.status(400).json({
          error:
            "Duplicate entry detected. Each email and ID must be unique.",
        });
      }

      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/* ---------------------------------------------------
   GET LATEST APPLICATION
--------------------------------------------------- */
router.get("/latest", async (req, res) => {
  try {
    const application = await Application.findOne().sort({ createdAt: -1 });
    if (!application) return res.status(404).json(null);
    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch application" });
  }
});

/* ---------------------------------------------------
   SEARCH APPLICATION BY EMAIL OR ID
--------------------------------------------------- */
const searchSchema = z.object({
  query: z
    .string()
    .min(3, "Query must be at least 3 characters")
    .max(100),
});

router.get("/search", async (req, res) => {
  try {
    const parsed = searchSchema.parse({ query: req.query.query });
    const { query } = parsed;

    let application;

    if (query.includes("@")) {
      // Search by email
      application = await Application.findOne({ email: query }).lean();
    } else if (/^\d{6,13}$/.test(query)) {
      // Search by ID
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
