import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();

// ✅ Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ store in backend root uploads folder
const dest = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

// ✅ Multer storage config
const storage = multer.diskStorage({
  destination: dest,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  }
});

const upload = multer({ storage });

// ✅ Image upload route
router.post("/image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  } catch {
    res.status(500).json({ message: "Upload server error" });
  }
});

// ✅ Correct export (keep at bottom)
export default router;
