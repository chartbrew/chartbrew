const {
  getOrchestration,
  getAvailableTools,
  getConversations,
  getConversation,
  deleteConversation
} = require("../controllers/AiController");

module.exports = (app) => {
  // Main orchestration endpoint - handles conversation creation/loading automatically
  app.post("/ai/orchestrate", async (req, res) => {
    const {
      question,
      conversationHistory = [],
      aiConversationId,
      teamId,
      userId
    } = req.body;

    if (!teamId || !userId) {
      return res.status(400).json({ error: "teamId and userId are required" });
    }

    try {
      const orchestration = await getOrchestration(
        teamId, question, conversationHistory, aiConversationId, userId
      );
      return res.json({ orchestration });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Get available tools
  app.get("/ai/tools", async (req, res) => {
    try {
      const tools = await getAvailableTools();
      res.json({ tools });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user conversations for a team
  app.get("/ai/conversations", async (req, res) => {
    const {
      teamId, userId, limit = 20, offset = 0
    } = req.query;

    if (!teamId || !userId) {
      return res.status(400).json({ error: "teamId and userId are required" });
    }

    try {
      const conversations = await getConversations(
        teamId, userId, parseInt(limit, 10), parseInt(offset, 10)
      );
      return res.json({ conversations });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Get a specific conversation
  app.get("/ai/conversations/:conversationId", async (req, res) => {
    const { conversationId } = req.params;
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    try {
      const conversation = await getConversation(conversationId, teamId);
      return res.json({ conversation });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Delete a conversation
  app.delete("/ai/conversations/:conversationId", async (req, res) => {
    const { conversationId } = req.params;
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    try {
      const result = await deleteConversation(conversationId, teamId);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return (req, res, next) => {
    next();
  };
};
