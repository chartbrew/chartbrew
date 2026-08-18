const { v4: uuidv4 } = require("uuid");
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const db = require("../models/models");
const runtimeCache = require("../modules/runtimeCache");
const createOwnedTeam = require("../modules/teamOnboarding/createOwnedTeam");
const {
  sanitizeBusinessProfile,
  sanitizeTeamName,
  sanitizeUseCases,
} = require("../modules/teamOnboarding/businessProfile");
const UserController = require("./UserController");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const TEAM_ROLES = new Set([
  "teamOwner",
  "teamAdmin",
  "projectAdmin",
  "projectEditor",
  "projectViewer",
]);
const TEAM_ROLE_UPDATE_FIELDS = new Set(["role", "projects", "canExport"]);
const TEAM_UPDATE_FIELDS = new Set([
  "name",
  "showBranding",
  "useCases",
  "allowReportRefresh",
  "allowReportExport",
]);

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
  async createTeam(data, userId) {
    const transaction = await db.sequelize.transaction();
    try {
      const team = await createOwnedTeam({
        name: data?.name,
        useCases: data?.useCases,
        userId,
        transaction,
      });
      await transaction.commit();
      return this.findById(team.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteTeam(teamId, userId) {
    // first check if the user owns other teams
    const otherTeams = await db.TeamRole
      .findAll({ where: { user_id: userId, role: "teamOwner", team_id: { [Op.ne]: teamId } } });

    if (otherTeams.length < 1) {
      return new Promise((resolve, reject) => reject(new Error("You cannot delete a team that you own if you have no other teams")));
    }

    // Use a transaction to ensure data consistency
    const transaction = await db.sequelize.transaction();

    try {
      // Delete all related models with team_id
      await db.PinnedDashboard.destroy({ where: { team_id: teamId }, transaction });
      await db.SavedQuery.destroy({ where: { team_id: teamId }, transaction });
      await db.Integration.destroy({ where: { team_id: teamId }, transaction });
      await db.OAuth.destroy({ where: { team_id: teamId }, transaction });
      await db.Template.destroy({ where: { team_id: teamId }, transaction });
      await db.Apikey.destroy({ where: { team_id: teamId }, transaction });
      await db.Connection.destroy({ where: { team_id: teamId }, transaction });
      await db.Dataset.destroy({ where: { team_id: teamId }, transaction });
      await db.Project.destroy({ where: { team_id: teamId }, transaction });
      await db.TeamRole.destroy({ where: { team_id: teamId }, transaction });

      // Finally delete the team (this will cascade delete TeamRole and TeamInvitation)
      await db.Team.destroy({ where: { id: teamId }, transaction });

      await runtimeCache.clearPendingAiActions({ teamId });
      // Commit the transaction
      await transaction.commit();

      return true;
    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      return new Promise((resolve, reject) => reject(error));
    }
  }

  async transferOwnership(teamId, userId, newOwnerId) {
    const newOwnerRole = await db.TeamRole
      .findOne({ where: { team_id: teamId, user_id: newOwnerId } });

    if (newOwnerRole?.role !== "teamAdmin") {
      return new Promise((resolve, reject) => reject(new Error("New owner must be a team admin")));
    }

    const otherTeams = await db.TeamRole
      .findAll({ where: { user_id: userId, role: "teamOwner", team_id: { [Op.ne]: teamId } } });

    if (otherTeams.length < 1) {
      return new Promise((resolve, reject) => reject(new Error("The user needs to be the owner of at least one other team")));
    }

    const transaction = await db.sequelize.transaction();

    try {
      // all good now, change the teamRole of the owner to teamAdmin, and vice versa
      await db.TeamRole.update({ role: "teamAdmin" }, { where: { team_id: teamId, user_id: userId }, transaction });
      await db.TeamRole.update({ role: "teamOwner" }, { where: { team_id: teamId, user_id: newOwnerId }, transaction });

      await transaction.commit();

      return true;
    } catch (error) {
      await transaction.rollback();
      return new Promise((resolve, reject) => reject(error));
    }
  }

  // add a new team role
  addTeamRole(teamId, userId, roleName, projects, canExport) {
    const teamRoleObj = { "team_id": teamId, "user_id": userId, "role": roleName };
    if (projects) teamRoleObj.projects = projects;
    if (canExport) teamRoleObj.canExport = canExport;

    let gRole;
    return db.TeamRole.findOne({ where: { team_id: teamId, user_id: userId } })
      .then((teamRole) => {
        if (teamRole) {
          gRole = teamRole;
          // don't update if the role is the owner or teamAdmin
          if (teamRole.role === "teamOwner" || teamRole.role === "teamAdmin") return teamRole;

          return db.TeamRole.update(teamRoleObj, { where: { id: teamRole.id } });
        }

        return db.TeamRole.create(teamRoleObj);
      })
      .then((role) => {
        if (!gRole) gRole = role;
        return db.TeamRole.findByPk(role.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  addProjectAccess(teamId, userId, projectId, options = {}) {
    let gTeamRole;
    const { transaction } = options;

    return db.TeamRole.findOne({ where: { team_id: teamId, user_id: userId }, transaction })
      .then((teamRole) => {
        gTeamRole = teamRole;

        const newProjects = teamRole.projects || [];
        if (_.indexOf(newProjects, parseInt(projectId, 10)) > -1) return teamRole;

        newProjects.push(parseInt(projectId, 10));
        return db.TeamRole.update({ projects: newProjects }, { where: { id: teamRole.id }, transaction });
      })
      .then(() => {
        return db.TeamRole.findByPk(gTeamRole.id, { transaction });
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  addProjectAccessToOwner(teamId, projectId, options = {}) {
    const { transaction } = options;

    return db.TeamRole.findOne({ where: { team_id: teamId, role: "teamOwner" }, transaction })
      .then((teamRole) => {
        return this.addProjectAccess(teamId, teamRole.user_id, projectId, options);
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

  getTeamMembers(teamId) {
    return this.getTeamMembersId(teamId)
      .then((userIds) => {
        return this.userController.getUsersById(userIds, teamId);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateTeamRole(teamId, userId, data) {
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([field]) => TEAM_ROLE_UPDATE_FIELDS.has(field))
    );

    return this.getTeamRole(teamId, userId)
      .then((currentTeamRole) => {
        if (!currentTeamRole) {
          throw new Error(404);
        }

        if (updateData.role) {
          if (!TEAM_ROLES.has(updateData.role)) {
            throw new Error("Invalid team role");
          }
          if (currentTeamRole.role === "teamOwner" || updateData.role === "teamOwner") {
            throw new Error("Team ownership can only be changed through an ownership transfer");
          }
        }

        return db.TeamRole.update(updateData, { where: { "team_id": teamId, "user_id": userId } });
      })
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
    return db.User.findOne({ where: { email } })
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
          model: db.TeamBusinessProfile,
          attributes: { exclude: ["logoData"] },
        },
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
    const updateData = Object.fromEntries(
      Object.entries(data || {}).filter(([field]) => TEAM_UPDATE_FIELDS.has(field))
    );
    if (updateData.name !== undefined) updateData.name = sanitizeTeamName(updateData.name);
    if (updateData.useCases !== undefined) updateData.useCases = sanitizeUseCases(updateData.useCases);
    return db.Team.update(updateData, { where: { "id": id } })
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
              model: db.TeamBusinessProfile,
              attributes: { exclude: ["logoData"] },
            },
            {
              model: db.Project,
              include: [
                { model: db.Chart, attributes: ["id"] },
              ],
            },
            { model: db.Connection, attributes: ["id"] },
          ],
        });
      })
      .then((teams) => {
        // filter the projects
        const newTeams = teams.map((team) => {
          const newTeam = team;
          const teamRole = team.TeamRoles.find((role) => role.user_id === parseInt(userId, 10));
          if (teamRole.role !== "teamOwner" && teamRole.role !== "teamAdmin") {
            const allowedProjects = [];
            let projectsRole = [];
            projectsRole = teamRole.projects || [];

            if (team.Projects) {
              team.Projects.map((project) => {
                if (_.indexOf(projectsRole, project.id) > -1) {
                  allowedProjects.push(project);
                }
                return project;
              });
            }

            newTeam.setDataValue("Projects", allowedProjects);
          }
          return newTeam;
        });

        return newTeams;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async saveOnboarding(teamId, userId, data = {}) {
    const teamRole = await this.getTeamRole(teamId, userId);
    if (!teamRole || teamRole.role !== "teamOwner") throw new Error(401);
    const transaction = await db.sequelize.transaction();
    try {
      const teamUpdate = {};
      if (data.name !== undefined) teamUpdate.name = sanitizeTeamName(data.name);
      if (data.useCases !== undefined) teamUpdate.useCases = sanitizeUseCases(data.useCases);
      if (data.complete === true) teamUpdate.onboardingCompletedAt = new Date();
      if (Object.keys(teamUpdate).length) {
        await db.Team.update(teamUpdate, { where: { id: teamId }, transaction });
      }
      if (data.businessProfile !== undefined) {
        const profile = sanitizeBusinessProfile(data.businessProfile);
        await db.TeamBusinessProfile.upsert({
          team_id: parseInt(teamId, 10),
          ...profile,
          aiContextAllowed: data.aiContextAllowed === true,
        }, { transaction });
      } else if (data.aiContextAllowed !== undefined) {
        await db.TeamBusinessProfile.update(
          { aiContextAllowed: data.aiContextAllowed === true },
          { where: { team_id: teamId }, transaction }
        );
      }
      await transaction.commit();
      return this.findById(teamId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateBusinessProfile(teamId, userId, data = {}) {
    const teamRole = await this.getTeamRole(teamId, userId);
    if (!teamRole || !["teamOwner", "teamAdmin"].includes(teamRole.role)) throw new Error(401);
    const currentProfile = await db.TeamBusinessProfile.findOne({ where: { team_id: teamId } });
    const profileInput = data.businessProfile || data;
    const sanitized = sanitizeBusinessProfile(profileInput, {
      includeLogo: profileInput.logo !== undefined,
    });
    const aiContextAllowed = teamRole.role === "teamOwner" && data.aiContextAllowed !== undefined
      ? data.aiContextAllowed === true : currentProfile?.aiContextAllowed === true;
    await db.TeamBusinessProfile.upsert({
      team_id: parseInt(teamId, 10),
      ...sanitized,
      aiContextAllowed,
    });
    return db.TeamBusinessProfile.findOne({
      where: { team_id: teamId },
      attributes: { exclude: ["logoData"] },
    });
  }

  async getBusinessProfileLogo(teamId, userId) {
    const teamRole = await this.getTeamRole(teamId, userId);
    if (!teamRole) throw new Error(401);
    return db.TeamBusinessProfile.findOne({
      where: { team_id: teamId },
      attributes: ["logoData", "logoMimeType", "updatedAt"],
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
      where: { team_id: teamId, email },
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
      }, settings.encryptionKey, { expiresIn: "9999 years" });

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

  deleteApiKey(keyId, teamId) {
    const whereCondition = teamId
      ? { id: keyId, team_id: teamId }
      : { id: keyId };

    return db.Apikey.findOne({ where: whereCondition })
      .then((apiKey) => {
        if (!apiKey) {
          return Promise.reject(new Error(404));
        }
        return db.TokenBlacklist.create({ token: apiKey.token });
      })
      .then(() => {
        return db.Apikey.destroy({ where: whereCondition });
      })
      .then((result) => {
        if (result === 0) {
          return Promise.reject(new Error(404));
        }
        return result;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
}

module.exports = TeamController;
