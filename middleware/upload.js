import multer from "multer";

// Memory storage (required for Cloudinary)
const storage = multer.memoryStorage();

// File limits + basic validation (recommended)
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
