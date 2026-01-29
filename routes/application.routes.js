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

  const fullYear =
    year <= new Date().getFullYear() % 100 ? 2000 + year : 1900 + year;
  const date = new Date(fullYear, month - 1, day);

  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return false;

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
      { folder, resource_type: "raw" }, // 🔥 PDFs/DOCX
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });

/* ---------------------------------------------------
   ZOD BODY SCHEMA
--------------------------------------------------- */
const applicationSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  idNumber: z.string().refine(isValidSouthAfricanID),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().min(2),
  qualification: z.string().min(2),
  experience: z.string().min(1),
  currentRole: z.string().optional(),
  portfolio: z.string().optional(),
  consent: z.literal("true"), // multipart/form-data
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

      // Duplicate protection
      const exists = await Application.findOne({
        $or: [{ email: body.email }, { idNumber: body.idNumber }],
      });
      if (exists)
        return res.status(409).json({
          message: "Application already exists for this ID or email",
        });

      const gender = extractGenderFromSAID(body.idNumber);

      // Upload documents
      const uploadDoc = async (file, folder) =>
        file
          ? await uploadToCloudinary(file, folder)
          : null;

      const docs = {};
      for (const key of ["cv", "doc1", "doc2", "doc3", "doc4", "doc5"]) {
        const file = req.files?.[key]?.[0];
        if (file) {
          const uploaded = await uploadDoc(file, "applications");
          docs[key] = {
            name: file.originalname,
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
          };
        }
      }

      const application = new Application({
        ...body,
        consent: true,
        gender,
        documents: docs,
      });

      await application.save();

      res.status(201).json({ message: "Application submitted successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err.code === 11000) {
        return res.status(409).json({
          message: "Duplicate email, ID or phone number",
        });
      }
      console.error("APPLICATION ERROR:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/* ---------------------------------------------------
   LATEST
--------------------------------------------------- */
router.get("/latest", async (_, res) => {
  const app = await Application.findOne().sort({ createdAt: -1 });
  res.json(app || null);
});

/* ---------------------------------------------------
   SEARCH
--------------------------------------------------- */
router.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ message: "Query required" });

  const app = query.includes("@")
    ? await Application.findOne({ email: query })
    : await Application.findOne({ idNumber: query });

  if (!app) return res.status(404).json({ message: "Not found" });
  res.json(app);
});

export default router;
