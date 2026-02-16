import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/verify-id", async (req, res) => {
  const { idNumber } = req.body;

  if (!idNumber || typeof idNumber !== "string") {
    return res.status(400).json({
      success: false,
      message: "ID number is required and must be a string",
    });
  }

  const cleanId = idNumber.trim();

  // Optional: quick client-side-like format check (13 digits)
  if (!/^\d{13}$/.test(cleanId)) {
    return res.status(400).json({
      success: false,
      message: "ID number must be exactly 13 digits",
    });
  }

  try {
    const { data, status } = await axios.get(
      `https://api.checkid.co.za/api/v1/validate/${cleanId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHECKID_API_KEY}`,
        },
        timeout: 8000,
      }
    );

    return res.status(status).json({
      success: true,
      valid: data?.valid ?? true, // adjust depending on real response shape
      data,
    });
  } catch (error) {
    console.error("CheckID API Error:", {
      id: cleanId,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    const statusCode = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      (statusCode === 429 ? "Rate limit exceeded – try again later" : "ID verification service failed");

    return res.status(statusCode).json({
      success: false,
      message,
      // Optional: expose error code for frontend if useful
      code: error.response?.data?.code,
    });
  }
});

export default router;
