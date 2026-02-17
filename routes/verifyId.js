import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/verify-id", async (req, res, next) => {
  const { idNumber } = req.body;

  if (!idNumber) {
    return res.status(400).json({
      success: false,
      message: "ID number required",
    });
  }

  try {
    const { data } = await axios.get(
      `https://api.checkid.co.za/api/v1/validate/${idNumber}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHECKID_API_KEY}`,
        },
        timeout: 8000, // prevent hanging requests
      }
    );

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {
    console.error(
      "CheckID API Error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      message:
        error.response?.data?.message ||
        "Verification service failed",
    });
  }
});

export default router;
