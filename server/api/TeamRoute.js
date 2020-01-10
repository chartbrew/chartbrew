const TeamController = require("../controllers/TeamController");
const UserController = require("../controllers/UserController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const mail = require("../modules/mail");

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
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readOwn("team");
        if (!permission.granted) {
          throw new Error(401);
        }
        return teamController.findById(req.params.id);
      })
      .then((team) => {
        return res.status(200).send(team);
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
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateOwn("team");
        if (!permission.granted) {
          throw new Error(401);
        }
        return teamController.update(req.params.id, req.body);
      })
      .then((team) => {
        return res.status(200).send(team);
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

  const sendInviteEmail = ((invite, admin, teamName) => {
    return mail.sendInvite(invite, admin.name, teamName.name);
  });
  // --------------------------------------

  // a route to send a team invite
  app.post("/team/:id/invite", verifyToken, (req, res) => {
    if (!req.params.id || !req.body) return res.status(400).send("Missing params");
    let invite = {};
    let admin = {};
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("teamInvite");
        if (!permission.granted) {
          throw new Error(401);
        }
        return teamController.isUserInTeam(req.params.id, req.body.email);
      })
      .then((arr) => {
        if (arr && arr.includes(parseInt(req.params.id, 0))) return res.status(409).send("user is in this team");
        return teamController.getInviteByEmail(req.params.id, req.body.email);
      })
      .then((existingInvite) => {
        if (existingInvite) {
          invite = existingInvite;
          return new Promise(resolve => resolve(invite));
        }
        return teamController.saveTeamInvite(req.params.id, req.body);
      })
      .then((createdInvite) => {
        invite = createdInvite;
        return userController.findById(invite.user_id);
      })
      .then((teamAdmin) => {
        admin = teamAdmin;
        return teamController.findById(req.params.id);
      })
      .then((teamName) => {
        return sendInviteEmail(invite, admin, teamName);
      })
      .then(() => {
        return res.status(200).send(invite);
      })
      .catch((error) => {
        if (error.message === "406") return res.status(406).send(error);
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route to resend existing team invite
  // TODO: test
  app.post("/team/resendInvite", verifyToken, (req, res) => {
    const { invite } = req.body;
    let admin = {};
    return teamController.getTeamRole(invite.team_id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("teamInvite");
        if (!permission.granted) {
          throw new Error(401);
        }
        return userController.findById(invite.user_id);
      })
      .then((teamAdmin) => {
        admin = teamAdmin;
        return teamController.findById(invite.team_id);
      })
      .then((teamName) => {
        return sendInviteEmail(invite, admin, teamName);
      })
      .then(() => {
        return res.status(200).send(invite);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  // route for adding a team member with invite url
  app.post("/team/user/:user_id", verifyToken, (req, res) => {
    if (!req.params.user_id || !req.body.token) return res.status(400).send("Missing fields");
    let newRole = {};
    return teamController.getTeamInvite(req.body.token)
      .then((invite) => {
        return teamController.addTeamRole(invite.team_id, req.params.user_id, "member");
      })
      .then((role) => {
        newRole = role;
        return teamController.deleteTeamInvite(req.body.token);
      })
      .then(() => {
        return teamController.findById(newRole.team_id);
      })
      .then((team) => {
        return res.status(200).send(team);
      })
      .catch((error) => {
        if (error === "404") return res.status(404).send("The invitation is not found");
        return res.status(400).send(error);
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
          throw new Error(401);
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
  // // TODO: TEST
  app.post("/team/:id/declineInvite/user", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.id, req.user.id)
      .then((teamRole) => {
        if (!teamRole) throw new Error("norole");
        const permission = accessControl.can(teamRole.role).deleteAny("teamInvite");
        if (!permission.granted) {
          throw new Error(401);
        }
        return teamController.deleteTeamInvite(req.body.token);
      })
      .then(() => {
        return res.status(200).send({});
      })
      .catch((error) => {
        if (error.message === "norole") {
          return teamController.getInviteByEmail(req.params.id, req.user.email);
        }
        if (error.message === "401") {
          return res.status(401).send(error);
        }
        return res.status(400).send(error);
      })
      .then((invite) => {
        if (!invite) {
          return res.status(401).send({ error: "Not authorized" });
        }

        return teamController.deleteTeamInvite(req.body.token);
      })
      .then(() => {
        return res.status(200).send({});
      })
      .catch((error) => {
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
          throw new Error(401);
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
          throw new Error(401);
        }
        return teamController.updateTeamRole(req.params.id, req.body.user_id, req.body.role);
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
          throw new Error(401);
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
        throw new Error(400);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send({ error: "Not authorized" });
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  return (req, res, next) => {
    next();
  };
};
