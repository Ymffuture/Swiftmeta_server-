import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import geminiRouter from "./routes/gemini.js";


const app = express();
app.use(cors({
    origin: "https://swiftmeta.vercel.app",   // your frontend domain
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,  // if you send cookies / tokens
  })
);
app.use(express.json());

app.use("/api/gemini", geminiRouter);

app.listen(5000, () => console.log("Server running on port 5000"));
