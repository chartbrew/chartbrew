const mongoose = require("mongoose");
const moment = require("moment");
const Sequelize = require("sequelize");
const { nanoid } = require("nanoid");
const { v4: uuid } = require("uuid");

const externalDbConnection = require("../modules/externalDbConnection");

const db = require("../models/models");
const DatasetController = require("./DatasetController");
const ConnectionController = require("./ConnectionController");
const DataRequestController = require("./DataRequestController");
const ChartCacheController = require("./ChartCacheController");
const dataExtractor = require("../charts/DataExtractor");
const { snapChart } = require("../modules/snapshots");

// charts
const AxisChart = require("../charts/AxisChart");
const TableView = require("../charts/TableView");

class ChartController {
  constructor() {
    this.connectionController = new ConnectionController();
    this.datasetController = new DatasetController();
    this.dataRequestController = new DataRequestController();
    this.chartCache = new ChartCacheController();
  }

  create(data, user) {
    return db.Chart.create({ ...data, chartDataUpdated: moment() })
      .then((chart) => {
        // delete chart cache
        if (user) {
          this.chartCache.remove(user.id, chart.id);
        }

        return this.findById(chart.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findAll(conditions = {}) {
    return db.Chart.findAll(conditions)
      .then((charts) => {
        return new Promise((resolve) => resolve(charts));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByProject(projectId) {
    return db.Chart.findAll({
      where: { project_id: parseInt(projectId, 10) },
      order: [["dashboardOrder", "ASC"], [db.ChartDatasetConfig, "order", "ASC"]],
      include: [
        { model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] },
        { model: db.Chartshare },
        { model: db.Alert },
      ],
    })
      .then((charts) => {
        return charts;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findById(id, customQuery) {
    const query = {
      where: { id },
      include: [
        { model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] },
        { model: db.Chartshare },
        { model: db.Alert },
      ],
      order: [[db.ChartDatasetConfig, "order", "ASC"]],
    };

    return db.Chart.findOne(customQuery || query)
      .then((chart) => {
        return chart;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data, user, justUpdates) {
    if (data.autoUpdate || data.autoUpdate === 0) {
      return db.Chart.update(data, {
        where: { id },
        attributes: { exclude: ["chartData"] },
      })
        .then(() => {
          const updatePromises = [];

          if (data.ChartDatasets || data.dataRequests) {
            if (data.ChartDatasets) {
              updatePromises
                .push(this.updateDatasets(id, data.ChartDatasets));
            }
            if (data.dataRequests) {
              data.dataRequests.forEach((dataRequest) => {
                if (dataRequest.id) {
                  updatePromises
                    .push(this.dataRequestController.update(dataRequest.id, dataRequest));
                }
              });
            }

            return Promise.all(updatePromises).then(() => this.findById(id));
          } else {
            return this.findById(id);
          }
        })
        .catch((error) => {
          return new Promise((resolve, reject) => reject(error));
        });
    }

    return db.Chart.update(data, {
      where: { id },
    })
      .then(() => {
        // clear chart cache
        if (user) {
          this.chartCache.remove(user.id, id);
        }

        const updatePromises = [];
        if (data.ChartDatasetConfigs || data.dataRequests) {
          if (data.ChartDatasetConfigs) {
            const datasetsToUpdate = [];
            for (const dataset of data.ChartDatasetConfigs) {
              if (!dataset.deleted && !dataset.id) {
                dataset.chart_id = id;
                updatePromises.push(this.datasetController.create(dataset));
              } else if (!dataset.deleted && dataset.id) {
                datasetsToUpdate.push(dataset);
              }
            }

            if (datasetsToUpdate.length > 0) {
              updatePromises
                .push(this.updateDatasets(id, data.ChartDatasetConfigs));
            }
          }
          if (data.dataRequests) {
            data.dataRequests.forEach((dataRequest) => {
              if (dataRequest.id) {
                updatePromises
                  .push(this.dataRequestController.update(data.dataRequest.id, data.dataRequest));
              }
            });
          }

          if (data.dataRequests) {
            data.dataRequests.forEach((dataRequest) => {
              if (!dataRequest.id) {
                const newDataRequest = { ...data.dataRequest, chart_id: id };
                updatePromises.push(this.dataRequestController.create(newDataRequest));
              }
            });
          }

          return Promise.all(updatePromises).then(() => this.findById(id));
        } else if (justUpdates) {
          return this.findById(id, {
            where: { id },
            attributes: ["id"].concat(Object.keys(data)),
          });
        } else {
          return this.findById(id);
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  addConnection(chartId, connection) {
    return db.Chart.findByPk(chartId)
      .then((chart) => {
        return chart.addConnections([connection]);
      })
      .then((chart) => {
        return this.findById(chart.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateDatasets(chartId, datasets) {
    const updatePromises = [];
    for (const dataset of datasets) {
      if (dataset.id && !dataset.deleted) {
        if (parseInt(dataset.chart_id, 10) === parseInt(chartId, 10)) {
          updatePromises.push(this.datasetController.update(dataset.id, dataset));
        }
      } else if (dataset.id && dataset.deleted) {
        updatePromises.push(this.datasetController.remove(dataset.id));
      } else if (!dataset.id && !dataset.deleted) {
        dataset.chart_id = chartId;
        updatePromises.push(this.datasetController.create(dataset));
      }
    }

    return Promise.all(updatePromises)
      .then(() => {
        return this.findById(chartId);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  changeDashboardOrder(selectedId, otherId) {
    let selectedChart;
    return this.findById(selectedId)
      .then((chart) => {
        selectedChart = chart;

        if (otherId === "top") {
          return db.Chart.findAll({
            limit: 1,
            order: [["dashboardOrder", "ASC"]],
          });
        }

        if (otherId === "bottom") {
          return db.Chart.findAll({
            limit: 1,
            order: [["dashboardOrder", "DESC"]],
          });
        }

        return this.findById(otherId);
      })
      .then((other) => {
        const updatePromises = [];
        let otherChart = other;
        if (otherId === "top") {
          [otherChart] = other;
          updatePromises.push(
            this.update(selectedId, {
              dashboardOrder: otherChart.dashboardOrder - 1,
            }),
          );
        } else if (otherId === "bottom") {
          [otherChart] = other;
          updatePromises.push(
            this.update(selectedId, {
              dashboardOrder: otherChart.dashboardOrder + 1,
            }),
          );
        } else {
          updatePromises.push(this.update(selectedId, {
            dashboardOrder: otherChart.dashboardOrder,
          }));
          updatePromises.push(this.update(otherChart.id, {
            dashboardOrder: selectedChart.dashboardOrder,
          }));
        }

        return Promise.all(updatePromises);
      })
      .then((values) => {
        return values;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id) {
    return db.Chart.destroy({ where: { id } })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateChartData(id, user, {
    noSource, skipParsing, filters, isExport, getCache, variables,
  }) {
    let gChart;
    let gCache;
    let gChartData;
    let skipCache = false;
    let project;
    return this.findById(id)
      .then(async (chart) => {
        gChart = chart;
        if (!chart || !chart.ChartDatasetConfigs || chart.ChartDatasetConfigs.length === 0) {
          return new Promise((resolve, reject) => reject("The chart doesn't have any datasets"));
        }

        if (chart.project_id) {
          project = await db.Project.findByPk(chart.project_id);
        }

        if (!user) {
          skipCache = true;
          return new Promise((resolve) => resolve(false));
        }

        return this.chartCache.findLast(user.id, chart.id);
      })
      .then((cache) => {
        if (!skipCache) {
          gCache = cache;
        }

        // Merge CDC configuration variables with the provided variables
        // Existing variables take precedence over CDC configuration values
        const mergedVariables = { ...variables };

        if (gChart.ChartDatasetConfigs && gChart.ChartDatasetConfigs.length > 0) {
          gChart.ChartDatasetConfigs.forEach((cdc) => {
            if (cdc.configuration && cdc.configuration.variables) {
              cdc.configuration.variables.forEach((configVar) => {
                // Only use CDC value if no value already exists in variables
                if (mergedVariables[configVar.name] === undefined
                    || mergedVariables[configVar.name] === null
                    || mergedVariables[configVar.name] === "") {
                  mergedVariables[configVar.name] = configVar.value;
                }
              });
            }
          });
        }

        const requestPromises = [];
        gChart.ChartDatasetConfigs.forEach((cdc) => {
          if (noSource && gCache && gCache.data) {
            requestPromises.push(
              this.datasetController.runRequest({
                dataset_id: cdc.Dataset.id,
                chart_id: gChart.id,
                noSource: true,
                getCache,
                variables: mergedVariables,
              })
            );
          } else {
            requestPromises.push(
              this.datasetController.runRequest({
                dataset_id: cdc.Dataset.id,
                chart_id: gChart.id,
                noSource: false,
                getCache,
                filters,
                timezone: project.timezone,
                variables: mergedVariables,
              })
            );
          }
        });
        return Promise.all(requestPromises);
      })
      .then(async (datasets) => {
        const resolvingData = {
          chart: gChart,
          datasets,
        };

        // change the datasets data if the cache is called
        if (!skipCache && noSource === true && gCache && gCache.data && gCache.data.datasets) {
          resolvingData.datasets = gCache.data.datasets.map((item) => {
            const tempItem = item;
            for (let i = 0; i < datasets.length; i++) {
              if (item.options.id === datasets[i].options.id) {
                tempItem.options = datasets[i].options;
                break;
              }
            }
            return tempItem;
          });
        } else if (!skipCache && user?.id) {
          // console.log("resolvingData", JSON.stringify(resolvingData, null, 4));
          // create a new cache for the data that was fetched
          this.chartCache.create(user.id, gChart.id, resolvingData);
        }

        return Promise.resolve(resolvingData);
      })
      .then((chartData) => {
        if (isExport) {
          return dataExtractor(chartData, filters, project?.timezone);
        }

        if (gChart.type === "table") {
          const extractedData = dataExtractor(chartData, filters, project?.timezone);
          const tableView = new TableView();
          return tableView.getTableData(extractedData, chartData, project?.timezone);
        }

        let reallySkipParsing = skipParsing;
        if (!chartData?.chart?.chartData) {
          reallySkipParsing = false;
        }

        const axisChart = new AxisChart(chartData, project?.timezone);

        return axisChart.plot(reallySkipParsing, filters, variables);
      })
      .then(async (chartData) => {
        gChartData = chartData;

        if ((filters && filters.length > 0) || isExport) {
          return filters;
        }

        // update the datasets if needed
        const datasetsPromises = [];
        if (chartData.conditionsOptions) {
          chartData.conditionsOptions.forEach((opt) => {
            if (opt.dataset_id) {
              const cdc = gChart.ChartDatasetConfigs.find((d) => d.dataset_id === opt.dataset_id);
              const dataset = cdc?.Dataset;
              if (dataset?.conditions) {
                const newConditions = dataset.conditions.map((c) => {
                  const optCondition = opt.conditions.find((o) => o.field === c.field);
                  let values = (optCondition && optCondition.values) || [];
                  values = optCondition?.hideValues ? [] : values.slice(0, 100);

                  return { ...c, values };
                });

                datasetsPromises.push(
                  db.Dataset.update(
                    { conditions: newConditions },
                    { where: { id: opt.dataset_id } }
                  )
                );
              }
            }
          });
        }

        await Promise.all(datasetsPromises);

        const updateData = { chartData: chartData.configuration };
        if (!getCache) {
          updateData.chartDataUpdated = moment();
        }

        return this.update(id, updateData);
      })
      .then(() => {
        if (filters && filters.length > 0 && !isExport) {
          const filteredChart = gChart;
          filteredChart.chartData = gChartData.configuration;
          return filteredChart;
        }

        if (isExport) {
          return gChartData.configuration;
        }

        return this.findById(id);
      })
      .then((chart) => {
        if (!isExport) {
          chart.setDataValue("isTimeseries", gChartData.isTimeseries);
          chart.setDataValue("dateFormat", gChartData.dateFormat);
        }
        return chart;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  runPostgresQuery(chart) {
    return this.connectionController.findById(chart.connection_id)
      .then((connection) => {
        return externalDbConnection(connection);
      })
      .then((db) => {
        return db.query(chart.query, { type: Sequelize.QueryTypes.SELECT });
      })
      .then((results) => {
        return this.getChartData(chart.id, results);
      })
      .then(() => {
        return this.findById(chart.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runRequest(chart) {
    return this.dataRequestController.sendRequest(chart.id, chart.connection_id)
      .then((data) => {
        return this.getChartData(chart.id, data);
      })
      .then(() => {
        return this.findById(chart.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runQuery(id) {
    let gChart;
    return this.findById(id)
      .then((chart) => {
        gChart = chart;
        return this.connectionController.getConnectionUrl(chart.connection_id);
      })
      .then((url) => {
        const options = {
          connectTimeoutMS: 30000,
        };
        return mongoose.connect(url, options);
      })
      .then(() => {
        return Function(`'use strict';return (mongoose) => mongoose.${gChart.query}.toArray()`)()(mongoose); // eslint-disable-line
      })
      // if array fails, check if it works with object (for example .findOne() return object)
      .catch(() => {
        return Function(`'use strict';return (mongoose) => mongoose.${gChart.query}`)()(mongoose); // eslint-disable-line
      })
      .then((data) => {
        return this.getChartData(gChart.getDataValue("id"), data);
      })
      .then(() => {
        return this.findById(gChart.getDataValue("id"));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  testMongoQuery({ connection_id, query }) {
    return this.connectionController.getConnectionUrl(connection_id)
      .then((url) => {
        const options = {
          connectTimeoutMS: 30000,
        };
        return mongoose.connect(url, options);
      })
      .then(() => {
        return Function(`'use strict';return (mongoose) => mongoose.${query}.toArray()`)()(mongoose); // eslint-disable-line
      })
      .then((data) => {
        return new Promise((resolve) => resolve(data));
      })
      .catch(() => {
        return Function(`'use strict';return (mongoose) => mongoose.${query}`)()(mongoose); // eslint-disable-line
      })
      .then((data) => {
        return new Promise((resolve) => resolve(data));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  testQuery(chart, projectId) {
    return this.connectionController.findById(chart.connection_id)
      .then((connection) => {
        if (connection.type === "mongodb") {
          return this.testMongoQuery(chart, projectId);
        } else if (connection.type === "postgres" || connection.type === "mysql") {
          return this.getPostgresData(chart, projectId, connection);
        } else {
          return new Promise((resolve, reject) => reject("The connection type is not supported"));
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getApiChartData(chart) {
    return this.connectionController.testDataRequest(chart)
      .then((data) => {
        return new Promise((resolve) => resolve(data));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getPostgresData(chart, projectId, connection) {
    return externalDbConnection(connection)
      .then((db) => {
        return db.query(chart.query, { type: Sequelize.QueryTypes.SELECT });
      })
      .then((results) => {
        return new Promise((resolve) => resolve(results));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getPreviewData(chart, projectId, user, noSource) {
    return this.chartCache.findLast(user.id, chart.id)
      .then((cache) => {
        if (noSource === "true") {
          return new Promise((resolve) => resolve(cache));
        }

        return this.connectionController.findById(chart.connection_id);
      })
      .then((connection) => {
        if (noSource === "true") {
          return new Promise((resolve) => resolve(connection));
        }

        if (connection.type === "mongodb") {
          return this.testQuery(chart, projectId);
        } else if (connection.type === "api") {
          return this.getApiChartData(chart, projectId);
        } else if (connection.type === "postgres" || connection.type === "mysql") {
          return this.getPostgresData(chart, projectId, connection);
        } else {
          return new Promise((resolve, reject) => reject("The connection type is not supported"));
        }
      })
      .then((data) => {
        const previewData = data;
        if (noSource !== "true" && user) {
          // cache, but do it async
          this.chartCache.create(user.id, chart.id, data);
        } else if (noSource) {
          return new Promise((resolve) => resolve(previewData.data));
        }

        return new Promise((resolve) => resolve(data));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  previewChart(chart, projectId, user, noSource) {
    return this.getPreviewData(chart, projectId, user, noSource)
      .then((data) => {
        if (chart.type === "table") {
          return dataExtractor(chart);
        }

        const axisChart = new AxisChart(data);
        return axisChart.plot();
      })
      .then((chartData) => {
        return new Promise((resolve) => resolve(chartData));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getChartData(id) {
    let gChartData;
    return this.findById(id)
      .then((chart) => {
        if (chart.type === "table") {
          return dataExtractor(chart);
        }

        const axisChart = new AxisChart(chart);
        return axisChart.plot();
      })
      .then((chartData) => {
        gChartData = chartData;
        return this.update(id, { chartData: gChartData, chartDataUpdated: moment() });
      })
      .then(() => {
        return new Promise((resolve) => resolve(gChartData));
      });
  }

  exportChartData(userId, chartIds, filters) {
    return db.Chart.findAll({
      where: { id: chartIds },
      include: [{ model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] }],
      order: [[db.ChartDatasetConfig, "order", "ASC"]],
    })
      .then((charts) => {
        const dataPromises = [];
        charts.forEach((chart) => {
          dataPromises.push(
            this.updateChartData(
              chart.id,
              { id: userId },
              {
                noSource: false,
                skipParsing: false,
                filters,
                isExport: true
              },
            )
              .then((data) => {
                // first, make sure the sheet name is no longer than 31 characters
                let sheetName = `${chart.name} - ${nanoid(5)}`;
                if (chart.name.length > 26) {
                  let newChartName = chart.name.substring(0, 23);
                  if (newChartName.lastIndexOf(" ") > 10) {
                    newChartName = newChartName.substring(0, newChartName.lastIndexOf(" "));
                  }
                  sheetName = `${newChartName} - ${nanoid(5)}`;
                }

                // remove any special characters
                sheetName = sheetName.replace(/[^a-zA-Z ]/g, "");

                return {
                  name: sheetName,
                  datasets: chart.ChartDatasetConfigs,
                  data,
                };
              })
          );
        });

        return Promise.all(dataPromises);
      })
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  async findByShareString(shareString, snapshot = false) {
    if (snapshot) {
      const chart = await db.Chart.findOne({ where: { snapshotToken: shareString } });
      if (!chart) {
        return Promise.reject("Chart not found");
      }

      return this.findById(chart.id);
    }

    return db.Chartshare.findOne({ where: { shareString } })
      .then((share) => {
        return this.findById(share.chart_id);
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  createShare(chartId) {
    return db.Chartshare.create({
      chart_id: chartId,
      shareString: uuid(),
    })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  updateShare(id, data) {
    return db.Chartshare.update(data, { where: { id } })
      .then(() => {
        return db.Chartshare.findByPk(id);
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  removeShare(id) {
    return db.Chartshare.destroy({ where: { id } })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  async createChartDatasetConfig(chartId, data) {
    if (!data.dataset_id) {
      return Promise.reject("Dataset ID is required");
    }

    const dataset = await db.Dataset.findByPk(data.dataset_id);

    return db.ChartDatasetConfig.create({
      ...data,
      legend: dataset.legend,
      chart_id: chartId,
    })
      .then((chartDatasetConfig) => {
        return chartDatasetConfig;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  updateChartDatasetConfig(id, data) {
    return db.ChartDatasetConfig.update(data, { where: { id } })
      .then(() => {
        return db.ChartDatasetConfig.findByPk(id);
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  deleteChartDatasetConfig(id) {
    return db.ChartDatasetConfig.destroy({ where: { id } })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  async takeSnapshot(id) {
    const chart = await this.findById(id);

    if (!chart?.snapshotToken) {
      return Promise.reject("Chart does not have a snapshot token");
    }

    return snapChart(chart.snapshotToken);
  }
}

module.exports = ChartController;
