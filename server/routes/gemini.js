import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

router.post(
  "/",
  async (req, res) => {
    try {
      const { prompt } = req.body;

      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const response = await model.generateContent(prompt);

      const text = response?.response?.text?.();

      if (!text) {
        return res.status(500).json({ error: "AI returned an empty response" });
      }

      res.json({ reply: text });
    } catch (err) {
      console.error("AI Chat Error:", err);
      res.status(500).json({ error: "AI request failed" });
    }
  }
);

export default router;
