const rateLimit = require("express-rate-limit");
const verifyToken = require("../modules/verifyToken");
const creation = require("../modules/chartCreation");
const db = require("../models/models");
const { getWorkspaceOrchestratorPolicy } = require("../modules/workspaceContext/policy");
const { getChartCreationProvider } = require("../modules/ai/orchestrator/orchestrator");

module.exports = (app) => {
  const limit = rateLimit({ windowMs: 60000, max: 20 });
  const handle = (callback) => async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      return res.json(await callback(req));
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : "The chart request could not be completed. Try again.",
      });
    }
  };
  const base = "/project/:project_id/chart-creations";
  app.get(`${base}/options`, verifyToken, handle(async (req) => {
    const { access } = await creation.getAccess(req.params.project_id, req.user.id);
    const connections = access.canConfigureTeam ? await db.Connection.findAll({
      where: { team_id: access.teamId, active: true }, attributes: ["id", "name", "type", "subType", "schema"], order: [["name", "ASC"]],
    }) : [];
    return { connections: connections.map((connection) => ({
      id: connection.id, name: connection.name, type: connection.type, subType: connection.subType,
      icon: connection.schema?.mcp?.server?.icon,
    })), canConfigureSources: access.canConfigureTeam,
      aiEnabled: access.teamAiEnabled && getWorkspaceOrchestratorPolicy().enabled && Boolean(getChartCreationProvider().client) };
  }));
  app.get(`${base}/datasets`, verifyToken, handle(async (req) => {
    const { access } = await creation.getAccess(req.params.project_id, req.user.id);
    return creation.searchDatasets(access, req.params.project_id, String(req.query.q || "").slice(0, 100),
      Math.max(0, Math.min(Number(req.query.offset) || 0, 100000)), { connectionId: req.query.connectionId });
  }));
  app.post(base, verifyToken, limit, handle((req) => creation.run(req.params.project_id, req.user.id, req.body)));
  app.get(`${base}/:request_id`, verifyToken, handle((req) => creation.status(req.params.project_id, req.user.id, req.params.request_id)));
  app.post(`${base}/:request_id/cancel`, verifyToken, handle((req) => creation.cancel(req.params.project_id, req.user.id, req.params.request_id)));
  app.get("/project/:project_id/chart/:chart_id/inline-settings", verifyToken,
    handle((req) => creation.details(req.params.project_id, req.user.id, req.params.chart_id)));
  app.post("/project/:project_id/chart/:chart_id/refinements", verifyToken, limit,
    handle((req) => creation.run(req.params.project_id, req.user.id, req.body, req.params.chart_id)));

  return (req, res, next) => next();
};
