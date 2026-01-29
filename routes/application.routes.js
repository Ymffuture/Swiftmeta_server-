import express from "express";
import Application from "../models/Application.js";
import { z } from "zod";
import { upload } from "../middleware/upload.js";

const router = express.Router();

/* ---------------------------------------------------
   PURE SA ID VALIDATOR (NO EXPRESS HERE)
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

  const citizenship = parseInt(id[10], 10);
  if (![0, 1].includes(citizenship)) return false;

  // Luhn check
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
   ZOD SCHEMA (BODY ONLY)
--------------------------------------------------- */
const applicationSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  idNumber: z.string().refine(isValidSouthAfricanID, {
    message: "Invalid South African ID",
  }),
  email: z.string().email(),
  location: z.string().min(2),
  qualification: z.string().min(2),
  experience: z.string().min(1),
  currentRole: z.string().optional(),
  portfolio: z.string().optional(),
  phone: z.string().optional(),
  consent: z.literal("true"), // IMPORTANT (multipart sends strings)
});

/* ---------------------------------------------------
   APPLY ROUTE
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
      /* ---------- VALIDATE BODY ---------- */
      const data = applicationSchema.parse(req.body);

      /* ---------- DUPLICATE CHECK ---------- */
      const exists = await Application.findOne({
        $or: [{ email: data.email }, { idNumber: data.idNumber }],
      });

      if (exists) {
        return res.status(409).json({
          message: "Application already exists for this email or ID",
        });
      }

      /* ---------- MAP DOCUMENTS ---------- */
      const mapDoc = (file) =>
        file
          ? {
              name: file.originalname,
              url: file.path,
              publicId: file.filename,
            }
          : undefined;

      const application = new Application({
        ...data,
        consent: true,
        documents: {
          cv: mapDoc(req.files?.cv?.[0]),
          doc1: mapDoc(req.files?.doc1?.[0]),
          doc2: mapDoc(req.files?.doc2?.[0]),
          doc3: mapDoc(req.files?.doc3?.[0]),
          doc4: mapDoc(req.files?.doc4?.[0]),
          doc5: mapDoc(req.files?.doc5?.[0]),
        },
      });

      await application.save();

      res.status(201).json({
        message: "Application submitted successfully",
      });
    } catch (err) {
      /* ---------- ZOD ---------- */
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }

      /* ---------- MONGO DUPLICATE ---------- */
      if (err.code === 11000) {
        return res.status(409).json({
          message: "Duplicate email or ID",
        });
      }

      console.error("APPLICATION ERROR:", err);
      res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

export default router;
