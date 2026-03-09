const UpdateRunController = require("../controllers/UpdateRunController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");

const ALLOWED_AUDIT_ROLES = ["teamOwner", "teamAdmin"];

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

      if (!ALLOWED_AUDIT_ROLES.includes(teamRole.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      return next();
    };
  };

  app.get("/team/:team_id/update-runs", verifyToken, checkPermissions(), (req, res) => {
    return updateRunController.findByTeam(req.params.team_id, req.query)
      .then((runs) => {
        return res.status(200).send(runs);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });

  app.get("/team/:team_id/update-runs/:run_id", verifyToken, checkPermissions(), (req, res) => {
    return updateRunController.findByIdAndTeam(req.params.run_id, req.params.team_id)
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
