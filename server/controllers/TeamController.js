const simplecrypt = require("simplecrypt");
const uuidv4 = require("uuid/v4");

const Team = require("../models/Team");
const TeamRole = require("../models/TeamRole");
const User = require("../models/User");
const Project = require("../models/Project");
const TeamInvite = require("../models/TeamInvintation");
const UserController = require("./UserController");
const StripeController = require("./StripeController");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

class TeamController {
  constructor() {
    this.team = Team;
    this.teamRole = TeamRole;
    this.teamInvite = TeamInvite;
    this.user = User;
    this.userController = new UserController();
    this.stripeController = new StripeController();
  }

  // create a new team
  createTeam(data) {
    return this.team.create({ "name": data.name })
      .then((team) => {
        return team;
      }).catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  deleteTeam(id) {
    return this.team.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  // add a new team role
  addTeamRole(teamId, userId, roleName) {
    // check if the plan requires extra member subscription item or not
    let features;
    return this.getTeamPlan(teamId)
      .then((sub) => {
        features = settings.features[sub.plan.nickname.toLowerCase()];
        return this.teamRole.findAll({
          where: { team_id: teamId },
          include: [{ model: User }]
        });
      })
      .then((roles) => {
        // if the plan reached the maximum number of users in the plan, get some $$$
        if (roles.length >= features.members) {
          // get the subscriptionId of the owner
          let subscriptionId;
          for (const role of roles) {
            if (role.role === "owner") {
              subscriptionId = sc.decrypt(role.User.subscriptionId);
              break;
            }
          }

          return this.stripeController.updateMembers(subscriptionId, 1);
        }
        return roles;
      })
      .then(() => {
        return this.teamRole.create({ "team_id": teamId, "user_id": userId, "role": roleName });
      })
      .then((role) => {
        return role;
      })
      .catch((error) => {
        if (error.message === "404") {
          return this.teamRole.create({ "team_id": teamId, "user_id": userId, "role": roleName });
        }
        return new Promise((resolve, reject) => reject(error));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getTeamRole(teamId, userId) {
    return this.teamRole.findOne({
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
    return this.teamRole.findAll({
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
    return this.teamRole.findAll({
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
    return this.teamRole.update({ role: newRole }, { where: { "team_id": teamId, "user_id": userId } })
      .then(() => {
        return this.getTeamRole(teamId, userId);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  deleteTeamMember(id) {
    let features;
    let teamId;
    return this.teamRole.findByPk(id)
      .then((role) => {
        teamId = role.team_id;
        return this.teamRole.destroy({ where: { id } });
      })
      .then(() => {
        // now check if the subscription should be changed as well
        return this.getTeamPlan(teamId);
      })
      .then((sub) => {
        features = settings.features[sub.plan.nickname.toLowerCase()];

        return this.teamRole.findAll({
          where: { team_id: teamId },
          include: [{ model: User }]
        });
      })
      .then((roles) => {
        // if the plan reached the maximum number of users in the plan, get some $$$
        if (roles.length >= features.members) {
          // get the subscriptionId of the owner
          let subscriptionId;
          for (const role of roles) {
            if (role.role === "owner") {
              subscriptionId = sc.decrypt(role.User.subscriptionId);
              break;
            }
          }
          return this.stripeController.updateMembers(subscriptionId, -1);
        }

        return roles;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }


  isUserInTeam(teamId, email) {
    // checking if a user is already in the team
    const idsArray = [];
    return this.user.findOne({ where: { "email": sc.encrypt(email) } })
      .then((invitedUser) => {
        if (!invitedUser) return [];
        return this.teamRole.findAll({ where: { "user_id": invitedUser.id } })
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
    let gTeam;

    return this.team.findOne({
      where: { id },
      include: [{ model: TeamRole }, { model: Project }],
    })
      .then((team) => {
        if (!team) return new Promise((resolve, reject) => reject(new Error(404)));
        gTeam = team;

        return this.getTeamPlan(id);
      })
      .then((subscription) => {
        if (subscription.plan) {
          gTeam.setDataValue("plan", settings.features[subscription.plan.nickname.toLowerCase()]);
        }

        return gTeam;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error.message));
      });
  }

  update(id, data) {
    return this.team.update(data, { where: { "id": id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getUserTeams(userId) {
    let gTeams;

    return this.teamRole.findAll({ where: { user_id: userId } })
      .then((teamIds) => {
        const idsArray = [];
        teamIds.forEach((role) => {
          idsArray.push(role.team_id);
        });
        if (idsArray < 1) return new Promise(resolve => resolve([]));
        return this.team.findAll({
          where: { id: idsArray },
          include: [{ model: TeamRole }, { model: Project }]
        });
      })
      .then((teams) => {
        gTeams = teams;
        // prepare promises for fetching the subscription plan for each team
        const promises = [];
        for (const team of teams) {
          promises.push(this.getTeamPlan(team.id));
        }

        return Promise.all(promises);
      })
      .then((responses) => {
        // go through the responses and match the plan limitations with the team
        for (const response of responses) {
          for (const team of gTeams) {
            if (response.teamId === team.id && response.plan) {
              team.setDataValue("plan", settings.features[response.plan.nickname.toLowerCase()]);
              break;
            }
          }
        }

        return new Promise(resolve => resolve(gTeams));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  saveTeamInvite(teamId, data) {
    // first check if the user is allowed to add memembers
    return this.getTeamPlan(teamId)
      .then((sub) => {
        // if the user is on the community plan, they can't add more members
        if (sub.plan.nickname.toLowerCase === "community") {
          throw new Error(406);
        }

        const token = uuidv4();
        return this.teamInvite.create({
          "team_id": teamId, "email": data.email, "user_id": data.user_id, token
        });
      })
      .then((invite) => {
        return invite;
      });
  }

  getTeamInvite(token) {
    return this.teamInvite.findOne({ where: { token } })
      .then((invite) => {
        if (!invite) return new Promise((resolve, reject) => reject(new Error(404)));
        return invite;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error.message));
      });
  }

  getTeamInvitesById(teamId) {
    return this.teamInvite.findAll({
      where: { team_id: teamId },
      include: [{ model: Team }],
    })
      .then((invites) => {
        return invites;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getInviteByEmail(teamId, email) {
    return this.teamInvite.findOne({
      where: { team_id: teamId, email: sc.encrypt(email) },
      include: [{ model: Team }],
    })
      .then((foundInvite) => {
        return foundInvite;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject((error.message)));
      });
  }

  deleteTeamInvite(token) {
    return this.teamInvite.destroy({ where: { token } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getTeamPlan(teamId) {
  // get the owner of the team to check the subscription
    return this.getAllTeamRoles(teamId)
      .then((roles) => {
        if (!roles || roles.length < 1) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        // llok for the owner in the array
        let owner;
        for (const role of roles) {
          if (role.role === "owner") {
            owner = role.user_id;
            break;
          }
        }

        return this.userController.findById(owner);
      })
      .then((user) => {
        if (!user.subscriptionId) {
        // quick hack to be able to give users access to different plans for free
          if (user.plan && settings.features[user.plan.toLowerCase()]) {
            return new Promise(resolve => resolve({ plan: { nickname: user.plan } }));
          }

          return new Promise(resolve => resolve({ plan: { nickname: "Community" } }));
        }

        const subscriptionId = sc.decrypt(user.subscriptionId);
        return this.stripeController.getSubscriptionDetails(subscriptionId);
      })
      .then((subscription) => {
        // set the teamId inside to make sure the subscription is identifiable
        const newSub = subscription;
        newSub.teamId = teamId;

        // check if the subscription has a plan and if not add the plan from the items array
        if (!newSub.plan) {
          newSub.plan = newSub.items.data[0].plan; // eslint-disable-line
        }

        return new Promise(resolve => resolve(newSub));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = TeamController;
