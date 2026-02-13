// routes/verifyId.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/verify-id", async (req, res) => {
  const { idNumber } = req.body;

  if (!idNumber) {
    return res.status(400).json({ error: "ID number required" });
  }

  try {
    const response = await fetch(
      `https://api.checkid.co.za/api/v1/validate/${idNumber}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHECKID_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("CheckID API error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
