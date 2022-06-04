const _ = require("lodash");
const jwt = require("jsonwebtoken");

const TeamController = require("../controllers/TeamController");
const UserController = require("../controllers/UserController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

function filterProjects(projects, teamRole) {
  return projects.filter((p) => _.indexOf(teamRole.projects, p.id) > -1);
}

module.exports = (app) => {
  const teamController = new TeamController();
  const userController = new UserController();

  /**
   * [MASTER] Route to get all the teams
   */
  app.get("/team", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not authorized" });
    }

    return teamController.findAll()
      .then((teams) => {
        return res.status(200).send(teams);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to get a team by its id
  app.get("/team/:id", verifyToken, (req, res) => {
    let gTeamRole;
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        gTeamRole = teamRole;
        const permission = accessControl.can(teamRole.role).readOwn("team");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.findById(req.params.id);
      })
      .then((team) => {
        const modTeam = team;
        if (team.Projects) modTeam.setDataValue("Projects", filterProjects(team.Projects, gTeamRole));
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
  app.post("/team", (req, res) => {
    if (!req.body.user_id) return res.status(400).send("Missing userID");
    let newTeam = {};
    return teamController.createTeam(req.body)
      .then((team) => {
        newTeam = team;
        return teamController.addTeamRole(newTeam.id, req.body.user_id, "owner");
      })
      .then(() => {
        return teamController.findById(newTeam.id);
      })
      .then((team) => {
        return res.status(200).send(team);
      })
      .catch((error) => {
        return res.status(400).send(error);
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

  // route to get all user's teams
  app.get("/team/user/:user_id", verifyToken, (req, res) => {
    if (!req.params.user_id) return res.status(400).send("Missing userId");
    return teamController.getUserTeams(req.params.user_id)
      .then((teams) => {
        return res.status(200).send(teams);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // a route to send a team invite
  app.post("/team/:id/invite", verifyToken, (req, res) => {
    if (!req.params.id || !req.body) return res.status(400).send("Missing params");

    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("teamInvite");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        const payload = {
          projects: req.body.projects,
          canExport: req.body.canExport,
          team_id: teamRole.team_id,
          user_id: teamRole.user_id,
        };

        const token = jwt.sign(payload, app.settings.secret, {
          expiresIn: 2592000 // a month
        }, (err, token) => {
          if (err) throw new Error(err);
          return res.status(200).send({
            url: `${app.settings.client}/invite?token=${token}`,
          });
        });

        return token;
      })
      .catch((error) => {
        if (error.message === "406") return res.status(406).send(error);
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        if (error.message === "409") return res.status(409).send({ error: "The user is already in this team" });

        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route for adding a team member with invite url
  app.post("/team/user/:user_id", verifyToken, (req, res) => {
    if (!req.params.user_id || !req.body.token) return res.status(400).send("Missing fields");
    if (`${req.params.user_id}` !== `${req.user.id}`) {
      return res.status(400).send("Malformed request");
    }

    let newRole = {};
    return jwt.verify(req.body.token, app.settings.secret, (err, decoded) => {
      return teamController.addTeamRole(decoded.team_id, req.user.id, "member", decoded.projects, decoded.canExport)
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
  app.get("/team/:id/members", verifyToken, (req, res) => {
    const teamId = req.params.id;
    return teamController.getTeamRole(teamId, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("teamRole");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.getTeamMembersId(teamId);
      })
      .then((userIds) => {
        if (userIds.length < 1) return res.status(200).send([]);
        return userController.getUsersById(userIds, teamId);
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

  // route to find an invited user by invite token
  app.get("/team/invite/:token", (req, res) => {
    if (!req.params.token) return res.status(400).send("invite token is missing");
    return teamController.getTeamInvite(req.params.token)
      .then((foundInvite) => {
        return userController.emailExists(foundInvite.email);
      })
      .then((emailExists) => {
        return res.status(200).send(emailExists);
      })
      .catch((error) => {
        if (error === "404") return res.status(404).send("The invite is not found");
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to delete a team invite by token
  app.post("/team/:id/declineInvite/user", verifyToken, (req, res) => {
    let requestFinished = false;
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        if (!teamRole) {
          return new Promise((resolve, reject) => reject(new Error("norole")));
        }
        const permission = accessControl.can(teamRole.role).deleteAny("teamInvite");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.deleteTeamInvite(req.body.token);
      })
      .then(() => {
        res.status(200).send({});
        requestFinished = true;
        return Promise.resolve({});
      })
      .catch((error) => {
        if (error.message === "norole") {
          return teamController.getInviteByEmail(req.params.id, req.user.email);
        }

        return Promise.reject(error);
      })
      .then((invite) => {
        if (!invite) {
          return Promise.reject({ error: "Not authorized" });
        }

        return teamController.deleteTeamInvite(req.body.token);
      })
      .then(() => {
        if (!requestFinished) {
          return res.status(200).send({});
        }

        return Promise.resolve({});
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("401") > -1) {
          return res.status(401).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to get pending invites for the team
  app.get("/team/pendingInvites/:id", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("teamInvite");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.getTeamInvitesById(req.params.id);
      })
      .then((invites) => {
        return res.status(200).send([invites, []]);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to update a team role
  app.put("/team/:id/role", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("teamRole");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.updateTeamRole(req.params.id, req.body.user_id, req.body);
      })
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
  app.delete("/team/:id/member/:userId", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("teamRole");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return teamController.getTeamRole(req.params.id, req.params.userId);
      })
      .then((teamRole) => {
        if (!teamRole) return res.status(404).send("Did not find a team member");
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
  app.post("/team/:id/apikey", verifyToken, (req, res) => {
    if (!req.body.name) return res.status(400).send("Missing required fields.");

    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("apiKey");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.createApiKey(req.params.id, req.user, req.body);
      })
      .then((apiKey) => {
        return res.status(200).send(apiKey);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // --------------------------------------

  // route to get an API key
  app.get("/team/:id/apikey", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("apiKey");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.getApiKeys(req.params.id);
      })
      .then((apiKey) => {
        return res.status(200).send(apiKey);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // --------------------------------------

  // route to remove an API key
  app.delete("/team/:id/apikey/:keyId", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("apiKey");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.deleteApiKey(req.params.keyId);
      })
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
