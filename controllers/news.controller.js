import axios from "axios";

export const getNews = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;

    const { data } = await axios.post(
      "https://eventregistry.org/api/v1/article/getArticles",
      {
        query: {
          $filter: {
            forceMaxDataTimeWindow: "31",
          },
        },
        resultType: "articles",
        articlesSortBy: "date",
        articlesPage: page,
        articlesCount: 10,
        apiKey: process.env.NEWS_API_KEY,
      }
    );

    const articles = data.articles.results.map((article) => ({
      id: article.uri,
      title: article.title,
      image: article.image,
      source: article.source.title,
      date: article.date,
      url: article.url,
      summary: article.body?.slice(0, 180) + "...",
    }));

    res.json({
      success: true,
      page: Number(page),
      totalResults: data.articles.totalResults,
      articles,
    });
  } catch (error) {
    console.error("EventRegistry Error:", error.response?.data || error.message);
    next(error);
  }
};
