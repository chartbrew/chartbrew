const { Op } = require("sequelize");
const { nanoid } = require("nanoid");

const db = require("../models/models");
const TeamController = require("./TeamController");
const templateModels = require("../templates");

class ProjectController {
  constructor() {
    this.teamController = new TeamController();
  }

  findAll() {
    return db.Project.findAll()
      .then((projects) => {
        return Promise.resolve(projects);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  findById(id) {
    return db.Project.findOne({
      where: { id },
      order: [[db.Chart, db.Dataset, "order", "ASC"]],
      include: [
        { model: db.Connection, attributes: ["id", "project_id", "name", "type"] },
        { model: db.Chart, include: [{ model: db.Dataset }] }
      ],
    })
      .then((project) => {
        if (!project) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return project;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByUserId(userId) {
    return db.ProjectRole.findAll({
      where: {
        user_id: userId
      },
    })
      .then((roles) => {
        const idArray = [];

        roles.forEach((role) => {
          idArray.push(role.project_id);
        });

        if (idArray.length < 1) {
          return new Promise((resolve) => resolve([]));
        }

        return db.Project.findAll({
          where: {
            id: { [Op.in]: idArray },
          },
          include: [{ model: db.ProjectRole }, { model: db.Chart, attributes: ["id"] }],
        });
      })
      .then((projects) => {
        if (projects.length === 1) return new Promise((resolve) => resolve(projects));
        return new Promise((resolve) => resolve(projects));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  create(userId, data) {
    let newProject = {};
    return db.Project.create(data)
      .then((project) => {
        newProject = project;
        return this.updateProjectRole(project.id, userId, "owner");
      })
      .then(() => {
        const brewName = `${newProject.name.replace(/[\W_]+/g, "_")}_${newProject.id}`;
        return this.update(newProject.id, { brewName });
      })
      .then(() => {
        // now update the projects access in TeamRole
        return this.teamController.addProjectAccess(data.team_id, userId, newProject.id);
      })
      .then(() => {
        return this.teamController.addProjectAccessToOwner(data.team_id, newProject.id);
      })
      .then(() => {
        return this.findById(newProject.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    const newFields = data;
    return this.findById(id)
      .then((project) => {
        if (data.passwordProtected && !project.password) {
          newFields.password = nanoid(8);
        }
        return db.Project.update(newFields, { where: { id } });
      })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id, userId) {
    let gProject;
    // remove the project and any associated items alongs with that
    return db.Project.findByPk(id)
      .then((project) => {
        gProject = project;
        return db.Project.destroy({ where: { id } });
      })
      .then(() => {
        // update the user's teamRole
        return this.teamController.removeProjectAccess(gProject.team_id, userId, gProject.id);
      })
      .then(() => {
        // make sure all charts from this project are deleted as well
        return db.Chart.destroy({ where: { project_id: id } });
      })
      .then(() => {
        return { removed: true };
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateProjectRole(projectId, userId, role) {
    return db.ProjectRole.findOne({
      where: {
        project_id: projectId,
        user_id: userId,
      }
    })
      .then((projectRole) => {
        if (projectRole) {
          projectRole.setDataValue("role", role);
          return projectRole.save();
        }

        return db.ProjectRole.create({
          project_id: projectId,
          user_id: userId,
          role,
        });
      })
      .then((projectRole) => {
        return projectRole;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getTeamProjects(teamId) {
    return db.Project.findAll({
      where: { team_id: teamId },
    })
      .then((projects) => {
        return projects;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getPublicDashboard(brewName) {
    return db.Project.findOne({
      where: { brewName },
      include: [
        {
          model: db.Chart,
          attributes: { exclude: ["query"] },
          where: { onReport: true },
          include: [{ model: db.Dataset, order: [["order", "ASC"]] }],
        },
        {
          model: db.Team,
          attributes: ["showBranding"],
        }
      ],
      order: [[db.Chart, "dashboardOrder", "ASC"]],
    })
      .then((dashboard) => {
        if (!dashboard) return new Promise((resolve, reject) => reject(new Error(404)));
        return dashboard;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  generateTemplate(projectId, data, template) {
    return db.Chart.findAll({
      where: { project_id: projectId },
      order: [["dashboardOrder", "DESC"]],
      limit: 1,
    })
      .then((charts) => {
        let dashboardOrder = 0;
        if (charts && charts.length > 0) {
          dashboardOrder = charts[0].dashboardOrder;
        }
        return templateModels[template].build(projectId, data, dashboardOrder);
      })
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
}

module.exports = ProjectController;
