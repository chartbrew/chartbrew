const integrationController = require("../controllers/IntegrationController");
const TeamController = require("../controllers/TeamController");
const accessControl = require("../modules/accessControl");
const verifyToken = require("../modules/verifyToken");

module.exports = (app) => {
  const teamController = new TeamController();

  const checkAccess = (team_id, integration_id, user, teamAccess, integrationAccess) => {
    return teamController.getTeamRole(team_id, user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role)[teamAccess]("team");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        if (integration_id) {
          const integrationPermission = accessControl.can(teamRole.role)[integrationAccess]("integration");
          if (!integrationPermission.granted) {
            return new Promise((resolve, reject) => reject(new Error(401)));
          }
        }

        return teamRole;
      });
  };
  // ----------------------------------------------

  /*
  ** Get an integration by id
  */
  app.get("/team/:team_id/integration/:id", verifyToken, (req, res) => {
    return checkAccess(req.params.team_id, req.params.id, req.user, "readOwn", "readAny")
      .then(() => {
        return integrationController.findById(req.params.id);
      })
      .then((integration) => {
        return res.status(200).send(integration);
      })
      .catch((err) => {
        if (err.message === "401") {
          return res.status(401).send("Unauthorized");
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------

  /*
  ** Get all integrations for a team
  */
  app.get("/team/:team_id/integration", verifyToken, (req, res) => {
    return checkAccess(req.params.team_id, null, req.user, "readOwn", "readAny")
      .then(() => {
        return integrationController.findByTeam(req.params.team_id);
      })
      .then((integrations) => {
        return res.status(200).send(integrations);
      })
      .catch((err) => {
        if (err.message === "401") {
          return res.status(401).send("Unauthorized");
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------

  /*
  ** Create an integration
  */
  app.post("/team/:team_id/integration", verifyToken, (req, res) => {
    if (!req.body.team_id || `${req.body.team_id}` !== `${req.params.team_id}`) {
      return res.status(400).send("Invalid team id");
    }

    return checkAccess(req.params.team_id, null, req.user, "readOwn", "createAny")
      .then(() => {
        return integrationController.create(req.body);
      })
      .then((integration) => {
        return res.status(200).send(integration);
      })
      .catch((err) => {
        if (err.message === "401") {
          return res.status(401).send("Unauthorized");
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------

  /*
  ** Update an integration
  */
  app.put("/team/:team_id/integration/:id", verifyToken, (req, res) => {
    return checkAccess(req.params.team_id, req.params.id, req.user, "readOwn", "updateAny")
      .then(() => {
        return integrationController.update(req.params.id, req.body);
      })
      .then((integration) => {
        return res.status(200).send(integration);
      })
      .catch((err) => {
        if (err.message === "401") {
          return res.status(401).send("Unauthorized");
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------

  /*
  ** Delete an integration
  */
  app.delete("/team/:team_id/integration/:id", verifyToken, (req, res) => {
    return checkAccess(req.params.team_id, req.params.id, req.user, "readOwn", "deleteAny")
      .then(() => {
        return integrationController.remove(req.params.id);
      })
      .then(() => {
        return res.status(200).send("Integration deleted");
      })
      .catch((err) => {
        if (err.message === "401") {
          return res.status(401).send("Unauthorized");
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------

  return (req, res, next) => {
    next();
  };
};
