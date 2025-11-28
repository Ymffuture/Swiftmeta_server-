import express from "express";
import multer from "multer";
import cloud from "../config/cloudinary.js";

const router = express.Router();

// Use memory storage to upload directly to Cloudinary
const upload = multer({ storage: multer.memoryStorage() });

router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    // Upload to Cloudinary
    const result = await cloud.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      { folder: "uploads", resource_type: "image" }
    );

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({ message: "Failed to upload image" });
  }
});

export default router;
