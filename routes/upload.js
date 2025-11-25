import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
const router = express.Router();

// store in /uploads
const dest = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(dest)) fs.mkdirSync(dest);

const storage = multer.diskStorage({
  destination: dest,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  }
});

const upload = multer({ storage });

router.post("/image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;

