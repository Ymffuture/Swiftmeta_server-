import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dest = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: dest,
  filename: (_, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

router.post("/image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
