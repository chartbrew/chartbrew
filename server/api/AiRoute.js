const { getOrchestration } = require("../controllers/AiController");

module.exports = (app) => {
  app.post("/ai/orchestrate", async (req, res) => {
    const { question, conversationHistory = [], teamId } = req.body;
    try {
      const orchestration = await getOrchestration(teamId, question, conversationHistory);
      res.json({ orchestration });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return (req, res, next) => {
    next();
  };
};
