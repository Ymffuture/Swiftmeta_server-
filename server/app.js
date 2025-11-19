import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import geminiRouter from "./routes/gemini.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/gemini", geminiRouter);

app.listen(5000, () => console.log("Server running on port 5000"));
