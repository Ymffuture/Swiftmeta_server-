import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (lat === undefined || lon === undefined) {
  return res.status(400).json({
    message: "Latitude and Longitude are required",
  });
}
console.log("Query params:", req.query);
    const response = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          lat,
          lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: "metric",
        },
      }
    );

    const data = response.data;

    const cleanWeather = {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      city: data.name,
      country: data.sys.country,
      desc: data.weather[0].description,
      icon: data.weather[0].icon,
    };

    res.json(cleanWeather);

  } catch (error) {
  if (error.response) {
    return res.status(error.response.status).json({
      message: error.response.data.message || "Weather API error",
    });
  }

  res.status(500).json({ message: "Server error" });
}
});

export default router;
