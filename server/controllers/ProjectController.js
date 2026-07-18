const { cloneDeep } = require("lodash");

const db = require("../models/models");
const TeamController = require("./TeamController");
const templateModels = require("../templates");
const { snapDashboard } = require("../modules/snapshots");
const { normalizeProjectScheduleTimezones } = require("../modules/projectSnapshotTimezone");
const { hashProjectPassword, verifyProjectPassword } = require("../modules/projectPassword");
const {
  signLegacyShareToken,
  signShareToken,
  validateShareTokenPolicy,
  verifyShareToken,
} = require("../modules/shareToken");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const PROJECT_UPDATE_FIELDS = new Set([
  "name",
  "brewName",
  "dashboardTitle",
  "description",
  "backgroundColor",
  "titleColor",
  "headerCode",
  "footerCode",
  "logo",
  "logoLink",
  "public",
  "passwordProtected",
  "password",
  "timezone",
  "ghost",
  "updateSchedule",
  "snapshotSchedule",
  "lastUpdatedAt",
  "lastSnapshotSentAt",
  "currentSnapshot",
]);

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
          attributes: ["showBranding", "allowReportExport", "allowReportRefresh"],
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

  create(userId, data, options = {}) {
    let newProject = {};
    const { transaction } = options;

    return db.Project.create(data, { transaction })
      .then((project) => {
        newProject = project;
        return this.updateProjectRole(project.id, userId, "teamOwner", options);
      })
      .then(() => {
        const brewName = `${newProject.name.replace(/[\W_]+/g, "_")}_${newProject.id}`;
        if (transaction) {
          return db.Project.update({ brewName }, { where: { id: newProject.id }, transaction });
        }

        return this.update(newProject.id, { brewName });
      })
      .then(() => {
        // now update the projects access in TeamRole
        return this.teamController.addProjectAccess(data.team_id, userId, newProject.id, options);
      })
      .then(() => {
        return this.teamController.addProjectAccessToOwner(data.team_id, newProject.id, options);
      })
      .then(() => {
        if (transaction) {
          return db.Project.findOne({
            where: { id: newProject.id },
            transaction,
          });
        }

        return this.findById(newProject.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    const normalizedFields = normalizeProjectScheduleTimezones(data);
    const newFields = Object.fromEntries(
      Object.entries(normalizedFields).filter(([field]) => PROJECT_UPDATE_FIELDS.has(field))
    );
    return this.findById(id)
      .then(async () => {
        if (Object.prototype.hasOwnProperty.call(newFields, "password")) {
          newFields.password = await hashProjectPassword(newFields.password);
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

  updateProjectRole(projectId, userId, role, options = {}) {
    const { transaction } = options;

    return db.ProjectRole.findOne({
      where: {
        project_id: projectId,
        user_id: userId,
      },
      transaction,
    })
      .then((projectRole) => {
        if (projectRole) {
          projectRole.setDataValue("role", role);
          return projectRole.save({ transaction });
        }

        return db.ProjectRole.create({
          project_id: projectId,
          user_id: userId,
          role,
        }, { transaction });
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
        // now refresh all the charts in the background
        // with a slight delay to make sure the CDCs are created
        setTimeout(() => {
          const ChartController = require("./ChartController"); // eslint-disable-line
          const chartController = new ChartController();
          if (result?.length > 0) {
            result.forEach((chart) => {
              const createdChart = chart.dataValues;
              chartController.updateChartData(createdChart.id, null, {
                noSource: false,
                skipParsing: false,
                getCache: false,
              }).catch(() => null);
            });
          }
        }, 2000);
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
    const newFields = Object.fromEntries(
      Object.entries(data).filter(([field]) => field === "name")
    );
    return db.Variable.create({ ...newFields, project_id: projectId })
      .then((variable) => {
        return variable;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  updateVariable(projectId, variableId, data) {
    const newFields = Object.fromEntries(
      Object.entries(data).filter(([field]) => field === "name")
    );
    return db.Variable.update(
      newFields,
      { where: { id: variableId, project_id: projectId } }
    )
      .then(([updated]) => {
        if (!updated) return null;
        return db.Variable.findOne({ where: { id: variableId, project_id: projectId } });
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  deleteVariable(projectId, variableId) {
    return db.Variable.destroy({ where: { id: variableId, project_id: projectId } })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  async takeSnapshot(projectId, options) {
    const project = await this.findById(projectId);
    return snapDashboard(project, options);
  }

  createDashboardFilter(projectId, data) {
    const newFields = Object.fromEntries(
      Object.entries(data).filter(([field]) => ["configuration", "onReport"].includes(field))
    );
    return db.DashboardFilter.create({
      ...newFields,
      project_id: projectId,
    })
      .then((dashboardFilter) => {
        return dashboardFilter;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  getDashboardFilter(projectId, dashboardFilterId) {
    return db.DashboardFilter.findOne({
      where: { id: dashboardFilterId, project_id: projectId },
    })
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

  updateDashboardFilter(projectId, dashboardFilterId, data) {
    const newFields = Object.fromEntries(
      Object.entries(data).filter(([field]) => ["configuration", "onReport"].includes(field))
    );
    return db.DashboardFilter.update(newFields, {
      where: { id: dashboardFilterId, project_id: projectId },
    })
      .then(([updated]) => {
        if (!updated) return null;
        return this.getDashboardFilter(projectId, dashboardFilterId);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  deleteDashboardFilter(projectId, dashboardFilterId) {
    return db.DashboardFilter.destroy({
      where: { id: dashboardFilterId, project_id: projectId },
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
    // Find the specific share policy if policy ID is provided, otherwise find the first one
    let sharePolicy;
    if (data?.sharePolicyId) {
      sharePolicy = await db.SharePolicy.findByPk(data.sharePolicyId);
    } else {
      sharePolicy = await db.SharePolicy.findOne({
        where: {
          entity_type: "Project",
          entity_id: projectId,
        },
      });
    }

    if (!sharePolicy) {
      return Promise.reject("Share policy not found");
    }

    if (sharePolicy.entity_type !== "Project" || `${sharePolicy.entity_id}` !== `${projectId}`) {
      return Promise.reject("Share policy not found");
    }

    const preserveLegacyToken = data?.preserveLegacy === true && sharePolicy.token_version < 2;
    const policyUpdates = {
      ...(data?.share_policy || {}),
      ...(!preserveLegacyToken ? { token_version: 2 } : {}),
    };

    if (data?.share_policy || (!preserveLegacyToken && sharePolicy.token_version < 2)) {
      await db.SharePolicy.update({
        ...policyUpdates,
      }, { where: { id: sharePolicy.id } });
      // Refresh the sharePolicy to get updated data
      sharePolicy = await db.SharePolicy.findByPk(sharePolicy.id);
    }

    const payload = {
      version: preserveLegacyToken ? 1 : 2,
      sub: { type: "Project", id: projectId, sharePolicyId: sharePolicy.id },
    };

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

    const token = preserveLegacyToken
      ? signLegacyShareToken(payload, { expiresIn })
      : signShareToken(payload, { expiresIn });

    // Use the SharePolicy's share_string for the URL
    const project = await this.findById(projectId);
    const url = `${settings.client}/report/${project.brewName}?token=${token}`;

    return { token, url, sharePolicy };
  }

  /**
   * Extract variables from query parameters, excluding special parameters
   * @param {Object} queryParams - The query parameters object
   * @returns {Object} - Object containing extracted variables
   */
  _extractVariablesFromQuery(queryParams) {
    const variables = {};
    const specialParams = ["token", "accessToken", "theme", "pass", "removeStyling", "removeHeader"];

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
   * Find a project by share policy
   * @param {string} brewName - The brew name of the project
   * @param {Object} queryParams - The query parameters
   * @returns {Promise<Object>} - The processed project data
   */
  async findBySharePolicy(brewName, password, queryParams, user) {
    if (!queryParams.token && !user?.id) {
      return Promise.reject("Token is missing");
    }

    const project = await db.Project.findOne({ where: { brewName } });
    if (!project) {
      return Promise.reject("Project not found");
    }

    let overridePolicy = false;
    // check if we get a team member from the token
    if (user?.id) {
      // now determine whether to show the dashboard or not
      const teamRole = await db.TeamRole.findOne({
        where: {
          team_id: project.team_id,
          user_id: user?.id,
        }
      });

      const hasProjectAccess = teamRole?.projects?.includes(project.id);

      if (
        teamRole
      && (
        teamRole.role === "teamOwner"
        || teamRole.role === "teamAdmin"
        || hasProjectAccess
      )
      ) {
        overridePolicy = true;
      }
    }

    // Handle variable filtering based on share policy
    const urlVariables = this._extractVariablesFromQuery(queryParams);
    let finalVariables = {};

    if (!overridePolicy) {
      // Check if the token from the query parameters is valid
      const decodedToken = verifyShareToken(queryParams.token);
      if (!decodedToken?.sub?.sharePolicyId) {
        return Promise.reject("Invalid token");
      }

      const sharePolicy = await db.SharePolicy.findByPk(decodedToken.sub.sharePolicyId);
      if (!sharePolicy) {
        return Promise.reject("Share policy not found");
      }

      validateShareTokenPolicy(decodedToken, sharePolicy, "Project", project.id);

      // Check if the project is public (required for SharePolicy access)
      if (!project.public) {
        return Promise.reject("Project is not public");
      }

      // Handle password protection
      if (project.passwordProtected) {
        const isPasswordCorrect = await verifyProjectPassword(password, project.password);
        if (!isPasswordCorrect) {
          return Promise.reject("403");
        }
      }

      finalVariables = this._mergeVariablesWithPolicy(urlVariables, sharePolicy);
    }

    const report = await this.getPublicDashboard(project.brewName);

    // Process the project for public access
    const processedProject = cloneDeep(report);
    processedProject.setDataValue("password", "");

    // Apply variables to the charts if needed
    if (Object.keys(finalVariables).length > 0) {
      try {
        const updatedProject = await this.applyVariablesToCharts(processedProject, finalVariables);
        return updatedProject;
      } catch (error) {
        // If variable application fails, return the project without variables
        // oxlint-disable-next-line no-console
        console.error("Failed to apply variables to dashboard:", error);
        return processedProject;
      }
    }

    return processedProject;
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
