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
      order: [[db.Chart, "dashboardOrder", "ASC"], [db.Chart, db.ChartDatasetConfig, "order", "ASC"]],
      include: [
        {
          model: db.Chart,
          include: [{
            model: db.ChartDatasetConfig, include: [{ model: db.Dataset }]
          }, {
            model: db.Chartshare,
          }, {
            model: db.Alert,
          }],
        },
        {
          model: db.Variable,
        },
        {
          model: db.Team,
          attributes: ["showBranding"],
        }
      ],
    })
      .then((project) => {
        // if (!project) {
        //   throw new Error(404);
        // }
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
      include: [{ model: db.Variable }],
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
          include: [{ model: db.ProjectRole }, { model: db.Chart, attributes: ["id", "layout"] }],
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
        return this.updateProjectRole(project.id, userId, "teamOwner");
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

  remove(id) {
    // remove the project and any associated items alongs with that
    return db.Variable.destroy({ where: { project_id: id } })
      .then(() => {
        return db.Project.destroy({ where: { id } });
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
      include: [{ model: db.Chart, attributes: ["id", "layout"] }, { model: db.Variable }],
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
          include: [{
            model: db.ChartDatasetConfig,
            order: [["order", "ASC"]],
            include: [{ model: db.Dataset, attributes: ["id", "conditions", "fieldsSchema"] }],
          }],
        },
        {
          model: db.Team,
          attributes: ["showBranding", "allowReportRefresh", "allowReportExport"],
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

  async generateTemplate(projectId, data, template) {
    const project = await this.findById(projectId);

    return templateModels[template].build(project.team_id, projectId, data)
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  getVariables(projectId) {
    return db.Variable.findAll({
      where: { project_id: projectId },
    })
      .then((variables) => {
        return variables;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  createVariable(projectId, data) {
    return db.Variable.create({ project_id: projectId, ...data })
      .then((variable) => {
        return variable;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  updateVariable(variableId, data) {
    return db.Variable.update(data, { where: { id: variableId } })
      .then(() => {
        return this.findById(variableId);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  deleteVariable(variableId) {
    return db.Variable.destroy({ where: { id: variableId } })
      .then(() => {
        return { removed: true };
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }
}

module.exports = ProjectController;
