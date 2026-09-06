const rateLimit = require("express-rate-limit");

const db = require("../models/models");
const connectionSetup = require("../modules/ai/connectionSetup");
const memory = require("../modules/ai/memory");
const {
  getOrchestration,
  placeChartPreview,
  respond,
  promoteSession,
  getAvailableTools,
  getContextOptions,
  getConversations,
  getConversation,
  deleteConversation,
  getAiUsage
} = require("../controllers/AiController");
const verifyToken = require("../modules/verifyToken");
const TeamController = require("../controllers/TeamController");
const {
  routeWorkspaceRequest,
} = require("../modules/ai/orchestrator/runtime/deterministicRouter");
const { getRoleBoundaryMessage } = require("../modules/ai/orchestrator/rolePolicy");
const {
  TEAM_AI_DISABLED_MESSAGE,
  getWorkspaceOrchestratorPolicy,
} = require("../modules/workspaceContext/policy");

const apiLimiter = (max = 10) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max,
  });
};

function sendAiError(res, error) {
  const statusCode = Number(error?.statusCode);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ error: error.message });
  }
  return res.status(500).json({
    error: "Chartbrew could not complete this request. Try again.",
  });
}

const checkAccess = async (req, res, next) => {
  try {
    const teamId = req.params?.teamId || req.body?.teamId || req.query?.teamId;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    const teamController = new TeamController();
    const [teamRole, team] = await Promise.all([
      teamController.getTeamRole(teamId, req.user.id),
      db.Team.findByPk(teamId, { attributes: ["aiEnabled"] }),
    ]);

    if (!teamRole?.role || !team) {
      return res.status(403).json({ error: "Access denied" });
    }

    req.aiTeamRole = teamRole;
    req.aiTeamEnabled = team.aiEnabled !== false;
    return next();
  } catch (_error) {
    return res.status(500).json({
      error: "Chartbrew could not check workspace access. Try again.",
    });
  }
};

const requireTeamAiEnabled = (req, res, next) => {
  if (!req.aiTeamEnabled) {
    return res.status(403).json({ error: TEAM_AI_DISABLED_MESSAGE });
  }
  return next();
};

const checkAdminAccess = (req, res, next) => {
  if (!["teamOwner", "teamAdmin"].includes(req.aiTeamRole?.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  return next();
};

const isOpenAiApiKeySet = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.CB_OPENAI_API_KEY;
  } else {
    return process.env.CB_OPENAI_API_KEY_DEV;
  }
};

module.exports = (app) => {
  app.get("/ai/availability", apiLimiter(20), verifyToken, checkAccess, (req, res) => {
    const platformEnabled = getWorkspaceOrchestratorPolicy().enabled;
    const enabled = platformEnabled && req.aiTeamEnabled;
    let disabledBy = null;
    if (!enabled) disabledBy = platformEnabled ? "team" : "platform";
    return res.json({
      disabledBy,
      enabled,
    });
  });

  app.post("/ai/respond", apiLimiter(3), verifyToken, checkAccess, requireTeamAiEnabled, async (req, res) => {
    const {
      action,
      aiConversationId,
      context,
      message,
      persistence,
      sessionId,
      teamId,
    } = req.body;

    if (!teamId || !req.user.id) {
      return res.status(400).json({ error: "teamId and user ID are required" });
    }
    const localRoute = routeWorkspaceRequest({ action, message });
    const canUseLocalWorkspaceRoute = memory.isRememberCommand(message)
      || ["executor", "fast_path"].includes(localRoute?.mode)
      || localRoute?.intent === "workspace_follow_up"
      || Boolean(getRoleBoundaryMessage(req.aiTeamRole.role, message));
    if (getWorkspaceOrchestratorPolicy().enabled
      && !action
      && !canUseLocalWorkspaceRoute
      && !isOpenAiApiKeySet()) {
      return res.status(400).json({ error: "Ask your data is not configured for this workspace" });
    }

    try {
      const orchestration = await respond({
        action,
        aiConversationId,
        context,
        message,
        persistence,
        sessionId,
        teamId,
        userId: req.user.id,
      });
      return res.json({ orchestration });
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  app.post("/ai/chart-previews/place", apiLimiter(20), verifyToken, checkAccess, async (req, res) => {
    const {
      action, aiConversationId, persistence, sessionId, teamId,
    } = req.body;
    try {
      const chartPreview = await placeChartPreview({
        action,
        aiConversationId,
        persistence,
        sessionId,
        teamId,
        userId: req.user.id,
      });
      return res.json({ chartPreview });
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  app.route("/ai/connections/setup")
    .all(apiLimiter(20), verifyToken, checkAccess)
    .get(async (req, res) => {
      try {
        const option = await connectionSetup({
          teamId: req.query.teamId, conversationId: req.query.conversationId,
          providerId: req.query.providerId, userId: req.user.id,
        });
        return res.json(option);
      } catch (error) { return sendAiError(res, error); }
    })
    .post(async (req, res) => {
      try {
        const option = await connectionSetup({
          teamId: req.body.teamId, conversationId: req.body.conversationId,
          providerId: req.body.providerId, userId: req.user.id, create: true,
        });
        return res.json(option);
      } catch (error) { return sendAiError(res, error); }
    });

  app.post(
    "/ai/sessions/:sessionId/promote",
    apiLimiter(5),
    verifyToken,
    checkAccess,
    async (req, res) => {
      try {
        const result = await promoteSession({
          sessionId: req.params.sessionId,
          teamId: req.body.teamId,
          userId: req.user.id,
        });
        return res.json(result);
      } catch (error) {
        return sendAiError(res, error);
      }
    },
  );

  // Main orchestration endpoint - handles conversation creation/loading automatically
  app.post("/ai/orchestrate", apiLimiter(3), verifyToken, checkAccess, requireTeamAiEnabled, async (req, res) => {
    const {
      question,
      conversationHistory = [],
      aiConversationId,
      teamId,
      context
    } = req.body;

    if (!teamId || !req.user.id) {
      return res.status(400).json({ error: "teamId and user ID are required" });
    }

    const localRoute = routeWorkspaceRequest({ message: question });
    const canUseLocalWorkspaceRoute = memory.isRememberCommand(question)
      || localRoute?.mode === "fast_path"
      || localRoute?.intent === "workspace_follow_up"
      || Boolean(getRoleBoundaryMessage(req.aiTeamRole.role, question));
    if (getWorkspaceOrchestratorPolicy().enabled
      && !canUseLocalWorkspaceRoute
      && !isOpenAiApiKeySet()) {
      return res.status(400).json({ error: "Ask your data is not configured for this workspace" });
    }

    try {
      const orchestration = await getOrchestration(
        teamId, question, conversationHistory, aiConversationId, req.user.id, context
      );
      return res.json({ orchestration });
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  app.route("/ai/memory")
    .all(apiLimiter(60), verifyToken, checkAccess)
    .get(async (req, res) => {
      try {
        return res.json({
          memories: await memory.listMemories(req.query.teamId, req.user.id),
          sharingEnabled: req.aiTeamEnabled && getWorkspaceOrchestratorPolicy().enabled
            && getWorkspaceOrchestratorPolicy().externalLearningContextEnabled,
        });
      } catch (error) { return sendAiError(res, error); }
    })
    .post(async (req, res) => {
      try {
        const result = await memory.changeMemory({ teamId: req.body.teamId, userId: req.user.id, text: req.body.text });
        return res.status(201).json({ memory: result });
      } catch (error) { return sendAiError(res, error); }
    })
    .delete(async (req, res) => {
      try {
        await memory.changeMemory({ teamId: req.query.teamId, userId: req.user.id, remove: true });
        return res.json({ success: true });
      } catch (error) { return sendAiError(res, error); }
    });
  app.route("/ai/memory/:memoryId")
    .all(apiLimiter(60), verifyToken, checkAccess)
    .patch(async (req, res) => {
      try {
        const result = await memory.changeMemory({ teamId: req.body.teamId, userId: req.user.id, id: req.params.memoryId, text: req.body.text });
        return res.json({ memory: result });
      } catch (error) { return sendAiError(res, error); }
    })
    .delete(async (req, res) => {
      try {
        await memory.changeMemory({ teamId: req.query.teamId, userId: req.user.id, id: req.params.memoryId, remove: true });
        return res.json({ success: true });
      } catch (error) { return sendAiError(res, error); }
    });

  // Get available tools
  app.get("/ai/tools", apiLimiter(10), verifyToken, checkAccess, checkAdminAccess, async (req, res) => {
    try {
      const tools = await getAvailableTools();
      res.json({ tools });
    } catch (error) {
      sendAiError(res, error);
    }
  });

  app.get("/ai/context", apiLimiter(20), verifyToken, checkAccess, async (req, res) => {
    try {
      const context = await getContextOptions(req.query.teamId, req.user.id, {
        limit: req.query.limit,
        query: req.query.query,
        type: req.query.type,
      });
      return res.json({ context });
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  // Get user conversations for a team
  app.get("/ai/conversations", apiLimiter(10), verifyToken, checkAccess, async (req, res) => {
    const {
      teamId, limit = 20, offset = 0
    } = req.query;

    if (!teamId || !req.user.id) {
      return res.status(400).json({ error: "teamId and userId are required" });
    }

    try {
      const conversations = await getConversations(
        teamId, req.user.id, parseInt(limit, 10), parseInt(offset, 10)
      );
      return res.json({ conversations });
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  // Get a specific conversation
  app.get("/ai/conversations/:conversationId", apiLimiter(20), verifyToken, checkAccess, async (req, res) => {
    const { conversationId } = req.params;
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    try {
      const conversation = await getConversation(conversationId, teamId, req.user.id);
      return res.json({ conversation });
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  // Delete a conversation
  app.delete("/ai/conversations/:conversationId", apiLimiter(10), verifyToken, checkAccess, async (req, res) => {
    const { conversationId } = req.params;
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    try {
      const result = await deleteConversation(conversationId, teamId, req.user.id);
      return res.json(result);
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  // Get team usage statistics (for billing/analytics)
  app.get("/ai/usage/:teamId", apiLimiter(20), verifyToken, checkAccess, checkAdminAccess, async (req, res) => {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    try {
      const usage = await getAiUsage(teamId, startDate, endDate);
      return res.json(usage);
    } catch (error) {
      return sendAiError(res, error);
    }
  });

  return (req, res, next) => {
    next();
  };
};
