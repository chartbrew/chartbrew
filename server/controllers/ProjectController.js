const db = require("../models/models");

class ProjectController {
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
      include: [{ model: db.Connection }, { model: db.Chart }],
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
          return new Promise(resolve => resolve([]));
        }

        return db.Project.findAll({
          where: {
            id: idArray,
          },
          include: [{ model: db.ProjectRole }, { model: db.Chart }],
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
        return newProject;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    return db.Project.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id) {
    // remove the project and any associated items alongs with that
    return db.Project.destroy({ where: { id } })
      .then((result) => {
        return result;
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
    return db.Project.findAll({ where: { team_id: teamId } })
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
        { model: db.Chart, attributes: { exclude: ["query"] }, where: { public: true } },
        { model: db.Team, attributes: ["name"] },
      ],
      order: [[db.Chart, "dashboardOrder", "ASC"]],
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
