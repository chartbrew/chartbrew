const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

const TeamController = require("../controllers/TeamController");
const ChartTemplateController = require("../controllers/ChartTemplateController");

const root = "/team/:team_id/chart-templates";

module.exports = (app) => {
  const teamController = new TeamController();
  const chartTemplateController = new ChartTemplateController();

  const formatError = (error, res) => {
    if (`${error.message}` === "401" || `${error.message}` === "403") {
      return res.status(403).send({ error: "Not authorized" });
    }
    if (`${error.message}` === "404") {
      return res.status(404).send({ error: "Not found" });
    }
    return res.status(400).send({ error: error.message || error });
  };

  const checkAccess = (level = "createOwn") => {
    return async (req, res, next) => {
      try {
        const teamRole = await teamController.getTeamRole(req.params.team_id, req.user.id);
        if (!teamRole) {
          throw new Error("403");
        }

        const permission = accessControl.can(teamRole.role)[level]("project");
        if (!permission.granted
          || (level === "createOwn" && !accessControl.can(teamRole.role).createOwn("dataset").granted)) {
          throw new Error("403");
        }

        req.teamRole = teamRole;
        return next();
      } catch (error) {
        return formatError(error, res);
      }
    };
  };

  app.get(root, verifyToken, checkAccess("readOwn"), (req, res) => {
    try {
      const source = req.query.source;
      return res.status(200).send(chartTemplateController.list(source));
    } catch (error) {
      return formatError(error, res);
    }
  });

  app.get(`${root}/:source/:slug`, verifyToken, checkAccess("readOwn"), (req, res) => {
    try {
      return res.status(200).send(chartTemplateController.get(req.params.source, req.params.slug));
    } catch (error) {
      return formatError(error, res);
    }
  });

  app.post(`${root}/:source/:slug/create`, verifyToken, checkAccess("createOwn"), (req, res) => {
    return chartTemplateController.createFromTemplate(
      req.params.team_id,
      req.params.source,
      req.params.slug,
      req.body,
      req.user
    )
      .then((result) => res.status(200).send(result))
      .catch((error) => formatError(error, res));
  });

  return (req, res, next) => {
    next();
  };
};
