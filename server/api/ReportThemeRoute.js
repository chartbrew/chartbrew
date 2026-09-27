const db = require("../models/models");
const verifyToken = require("../modules/verifyToken");
const { createPreset, changePreset } = require("../modules/reportAppearance");

module.exports = (app) => {
  const base = "/team/:team_id/report-theme-presets";
  const authorize = async (req, res, next) => {
    try {
      const role = await db.TeamRole.findOne({ where: { team_id: req.params.team_id, user_id: req.user.id } });
      const admin = ["teamOwner", "teamAdmin"].includes(role?.role);
      const editor = ["projectAdmin", "projectEditor"].includes(role?.role)
        && role.projects?.length > 0
        && await db.Project.count({ where: { team_id: req.params.team_id, id: role.projects } });
      if (!admin && !editor) return res.status(403).json({ message: "Access denied" });
      if (req.params.id) {
        const preset = await db.ReportThemePreset.findOne({ where: { id: req.params.id, team_id: req.params.team_id } });
        if (!preset) return res.status(404).json({ message: "Preset not found" });
        if (!admin && preset.created_by !== req.user.id) return res.status(403).json({ message: "Access denied" });
        req.reportThemePreset = preset;
      }
      return next();
    } catch {
      return res.status(500).json({ message: "Presets could not be loaded. Try again." });
    }
  };
  const respond = (action) => async (req, res) => {
    try {
      return res.json(await action(req));
    } catch (error) {
      return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "The preset could not be saved. Try again." });
    }
  };
  app.get(base, verifyToken, authorize, respond((req) => db.ReportThemePreset.findAll({
    where: { team_id: req.params.team_id }, order: [["name", "ASC"], ["id", "ASC"]],
  })));
  app.post(base, verifyToken, authorize, respond((req) => createPreset(req.params.team_id, req.user.id, req.body)));
  app.put(`${base}/:id`, verifyToken, authorize, respond((req) => changePreset(req.reportThemePreset, req.body)));
  app.delete(`${base}/:id`, verifyToken, authorize, respond((req) => changePreset(req.reportThemePreset, req.body, true)));

  return (req, res, next) => {
    next();
  };
};
