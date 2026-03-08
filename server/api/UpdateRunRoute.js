const UpdateRunController = require("../controllers/UpdateRunController");
const TeamController = require("../controllers/TeamController");
const accessControl = require("../modules/accessControl");
const verifyToken = require("../modules/verifyToken");

module.exports = (app) => {
  const updateRunController = new UpdateRunController();
  const teamController = new TeamController();

  const checkPermissions = () => {
    return async (req, res, next) => {
      const { team_id } = req.params;
      const teamRole = await teamController.getTeamRole(team_id, req.user.id);

      if (!teamRole) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role } = teamRole;
      const canReadChart = accessControl.can(role).readAny("chart");

      if (!canReadChart.granted) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (["teamOwner", "teamAdmin"].includes(role)) {
        req.user.allowedAuditProjects = null;
        return next();
      }

      req.user.allowedAuditProjects = Array.isArray(teamRole.projects) ? teamRole.projects : [];
      return next();
    };
  };

  app.get("/team/:team_id/update-runs", verifyToken, checkPermissions(), (req, res) => {
    return updateRunController.findByTeam(
      req.params.team_id,
      req.query,
      req.user.allowedAuditProjects
    )
      .then((runs) => {
        return res.status(200).send(runs);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });

  app.get("/team/:team_id/update-runs/:run_id", verifyToken, checkPermissions(), (req, res) => {
    return updateRunController.findByIdAndTeam(
      req.params.run_id,
      req.params.team_id,
      req.user.allowedAuditProjects
    )
      .then((run) => {
        if (!run) {
          return res.status(404).send({ error: "Not Found" });
        }

        return res.status(200).send(run);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });

  return (req, res, next) => {
    next();
  };
};
