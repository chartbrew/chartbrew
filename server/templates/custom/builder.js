const db = require("../../models/models");
const { remapVisualizationBindings } = require("../../visualization/remapBindings");

module.exports = async (teamId, projectId, {
  template_id, charts, connections = {}, newDatasets
}) => {
  const template = await db.Template.findOne({ where: { id: template_id, team_id: teamId } });
  if (!template) throw new Error("403");

  const { model } = template;
  const selectedCharts = Array.isArray(charts)
    ? model.Charts.filter((chart) => charts.includes(chart.tid))
    : model.Charts;
  const datasetIds = [...new Set([
    ...model.Datasets.map((dataset) => dataset.id),
    ...selectedCharts.flatMap((chart) => (chart.ChartDatasetConfigs || []).map((config) => config.dataset_id)),
  ])];
  const datasets = await db.Dataset.findAll({
    where: { id: datasetIds, team_id: teamId },
    include: [{ model: db.DataRequest }],
  });
  if (datasets.length !== datasetIds.length) throw new Error("403");

  const connectionIds = [...new Set(datasets.flatMap((dataset) => dataset.DataRequests.map((request) => (
    newDatasets ? connections[request.connection_id] : request.connection_id
  ))))];
  if (connectionIds.some((id) => !id)) throw new Error("403");
  const connectionCount = await db.Connection.count({ where: { id: connectionIds, team_id: teamId } });
  if (connectionCount !== connectionIds.length) throw new Error("403");

  const newModelDatasets = {};

  const createDatasets = async (datasets, index) => {
    if (index >= datasets.length) return "done";

    const original = datasets[index];
    const ogDataset = await db.Dataset.findOne({
      where: { id: original, team_id: teamId },
      include: [{ model: db.DataRequest }],
    });
    if (!ogDataset) throw new Error("403");

    const dataRequests = ogDataset.DataRequests.map((dr) => dr.toJSON());

    const ogJsonDataset = ogDataset.toJSON();

    const newDataset = {
      ...ogJsonDataset,
      team_id: teamId,
      project_ids: [parseInt(projectId, 10)],
      draft: false,
    };
    delete newDataset.main_dr_id;
    delete newDataset.id;
    delete newDataset.DataRequests;
    delete newDataset.createdAt;
    delete newDataset.updatedAt;

    const newDatasetSave = await db.Dataset.create(newDataset);
    newModelDatasets[original] = newDatasetSave.id;

    if (dataRequests?.length > 0) {
      const newRequests = [];
      dataRequests.forEach((request) => {
        const newRequest = { ...request, dataset_id: newDatasetSave.id };
        delete newRequest.id;
        newRequest.connection_id = connections[request.connection_id];
        newRequests.push(newRequest);
      });

      await db.DataRequest.bulkCreate(newRequests);
    }

    return createDatasets(datasets, index + 1);
  };

  if (newDatasets) {
    const datasetIds = [];
    model.Datasets.forEach((dataset) => {
      datasetIds.push(dataset.id);
    });

    await createDatasets(datasetIds, 0);
  }

  model.Charts = selectedCharts;

  const createChart = async (chart) => {
    try {
      const sourceConfigs = chart.ChartDatasetConfigs || [];
      const chartData = { ...chart };
      delete chartData.ChartDatasetConfigs;
      const createdChart = await db.Chart.create(chartData);
      const createdConfigs = await Promise.all(sourceConfigs.map((cdc) => {
        const newCdc = { ...cdc, chart_id: createdChart.id };
        if (newModelDatasets[cdc.dataset_id]) {
          newCdc.dataset_id = newModelDatasets[cdc.dataset_id];
        }
        delete newCdc.bindingId;
        delete newCdc.id;
        delete newCdc.templateBindingId;
        return db.ChartDatasetConfig.create(newCdc);
      }));

      if (chart.visualization && createdConfigs.length > 0) {
        await createdChart.update({
          visualization: remapVisualizationBindings(
            chart.visualization,
            sourceConfigs,
            createdConfigs
          ),
        });
      }
      return createdChart;
    } catch (error) {
      return error;
    }
  };

  const chartPromises = [];
  model.Charts.forEach((chart) => {
    const newChart = { ...chart, project_id: projectId };
    delete newChart.id;
    chartPromises.push(createChart(newChart));
  });

  if (model?.Variables?.length > 0) {
    model.Variables.forEach((variable) => {
      const newVariable = { ...variable, project_id: projectId };
      delete newVariable.id;
      db.Variable.create(newVariable);
    });
  }

  return Promise.all(chartPromises);
};
