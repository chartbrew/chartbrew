const _ = require("lodash");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const TeamController = require("../controllers/TeamController");
const UserController = require("../controllers/UserController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

const apiLimiter = (max = 10) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max,
  });
};

function filterProjects(projects, teamRole) {
  return projects.filter((p) => _.indexOf(teamRole.projects, p.id) > -1);
}

module.exports = (app) => {
  const teamController = new TeamController();
  const userController = new UserController();

  const checkPermissions = (actionType = "readOwn", entity = "team") => {
    return async (req, res, next) => {
      const { id } = req.params;

      // Fetch the TeamRole for the user
      const teamRole = await teamController.getTeamRole(id, req.user.id);

      if (!teamRole) {
        return res.status(403).json({ message: "Access denied" });
      }

      const permission = accessControl.can(teamRole.role)[actionType](entity);
      if (!permission.granted) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role } = teamRole;

      // Handle permissions for teamOwner and teamAdmin
      if (["teamOwner", "teamAdmin"].includes(role)) {
        req.user.isEditor = true;
        return next();
      }

      if (role === "projectAdmin" || role === "projectViewer" || role === "projectEditor") {
        // const connections = await connectionController.findByProjects(projects);
        // if (!connections || connections.length === 0) {
        //   return res.status(404).json({ message: "No connections found" });
        // }

        return next();
      }

      return res.status(403).json({ message: "Access denied" });
    };
  };

  /**
   * Get all teams based on the authentication token
   */
  app.get("/team", verifyToken, (req, res) => {
    return teamController.getUserTeams(req.user.id)
      .then((teams) => {
        return res.status(200).send(teams);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to get a team by its id
  app.get("/team/:id", verifyToken, checkPermissions(), (req, res) => {
    return teamController.findById(req.params.id)
      .then((team) => {
        const modTeam = team;
        if (team.Projects) modTeam.setDataValue("Projects", filterProjects(team.Projects, req.user));
        return res.status(200).send(modTeam);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        if (error === "404") return res.status(404).send({ error: "The team is not found" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to create a team
  app.post("/team", verifyToken, apiLimiter(10), async (req, res) => {
    if (app.settings.teamRestricted === "1") {
      return res.status(400).send({ error: "Team restricted" });
    }

    try {
      const team = await teamController.createTeam(req.body, req.user.id);
      return res.status(200).send(team);
    } catch (error) {
      return res.status(400).send({ error: "Error creating team" });
    }
  });
  // --------------------------------------

  // route to delete a team
  app.delete("/team/:id", verifyToken, checkPermissions("deleteOwn", "team"), (req, res) => {
    return teamController.deleteTeam(req.params.id, req.user.id)
      .then(() => {
        return res.status(200).send({ deleted: true });
      })
      .catch((error) => {
        if (error?.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send({ error: error?.message || "Error deleting team" });
      });
  });
  // --------------------------------------

  // route to update a team
  app.put("/team/:id", verifyToken, (req, res) => {
    if (!req.params || !req.body) return res.status(400).send("Missing fields");
    let gTeamRole;
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        gTeamRole = teamRole;
        const permission = accessControl.can(teamRole.role).updateOwn("team");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.update(req.params.id, req.body);
      })
      .then((team) => {
        const modTeam = team;
        if (team.Projects) modTeam.setDataValue("Projects", filterProjects(team.Projects, gTeamRole));
        return res.status(200).send(modTeam);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to transfer ownership of a team
  app.put("/team/:id/transfer", verifyToken, checkPermissions("updateAny", "team"), (req, res) => {
    return teamController.transferOwnership(req.params.id, req.user.id, req.body.newOwnerId)
      .then((updated) => {
        return res.status(200).send(updated);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // a route to send a team invite
  app.post("/team/:id/invite", verifyToken, checkPermissions("createAny", "teamInvite"), (req, res) => {
    const payload = {
      projects: req.body.projects,
      canExport: req.body.canExport,
      role: req.body.role,
      team_id: req.params.id,
      user_id: req.user.id,
    };

    const token = jwt.sign(payload, app.settings.encryptionKey, {
      expiresIn: 2592000 // a month
    }, (err, token) => {
      if (err) throw new Error(err);
      return res.status(200).send({
        url: `${app.settings.client}/invite?token=${token}`,
      });
    });

    return token;
  });
  // --------------------------------------

  // route for adding a team member with invite url
  app.post("/team/user/:user_id", verifyToken, (req, res) => {
    if (!req.params.user_id || !req.body.token) return res.status(400).send("Missing fields");
    if (`${req.params.user_id}` !== `${req.user.id}`) {
      return res.status(400).send("Malformed request");
    }

    let newRole = {};
    return jwt.verify(req.body.token, app.settings.encryptionKey, (err, decoded) => {
      return teamController.addTeamRole(decoded.team_id, req.user.id, decoded.role || "projectViewer", decoded.projects, decoded.canExport)
        .then((role) => {
          newRole = role;
          return teamController.findById(newRole.team_id);
        })
        .then((team) => {
          const modTeam = team;
          if (team.Projects) modTeam.setDataValue("Projects", filterProjects(team.Projects, newRole));
          return res.status(200).send(modTeam);
        })
        .catch((error) => {
          return res.status(400).send(error);
        });
    });
  });
  // --------------------------------------

  // route to get all team users
  app.get("/team/:id/members", verifyToken, checkPermissions(), (req, res) => {
    return teamController.getTeamMembersId(req.params.id)
      .then((userIds) => {
        if (userIds.length < 1) return res.status(200).send([]);
        return userController.getUsersById(userIds, req.params.id);
      })
      .then((teamMembers) => {
        return res.status(200).send(teamMembers);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to update a team role
  app.put("/team/:id/role", verifyToken, checkPermissions("updateAny", "teamRole"), (req, res) => {
    return teamController.updateTeamRole(req.params.id, req.body.user_id, req.body)
      .then((updated) => {
        return res.status(200).send(updated);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to delete a team member
  app.delete("/team/:id/member/:userId", verifyToken, checkPermissions("deleteAny", "teamRole"), (req, res) => {
    return teamController.getTeamRole(req.params.id, req.params.userId)
      .then(async (teamRole) => {
        if (!teamRole) return res.status(404).send("Did not find a team member");

        const roleToDelete = await teamController.getTeamRole(req.params.id, req.params.userId);

        if (roleToDelete.role === "teamOwner") {
          return new Promise((resolve, reject) => reject("Cannot delete a team owner"));
        }

        return teamController.deleteTeamMember(teamRole.id);
      })
      .then((success) => {
        if (success) {
          return res.status(200).send({ removed: success });
        }
        return new Promise((resolve, reject) => reject(new Error(400)));
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to create a new API key to access the team content
  app.post("/team/:id/apikey", verifyToken, checkPermissions("createAny", "apiKey"), (req, res) => {
    if (!req.body.name) return res.status(400).send("Missing required fields.");

    return teamController.createApiKey(req.params.id, req.user, req.body)
      .then((apiKey) => {
        return res.status(200).send(apiKey);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // --------------------------------------

  // route to get an API key
  app.get("/team/:id/apikey", verifyToken, checkPermissions("readAny", "apiKey"), (req, res) => {
    return teamController.getApiKeys(req.params.id)
      .then((apiKey) => {
        return res.status(200).send(apiKey);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // --------------------------------------

  // route to remove an API key
  app.delete("/team/:id/apikey/:keyId", verifyToken, checkPermissions("deleteAny", "apiKey"), (req, res) => {
    return teamController.deleteApiKey(req.params.keyId)
      .then(() => {
        return res.status(200).send({ deleted: true });
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // --------------------------------------

  return (req, res, next) => {
    next();
  };
};
