import express from "express";
import { submitApplication } from "../controllers/application.controller.js";
import upload  from "./uploads.js";

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

export default router;
