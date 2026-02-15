// routes/verifyId.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/verify-id", async (req, res) => {
  const { idNumber } = req.body;

  if (!idNumber) {
    return res.status(400).json({ message: "ID number required" });
  }

  try {
    const response = await fetch(
      `https://api.checkid.co.za/api/v1/validate/${idNumber}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.CHECKID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("CheckID error:", data);
      return res.status(response.status).json({
        message: data.message || "Verification service failed",
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("CheckID API error:", error);
    return res.status(500).json({
      message: "Verification failed",
    });
  }
});


export default router;
