const simplecrypt = require("simplecrypt");
const uuidv4 = require("uuid/v4");
const _ = require("lodash");
const jwt = require("jsonwebtoken");

const db = require("../models/models");
const UserController = require("./UserController");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

class TeamController {
  constructor() {
    this.userController = new UserController();
  }

  findAll() {
    return db.Team.findAll()
      .then((teams) => {
        return Promise.resolve(teams);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  // create a new team
  createTeam(data) {
    return db.Team.create({ "name": data.name })
      .then((team) => {
        return team;
      }).catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  deleteTeam(id) {
    return db.Team.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  // add a new team role
  addTeamRole(teamId, userId, roleName, projects, canExport) {
    const teamRoleObj = { "team_id": teamId, "user_id": userId, "role": roleName };
    if (projects) teamRoleObj.projects = projects;
    if (canExport) teamRoleObj.canExport = canExport;

    return db.TeamRole.create(teamRoleObj)
      .then((role) => {
        return role;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  addProjectAccess(teamId, userId, projectId) {
    let gTeamRole;
    return db.TeamRole.findOne({ where: { team_id: teamId, user_id: userId } })
      .then((teamRole) => {
        gTeamRole = teamRole;

        const newProjects = teamRole.projects || [];
        if (_.indexOf(newProjects, parseInt(projectId, 10)) > -1) return teamRole;

        newProjects.push(parseInt(projectId, 10));
        return db.TeamRole.update({ projects: newProjects }, { where: { id: teamRole.id } });
      })
      .then(() => {
        return db.TeamRole.findByPk(gTeamRole.id);
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  addProjectAccessToOwner(teamId, projectId) {
    return db.TeamRole.findOne({ where: { team_id: teamId, role: "owner" } })
      .then((teamRole) => {
        return this.addProjectAccess(teamId, teamRole.user_id, projectId);
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  removeProjectAccess(teamId, userId, projectId) {
    let gTeamRole;
    return db.TeamRole.findOne({ where: { team_id: teamId, user_id: userId } })
      .then((teamRole) => {
        gTeamRole = teamRole;

        const newProjects = teamRole.projects;
        if (!newProjects || newProjects.length < 1) return teamRole;
        const index = _.indexOf(newProjects, parseInt(projectId, 10));
        if (index === -1) return teamRole;

        newProjects.splice(index, 1);

        return db.TeamRole.update({ projects: newProjects }, { where: { id: teamRole.id } });
      })
      .then(() => {
        return db.TeamRole.findByPk(gTeamRole.id);
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  getTeamRole(teamId, userId) {
    return db.TeamRole.findOne({
      where: {
        team_id: teamId,
        user_id: userId,
      },
    })
      .then((role) => {
        return role;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getAllTeamRoles(teamId) {
    return db.TeamRole.findAll({
      where: { team_id: teamId }
    })
      .then((roles) => {
        return roles;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getTeamMembersId(teamId) {
    return db.TeamRole.findAll({
      where: { team_id: teamId }
    }).then((teamRoles) => {
      const userIds = [];
      teamRoles.forEach((role) => {
        userIds.push(role.user_id);
      });
      return userIds;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
  }

  updateTeamRole(teamId, userId, data) {
    return db.TeamRole.update(data, { where: { "team_id": teamId, "user_id": userId } })
      .then(() => {
        return this.getTeamRole(teamId, userId);
      })
      .then((teamRole) => {
        return teamRole;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  deleteTeamMember(id) {
    let teamId;
    return db.TeamRole.findByPk(id)
      .then((role) => {
        teamId = role.team_id;
        return db.TeamRole.destroy({ where: { id } });
      })
      .then(() => {
        return this.getAllTeamRoles(teamId);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  isUserInTeam(teamId, email) {
    // checking if a user is already in the team
    const idsArray = [];
    return db.User.findOne({ where: { "email": sc.encrypt(email) } })
      .then((invitedUser) => {
        if (!invitedUser) return [];
        return db.TeamRole.findAll({ where: { "user_id": invitedUser.id } })
          .then((teamRoles) => {
            if (teamRoles.length < 1) return [];
            teamRoles.forEach((teamRole) => {
              if (teamRole.team_id === parseInt(teamId, 10)) idsArray.push(teamRole.team_id);
            });
            return idsArray;
          });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error.message));
      });
  }

  findById(id) {
    return db.Team.findOne({
      where: { id },
      include: [
        { model: db.TeamRole },
        {
          model: db.Project,
          include: [{ model: db.Chart, attributes: ["id"] }],
        }
      ],
    })
      .then((team) => {
        if (!team) return new Promise((resolve, reject) => reject(new Error(404)));

        return team;
      }).catch((error) => {
        return new Promise((resolve, reject) => reject(error.message));
      });
  }

  update(id, data) {
    return db.Team.update(data, { where: { "id": id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getUserTeams(userId) {
    return db.TeamRole.findAll({ where: { user_id: userId } })
      .then((teamIds) => {
        const idsArray = [];
        teamIds.forEach((role) => {
          idsArray.push(role.team_id);
        });
        if (idsArray < 1) return new Promise((resolve) => resolve([]));
        return db.Team.findAll({
          where: { id: idsArray },
          include: [
            { model: db.TeamRole },
            {
              model: db.Project,
              include: [
                { model: db.Chart, attributes: ["id"] },
                { model: db.Connection, attributes: ["id"] },
              ],
            },
          ],
        });
      })
      .then((teams) => {
        // filter the projects
        const newTeams = teams.map((team) => {
          const newTeam = team;
          const allowedProjects = [];
          let projectsRole = [];
          if (team.TeamRoles) {
            team.TeamRoles.map((role) => {
              if (role.user_id === parseInt(userId, 10)) {
                projectsRole = role.projects;
              }
              return role;
            });
          }

          if (team.Projects) {
            team.Projects.map((project) => {
              if (_.indexOf(projectsRole, project.id) > -1) {
                allowedProjects.push(project);
              }
              return project;
            });
          }

          newTeam.setDataValue("Projects", allowedProjects);
          return newTeam;
        });

        return newTeams;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  saveTeamInvite(teamId, data, userId) {
    const token = uuidv4();
    return db.TeamInvitation.create({
      "team_id": teamId,
      "user_id": userId,
      token,
      projects: data.projects,
      canExport: data.canExport
    })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getTeamInvite(token) {
    return db.TeamInvitation.findOne({ where: { token } })
      .then((invite) => {
        if (!invite) return new Promise((resolve, reject) => reject(new Error(404)));
        return invite;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error.message));
      });
  }

  getTeamInvitesById(teamId) {
    return db.TeamInvitation.findAll({
      where: { team_id: teamId },
      include: [{ model: db.Team }],
    })
      .then((invites) => {
        return invites;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getInviteByEmail(teamId, email) {
    return db.TeamInvitation.findOne({
      where: { team_id: teamId, email: sc.encrypt(email) },
      include: [{ model: db.Team }],
    })
      .then((foundInvite) => {
        return foundInvite;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject((error.message)));
      });
  }

  deleteTeamInvite(token) {
    return db.TeamInvitation.destroy({ where: { token } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async createApiKey(teamId, userData, body) {
    try {
      const token = jwt.sign({
        id: userData.id,
        email: userData.email,
      }, settings.secret, { expiresIn: "9999 years" });

      return await db.Apikey.create({
        name: body.name,
        team_id: teamId,
        token,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  getApiKeys(teamId) {
    return db.Apikey.findAll({ where: { team_id: teamId } })
      .then((apiKeys) => {
        if (!apiKeys || apiKeys.length < 1) return [];

        return apiKeys.map((key) => ({
          id: key.id,
          name: key.name,
          createdAt: key.createdAt,
        }));
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  deleteApiKey(keyId) {
    return db.Apikey.findByPk(keyId)
      .then((apiKey) => {
        return db.TokenBlacklist.create({ token: apiKey.token });
      })
      .then(() => {
        return db.Apikey.destroy({ where: { id: keyId } });
      })
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
}

module.exports = TeamController;
