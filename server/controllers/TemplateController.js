const db = require("../models/models");
const { remapVisualizationBindings } = require("../visualization/remapBindings");

const chartAttributeExcludes = ["id", "project_id", "chartData", "createdAt", "updatedAt", "lastAutoUpdate", "chartDataUpdated"];
const chartDatasetConfigAttributeExcludes = ["chart_id", "createdAt", "updatedAt"];

const toPlainObject = (record) => {
  if (!record) return record;
  return record.toJSON ? record.toJSON() : { ...record };
};

const sanitizeTemplateChart = (chart, tid) => {
  const safeChart = toPlainObject(chart);
  safeChart.tid = tid;
  const sourceConfigs = safeChart.ChartDatasetConfigs || [];
  const templateConfigs = sourceConfigs.map((config, index) => {
    const safeConfig = { ...config };
    delete safeConfig.Dataset;
    safeConfig.templateBindingId = `binding-${index + 1}`;
    delete safeConfig.id;
    return safeConfig;
  });
  safeChart.ChartDatasetConfigs = templateConfigs;
  if (safeChart.visualization) {
    safeChart.visualization = remapVisualizationBindings(
      safeChart.visualization,
      sourceConfigs,
      templateConfigs.map((config) => ({ id: config.templateBindingId }))
    );
  }

  return safeChart;
};

const sanitizeTemplateDataset = (dataset) => {
  const safeDataset = toPlainObject(dataset);
  delete safeDataset.DataRequests;
  return safeDataset;
};

const sanitizeTemplateConnection = (connection) => {
  const {
    id, type, subType, name,
  } = toPlainObject(connection);
  return {
    id,
    type,
    subType,
    name,
  };
};

module.exports.findById = (id) => {
  return db.Template.findByPk(id);
};

module.exports.find = (condition) => {
  return db.Template.findAll({
    where: condition,
    order: [["createdAt", "DESC"]],
  });
};

module.exports.update = (id, data) => {
  return db.Template.update(data, { where: { id } })
    .then(() => this.findById(id));
};

module.exports.create = (teamId, data) => {
  return db.Template.create({ team_id: teamId, model: data.model, name: data.name })
    .then((template) => this.findById(template.id));
};

module.exports.delete = (id) => {
  return db.Template.destroy({ where: { id } });
};

module.exports.getDashboardModel = async (projectId, teamId = null) => {
  const projectWhere = { id: projectId };
  if (teamId !== null && teamId !== undefined) {
    projectWhere.team_id = teamId;
  }

  const project = await db.Project.findOne({
    where: projectWhere,
    include: [{
      model: db.Variable,
    }],
  });

  if (!project) {
    throw new Error("404");
  }

  const charts = await db.Chart.findAll({
    where: { project_id: projectId },
    attributes: { exclude: chartAttributeExcludes },
    include: [{
      model: db.ChartDatasetConfig,
      attributes: { exclude: chartDatasetConfigAttributeExcludes },
      include: [{
        model: db.Dataset,
        include: [{
          model: db.DataRequest,
          attributes: ["id", "connection_id"],
          include: [{
            model: db.Connection,
            attributes: ["id", "type", "subType", "name"],
          }],
        }],
      }],
    }],
  });

  const datasets = new Map();
  const connections = new Map();

  const templateCharts = charts.map((chart, dIndex) => {
    chart.ChartDatasetConfigs.forEach((config) => {
      if (config.Dataset && !datasets.has(config.Dataset.id)) {
        datasets.set(config.Dataset.id, sanitizeTemplateDataset(config.Dataset));
      }

      config.Dataset?.DataRequests?.forEach((dataRequest) => {
        if (dataRequest.Connection && !connections.has(dataRequest.Connection.id)) {
          connections.set(
            dataRequest.Connection.id,
            sanitizeTemplateConnection(dataRequest.Connection)
          );
        }
      });
    });

    return sanitizeTemplateChart(chart, dIndex);
  });

  return {
    Charts: templateCharts,
    Connections: Array.from(connections.values()),
    Datasets: Array.from(datasets.values()),
    Variables: (project.Variables || []).map((variable) => toPlainObject(variable)),
  };
};
