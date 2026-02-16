import axios from "axios";

export const getNews = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;

    // ✅ Your NewsAPI.ai key is correctly placed in the POST body
    const { data } = await axios.post(
      "https://eventregistry.org/api/v1/article/getArticles",
      {
        // Optional: Add a broad keyword or category if you want more targeted results
        // keyword: "technology", // Example: Uncomment for tech news only

        query: {
          $filter: {
            forceMaxDataTimeWindow: 31, // ✅ Number (not string) for last 31 days
          },
        },
        resultType: "articles",
        articlesSortBy: "date", // Latest first
        articlesPage: Number(page),
        articlesCount: 10,
        includeArticleBody: true, // ✅ Ensures full body for summaries
        apiKey: process.env.NEWS_API_KEY, // ✅ Correct placement for POST
      }
    );

    const articles = data.articles.results.map((article) => ({
      id: article.uri,
      title: article.title,
      image: article.image || article.imageUrl, // Fallback for image field
      source: article.source?.title || article.source,
      date: article.date,
      url: article.url,
      summary: article.body
        ? article.body.slice(0, 180) + "..."
        : "No summary available", // ✅ Safe fallback
    }));

    res.json({
      success: true,
      page: Number(page),
      totalResults: data.articles.totalResults || 0,
      articles,
    });
  } catch (error) {
    console.error(
      "NewsAPI.ai Error:",
      error.response?.data || error.message || error
    );

    // Better error response for frontend
    res.status(500).json({
      success: false,
      message: "Failed to fetch news. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
