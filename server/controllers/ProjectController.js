const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");

const db = require("../models/models");
const TeamController = require("./TeamController");
const templateModels = require("../templates");
const { snapDashboard } = require("../modules/snapshots");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

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
        }, {
          model: db.DashboardFilter,
        }, {
          model: db.SharePolicy,
        }
      ],
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
        },
        {
          model: db.DashboardFilter,
          where: {
            onReport: true,
          },
          required: false,
        },
        {
          model: db.SharePolicy,
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

  async applyVariablesToCharts(project, variables) {
    if (!variables || Object.keys(variables).length === 0) {
      return project;
    }

    const ChartController = require("./ChartController"); // eslint-disable-line
    const chartController = new ChartController();

    // Apply variables to each chart
    const promises = [];
    project.Charts.forEach((chart) => {
      promises.push(
        chartController.updateChartData(
          chart.id,
          null, // no user for public dashboards
          {
            noSource: false,
            skipParsing: false,
            variables,
            getCache: false,
            skipSave: true, // Don't save to database, just return filtered data
          }
        ).catch(() => chart) // Return original chart if update fails
      );
    });

    const updatedCharts = await Promise.all(promises);

    // Replace the original charts with updated ones
    const updatedProject = { ...project.toJSON() };
    updatedProject.Charts = updatedCharts;

    return updatedProject;
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

  async takeSnapshot(projectId, options) {
    const project = await this.findById(projectId);
    return snapDashboard(project, options);
  }

  createDashboardFilter(projectId, data) {
    return db.DashboardFilter.create({
      ...data,
      project_id: projectId,
    })
      .then((dashboardFilter) => {
        return dashboardFilter;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  getDashboardFilter(dashboardFilterId) {
    return db.DashboardFilter.findByPk(dashboardFilterId)
      .then((dashboardFilter) => {
        return dashboardFilter;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  getDashboardFilters(projectId) {
    return db.DashboardFilter.findAll({
      where: { project_id: projectId },
      order: [["createdAt", "DESC"]],
    })
      .then((dashboardFilters) => {
        return dashboardFilters;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  updateDashboardFilter(dashboardFilterId, data) {
    return db.DashboardFilter.update(data, { where: { id: dashboardFilterId } })
      .then(() => {
        return this.getDashboardFilter(dashboardFilterId);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  deleteDashboardFilter(dashboardFilterId) {
    return db.DashboardFilter.destroy({ where: { id: dashboardFilterId } })
      .then(() => {
        return { removed: true };
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  async createSharePolicy(projectId) {
    return db.SharePolicy.create({
      entity_type: "Project",
      entity_id: projectId,
      visibility: "private",
    });
  }

  async generateShareToken(projectId, data) {
    const sharePolicy = await db.SharePolicy.findOne({
      where: {
        entity_type: "Project",
        entity_id: projectId,
      },
    });

    if (!sharePolicy) {
      return Promise.reject("Share policy not found");
    }

    const payload = {
      sub: { type: "Project", id: projectId },
    };

    if (data?.share_policy) {
      await db.SharePolicy.update(data.share_policy, { where: { id: sharePolicy.id } });
    }

    let expiresIn = "99999d";
    if (data?.exp) {
      const expDate = new Date(data.exp);
      const now = new Date();
      const diffMs = expDate - now;
      if (diffMs > 0) {
        expiresIn = `${Math.floor(diffMs / 1000)}s`;
      } else {
        // If expiration is in the past, set to 0s (immediate expiry)
        expiresIn = "0s";
      }
    }

    const token = jwt.sign(payload, settings.encryptionKey, { expiresIn });

    const project = await this.findById(projectId);
    const url = `${settings.client}/b/${project.brewName}?accessToken=${token}`;

    return { token, url };
  }

  /**
   * Extract variables from query parameters, excluding special parameters
   * @param {Object} queryParams - The query parameters object
   * @returns {Object} - Object containing extracted variables
   */
  _extractVariablesFromQuery(queryParams) {
    const variables = {};
    const specialParams = ["accessToken", "theme", "pass", "removeStyling", "removeHeader"];

    if (queryParams && typeof queryParams === "object") {
      Object.keys(queryParams).forEach((key) => {
        // Handle field filters like fields[field_name]
        if (key.startsWith("fields[")) {
          let field = key.replace("fields[", "");
          field = field.substring(0, field.length - 1);
          if (!field.includes("root[].")) {
            field = `root[].${field}`;
          }
          variables[`__field_${field}`] = queryParams[key];
        } else if (!specialParams.includes(key)) {
          variables[key] = queryParams[key];
        }
      });
    }

    return variables;
  }

  /**
   * Merge URL variables with share policy variables based on policy rules
   * @param {Object} urlVariables - Variables extracted from URL
   * @param {Object} sharePolicy - The share policy object
   * @returns {Object} - Final variables to be used
   */
  _mergeVariablesWithPolicy(urlVariables, sharePolicy) {
    const finalVariables = {};

    // Start with policy parameters if they exist
    if (sharePolicy?.params && Array.isArray(sharePolicy.params)) {
      sharePolicy.params.forEach((param) => {
        if (param.key && param.value) {
          finalVariables[param.key] = param.value;
        }
      });
    }

    // If URL parameters are allowed, merge them with policy variables
    if (sharePolicy?.allow_params && Object.keys(urlVariables).length > 0) {
      // URL variables override policy variables if allow_params is true
      Object.assign(finalVariables, urlVariables);
    }
    // If URL parameters are not allowed, only use policy variables (already set above)

    return finalVariables;
  }
}

module.exports = ProjectController;
