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

  // Get team usage statistics (for billing/analytics)
  app.get("/ai/usage/:teamId", async (req, res) => {
    const { teamId } = req.params;
    const { startDate, endDate, groupBy = "day" } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    try {
      const db = require("../models/models");
      const whereClause = { team_id: parseInt(teamId, 10) };

      // Add date filtering if provided
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt[db.Sequelize.Op.gte] = new Date(startDate);
        if (endDate) whereClause.createdAt[db.Sequelize.Op.lte] = new Date(endDate);
      }

      // Get total usage
      const totalUsage = await db.AiUsage.findAll({
        where: whereClause,
        attributes: [
          [db.Sequelize.fn("SUM", db.Sequelize.col("total_tokens")), "total_tokens"],
          [db.Sequelize.fn("SUM", db.Sequelize.col("prompt_tokens")), "prompt_tokens"],
          [db.Sequelize.fn("SUM", db.Sequelize.col("completion_tokens")), "completion_tokens"],
          [db.Sequelize.fn("SUM", db.Sequelize.col("cost_micros")), "total_cost_micros"],
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "api_calls"],
        ],
        raw: true,
      });

      // Get usage by model
      const usageByModel = await db.AiUsage.findAll({
        where: whereClause,
        attributes: [
          "model",
          [db.Sequelize.fn("SUM", db.Sequelize.col("total_tokens")), "total_tokens"],
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "api_calls"],
        ],
        group: ["model"],
        raw: true,
      });

      return res.json({
        usage: {
          total: totalUsage[0] || {},
          byModel: usageByModel,
        }
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return (req, res, next) => {
    next();
  };
};
