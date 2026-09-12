const _ = require("lodash");

const db = require("../../models/models");
const { createTemplateCharts } = require("../createTemplateCharts");

module.exports = async (teamId, projectId, {
  template_id, charts, connections, newDatasets
}) => {
  const { model } = await db.Template.findByPk(template_id);

  const newModelDatasets = {};

  const createDatasets = async (datasets, index) => {
    if (index >= datasets.length) return "done";

    const original = datasets[index];
    const ogDataset = await db.Dataset.findOne({
      where: { id: original },
      include: [{
        model: db.DataRequest,
      }],
    });

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

  if (charts && Array.isArray(charts)) {
    const newModelCharts = [];
    model.Charts.forEach((chart) => {
      if (_.indexOf(charts, chart.tid) > -1) {
        newModelCharts.push(chart);
      }
    });

    model.Charts = newModelCharts;
  }

  if (model?.Variables?.length > 0) {
    model.Variables.forEach((variable) => {
      const newVariable = { ...variable, project_id: projectId };
      delete newVariable.id;
      db.Variable.create(newVariable);
    });
  }

  return createTemplateCharts(model.Charts, projectId, newModelDatasets);
};
