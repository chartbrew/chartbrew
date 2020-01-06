const simplecrypt = require("simplecrypt");
const uuidv4 = require("uuid/v4");

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
  addTeamRole(teamId, userId, roleName) {
    return db.TeamRole.create({ "team_id": teamId, "user_id": userId, "role": roleName })
      .then((role) => {
        return role;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
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

  updateTeamRole(teamId, userId, newRole) {
    return db.TeamRole.update({ role: newRole }, { where: { "team_id": teamId, "user_id": userId } })
      .then(() => {
        return this.getTeamRole(teamId, userId);
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
              if (teamRole.team_id === parseInt(teamId, 0)) idsArray.push(teamRole.team_id);
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
        { model: db.Project, include: [{ model: db.Chart }] }
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
        if (idsArray < 1) return new Promise(resolve => resolve([]));
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
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  saveTeamInvite(teamId, data) {
    const token = uuidv4();
    return db.TeamInvitation.create({
      "team_id": teamId, "email": data.email, "user_id": data.user_id, token
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
}

module.exports = TeamController;
