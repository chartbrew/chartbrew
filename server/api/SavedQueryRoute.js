const SavedQueryController = require("../controllers/SavedQueryController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const savedQueryController = new SavedQueryController();
  const teamController = new TeamController();

  const checkPermissions = (actionType = "readAny") => {
    return async (req, res, next) => {
      const { team_id } = req.params;

      // Fetch the TeamRole for the user
      const teamRole = await teamController.getTeamRole(team_id, req.user.id);

      if (!teamRole) {
        return res.status(403).json({ message: "Access denied" });
      }

      const permission = accessControl.can(teamRole.role)[actionType]("savedQuery");
      if (!permission.granted) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role } = teamRole;

      // Handle permissions for teamOwner and teamAdmin
      if (["teamOwner", "teamAdmin"].includes(role)) {
        req.user.isEditor = true;
      }

      return next();
    };
  };

  /**
   * [MASTER] Route to get all saved queries
   */
  app.get("/savedQuery", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not authorized" });
    }

    let conditions;
    if (req.query.include === "query") {
      conditions = {};
    }

    return savedQueryController.findAll(conditions)
      .then((savedQueries) => {
        return res.status(200).send(savedQueries);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to get all the saved queries in a project
  */
  app.get("/team/:team_id/savedQuery", verifyToken, checkPermissions("readAny"), (req, res) => {
    return savedQueryController.findByTeam(req.params.team_id, req.query.type)
      .then((savedQueries) => {
        return res.status(200).send(savedQueries);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to create a new savedQuery
  */
  app.post("/team/:team_id/savedQuery", verifyToken, checkPermissions("createAny"), (req, res) => {
    const newSavedQuery = req.body;
    newSavedQuery.team_id = req.params.team_id;
    newSavedQuery.user_id = req.user.id;

    return savedQueryController.create(newSavedQuery)
      .then((savedQuery) => {
        return res.status(200).send(savedQuery);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to update a savedQuery
  */
  app.put("/team/:team_id/savedQuery/:id", verifyToken, checkPermissions("updateAny"), (req, res) => {
    const newSavedQuery = req.body;
    newSavedQuery.team_id = req.params.team_id;
    newSavedQuery.user_id = req.user.id;

    return savedQueryController.update(req.params.id, newSavedQuery)
      .then((savedQuery) => {
        return res.status(200).send(savedQuery);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Remove a savedQuery
  */
  app.delete("/team/:team_id/savedQuery/:id", verifyToken, checkPermissions("deleteAny"), (req, res) => {
    return savedQueryController.remove(req.params.id)
      .then((resp) => {
        return res.status(200).send(resp);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
