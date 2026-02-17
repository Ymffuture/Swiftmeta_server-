import express from "express";
import { z } from "zod";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import { upload } from "../middleware/upload.js";
import Application from "../models/Application.js";

const router = express.Router();

/* ---------------------------------------------------
   SA ID VALIDATION + GENDER
--------------------------------------------------- */
function isValidSouthAfricanID(id) {
  if (!/^\d{13}$/.test(id)) return false;

  const year = parseInt(id.slice(0, 2), 10);
  const month = parseInt(id.slice(2, 4), 10);
  const day = parseInt(id.slice(4, 6), 10);

  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear ? 2000 + year : 1900 + year;

  const date = new Date(fullYear, month - 1, day);
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return false;

  const citizenship = parseInt(id[10], 10);
  if (![0, 1].includes(citizenship)) return false;

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

const extractGenderFromSAID = (id) =>
  parseInt(id.slice(6, 10), 10) <= 4999 ? "Female" : "Male";

/* ---------------------------------------------------
   CLOUDINARY UPLOADER (RAW FILES)
--------------------------------------------------- */
const uploadToCloudinary = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "raw" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });

/* ---------------------------------------------------
   ZOD BODY SCHEMA (FIXED CONSENT)
--------------------------------------------------- */
const applicationSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  idNumber: z.string().refine(isValidSouthAfricanID, "Invalid SA ID number"),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().min(2),
  qualification: z.string().min(2),
  experience: z.string().min(1),
  currentRole: z.string().optional(),
  portfolio: z.string().optional(),
  consent: z.preprocess(
    (v) => v === "true" || v === true,
    z.boolean().refine((v) => v === true, "Consent is required")
  ),
});

/* ---------------------------------------------------
   APPLY
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
      const body = applicationSchema.parse(req.body);

      // Soft duplicate check (hard check via DB index)
      const duplicateChecks = await Promise.all([
  Application.exists({ email: body.email }),
  Application.exists({ idNumber: body.idNumber }),
  Application.exists({ phone: body.phone }),
]);

const [emailExists, idExists, phoneExists] = duplicateChecks;

if (emailExists || idExists || phoneExists) {
  const duplicates = [];

  if (emailExists) duplicates.push("Email address");
  if (idExists) duplicates.push("ID Number");
  if (phoneExists) duplicates.push("Phone number");

  return res.status(409).json({
    message: `${duplicates.join(", ")} already exists in our system. Please track your application`,
  });
}

      const gender = extractGenderFromSAID(body.idNumber);

      const documents = {};
      const uploadKeys = ["cv", "doc1", "doc2", "doc3", "doc4", "doc5"];

      await Promise.all(
        uploadKeys.map(async (key) => {
          const file = req.files?.[key]?.[0];
          if (!file) return;

          const uploaded = await uploadToCloudinary(file, "applications");
          documents[key] = {
            name: file.originalname,
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
          };
        })
      );

      const application = new Application({
        ...body,
        consent: true,
        gender,
        documents,
      });

      await application.save();

      res.status(201).json({
        message: "Application submitted successfully",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }

      if (err.code === 11000) {
  const field = Object.keys(err.keyValue)[0];

  return res.status(409).json({
    message: `${field} already exists in our system.`,
  });
}
      console.error("APPLICATION ERROR:", err);
      res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

/* ---------------------------------------------------
   LATEST
--------------------------------------------------- */
router.get("/latest", async (_, res) => {
  try {
    const app = await Application.findOne().sort({ createdAt: -1 });
    res.json(app || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------------------------------
   SEARCH
--------------------------------------------------- */
router.get("/search", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ message: "Query required" });
    }

    const app = query.includes("@")
      ? await Application.findOne({ email: query })
      : await Application.findOne({ idNumber: query });

    if (!app) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(app);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------------------------------
   EXISTS (FIXED OR LOGIC)
--------------------------------------------------- */
router.get("/exists", async (req, res) => {
  try {
    const { email, idNumber } = req.query;

    if (!email && !idNumber) {
      return res.status(400).json({ message: "Missing query" });
    }

    const exists = await Application.exists({
      $or: [
        ...(email ? [{ email }] : []),
        ...(idNumber ? [{ idNumber }] : []),
      ],
    });

    res.json({ exists: Boolean(exists) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
