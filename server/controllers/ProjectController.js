const Project = require("../models/Project");
const Connection = require("../models/Connection");
const ProjectRole = require("../models/ProjectRole");
const Chart = require("../models/Chart");
const Team = require("../models/Team");

class ProjectController {
  constructor() {
    this.project = Project;
    this.projectRole = ProjectRole;
  }

  findById(id) {
    return this.project.findOne({
      where: { id },
      include: [{ model: Connection }, { model: Chart }],
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
    return this.projectRole.findAll({
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
          return new Promise(resolve => resolve([]));
        }

        return this.project.findAll({
          where: {
            id: idArray,
          },
          include: [{ model: ProjectRole }, { model: Chart }],
        });
      })
      .then((projects) => {
        if (projects.length === 1) return new Promise(resolve => resolve(projects));
        return new Promise(resolve => resolve(projects));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  create(userId, data) {
    let newProject = {};
    return this.project.create(data)
      .then((project) => {
        newProject = project;
        return this.updateProjectRole(project.id, userId, "owner");
      })
      .then(() => {
        const brewName = `${newProject.name.replace(/[\W_]+/g, "_")}_${newProject.id}`;
        return this.update(newProject.id, { brewName });
      })
      .then(() => {
        return newProject;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    return this.project.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id) {
    // remove the project and any associated items alongs with that
    return this.project.destroy({ where: { id } })
      .then((result) => {
        return result;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateProjectRole(projectId, userId, role) {
    return this.projectRole.findOne({
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

        return this.projectRole.create({
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
    return this.project.findAll({ where: { team_id: teamId } })
      .then((projects) => {
        return projects;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getPublicDashboard(brewName) {
    return this.project.findOne({
      where: { brewName },
      include: [
        { model: Chart, attributes: { exclude: ["query"] }, where: { public: true } },
        { model: Team, attributes: ["name"] },
      ],
      order: [[Chart, "dashboardOrder", "ASC"]],
    })
      .then((dashboard) => {
        if (!dashboard) throw new Error(404);
        return dashboard;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = ProjectController;
