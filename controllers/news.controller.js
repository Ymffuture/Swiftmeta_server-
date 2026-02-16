import axios from "axios";

export const getNews = async (req, res, next) => {
  try {
    const { data } = await axios.post(
      "https://eventregistry.org/api/v1/article/getArticles",
      {
        query: {
          $filter: { forceMaxDataTimeWindow: "31" },
        },
        resultType: "articles",
        articlesSortBy: "date",
        apiKey: process.env.NEWS_API_KEY,
      }
    );

    const results = data?.articles?.results;

    if (!results) {
      console.error("Unexpected API response:", data);

      return res.status(502).json({
        success: false,
        message: "News provider returned invalid data",
      });
    }

    const articles = results.map((article) => ({
      id: article.uri,
      title: article.title,
      image: article.image,
      source: article.source?.title,
      date: article.date,
      url: article.url,
      summary: article.body?.slice(0, 180) + "...",
    }));

    res.json({
      success: true,
      articles,
    });

  } catch (error) {
    console.error(
      "Axios Error:",
      error.response?.data || error.message
    );

    next(error);
  }
};
