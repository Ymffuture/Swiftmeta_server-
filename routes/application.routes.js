import express from "express";
import { submitApplication } from "../controllers/application.controller.js";
import Application from "../models/Application.js";

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
export default router;
