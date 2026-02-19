import axios from "axios";

export const getNews = async (req, res, next) => {
  try {
    const { topic = "general", country = "za", max = 10 } = req.query;

    const { data } = await axios.get(
      "https://gnews.io/api/v4/top-headlines",
      {
        params: {
          topic,                 // business, sports, tech, etc.
          country,               // e.g. za
          max,                   // number of articles
          lang: "en",
          apiKey: process.env.GNEWS_API_KEY,
        },
      }
    );

    if (!data?.articles) {
      return res.status(502).json({
        success: false,
        message: "Invalid response from GNews",
      });
    }

    const articles = data.articles.map((article, index) => ({
      id: index,
      title: article.title,
      image: article.image,
      source: article.source?.name,
      date: article.publishedAt,
      url: article.url,
      summary:
        article.description?.slice(0, 180) +
        (article.description?.length > 180 ? "..." : ""),
    }));

    res.status(200).json({
      success: true,
      totalArticles: data.totalArticles,
      articles,
    });

  } catch (error) {
    console.error(
      "GNews Error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch news",
    });
  }
};
