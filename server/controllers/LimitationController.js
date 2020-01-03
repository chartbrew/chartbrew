const db = require("../models/models");
const TeamController = require("./TeamController");
const UserController = require("./UserController");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

class LimitationController {
  constructor() {
    this.teamController = new TeamController();
    this.userController = new UserController();
  }

  canCreateChart(teamId, projectId) {
    let limitations;
    return this.getLimitations(teamId)
      .then((resp) => {
        limitations = resp;
        // now get the project and see if the number of charts reached the limitation
        return db.Chart.count({ where: { project_id: projectId } });
      })
      .then((count) => {
        if (limitations.charts === "unlimited") {
          return new Promise(resolve => resolve(true));
        }
        if (count + 1 > limitations.charts) {
          return new Promise(resolve => resolve(false));
        }

        return new Promise(resolve => resolve(true));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  canCreateConnection(teamId, projectId) {
    let limitations;
    return this.getLimitations(teamId)
      .then((resp) => {
        limitations = resp;

        return db.Connection.count({ where: { project_id: projectId } });
      })
      .then((count) => {
        if (limitations.connections === "unlimited") {
          return new Promise(resolve => resolve(true));
        }
        if (count + 1 > limitations.connections) {
          return new Promise(resolve => resolve(false));
        }

        return new Promise(resolve => resolve(true));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  canCreateProject(teamId) {
    let limitations;
    return this.getLimitations(teamId)
      .then((resp) => {
        limitations = resp;

        return db.Project.count({ where: { team_id: teamId } });
      })
      .then((count) => {
        if (limitations.projects === "unlimited") {
          return new Promise(resolve => resolve(true));
        }
        if (count + 1 > limitations.projects) {
          return new Promise(resolve => resolve(false));
        }

        return new Promise(resolve => resolve(true));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  canChangeAutoUpdate(chartId, autoUpdate) {
    return db.Chart.findOne({ where: { id: chartId } })
      .then((chart) => {
        return db.Project.findOne({ where: { id: chart.project_id } });
      })
      .then((project) => {
        return this.getLimitations(project.team_id);
      })
      .then((limitations) => {
        if (!limitations.autoRefresh || autoUpdate < limitations.autoRefresh) {
          return new Promise(resolve => resolve(false));
        }

        return new Promise(resolve => resolve(true));
      });
  }

  canUseTheData(projectId, objSize) {
    return db.Project.findOne({ where: { id: projectId } })
      .then((project) => {
        return this.getLimitations(project.team_id);
      })
      .then((limitations) => {
        if (limitations.querySize < objSize) {
          return new Promise(resolve => resolve(false));
        }

        return new Promise(resolve => resolve(true));
      });
  }

  getLimitations(teamId) {
    return this.teamController.getTeamPlan(teamId)
      .then((subscription) => {
        if (!subscription.plan) throw new Error("Cannot get the team's plan");
        const limitations = settings.features[subscription.plan.nickname.toLowerCase()];
        return new Promise(resolve => resolve(limitations));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = LimitationController;
