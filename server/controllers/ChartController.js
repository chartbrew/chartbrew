const mongoose = require("mongoose");
const moment = require("moment");
const Sequelize = require("sequelize");
const { nanoid } = require("nanoid");
const uuid = require("uuid/v4");

const externalDbConnection = require("../modules/externalDbConnection");

const db = require("../models/models");
const DatasetController = require("./DatasetController");
const ConnectionController = require("./ConnectionController");
const DataRequestController = require("./DataRequestController");
const ChartCacheController = require("./ChartCacheController");
const dataExtractor = require("../charts/DataExtractor");

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
    let chartId;
    return db.Chart.create(data)
      .then((chart) => {
        chartId = chart.id;
        if (data.Datasets || data.dataRequest) {
          const createPromises = [];

          // add the datasets creation
          if (data.Datasets) {
            for (const dataset of data.Datasets) {
              if (!dataset.deleted) {
                dataset.chart_id = chartId;
                createPromises.push(this.datasetController.create(dataset));
              }
            }
          }

          // add the dataRequest creation
          if (data.dataRequest) {
            const { dataRequest } = data;
            dataRequest.chart_id = chart.id;
            createPromises.push(this.dataRequestController.create(dataRequest));
          }

          // add the update promise as well
          createPromises.push(this.update(chart.id, { dashboardOrder: chart.id }));
          return Promise.all(createPromises);
        } else {
          return this.update(chart.id, { dashboardOrder: chart.id });
        }
      })
      .then(() => {
        // delete chart cache
        if (user) {
          this.chartCache.remove(user.id, chartId);
        }

        return this.findById(chartId);
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
      where: { project_id: projectId },
      order: [["dashboardOrder", "ASC"], [db.Dataset, "order", "ASC"]],
      include: [{ model: db.Dataset }, { model: db.Chartshare }],
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
      include: [{ model: db.Dataset }, { model: db.Chartshare }],
      order: [[db.Dataset, "order", "ASC"]],
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

          if (data.Datasets || data.dataRequest) {
            if (data.Datasets) {
              updatePromises
                .push(this.updateDatasets(id, data.Datasets));
            }
            if (data.dataRequest) {
              updatePromises
                .push(this.dataRequestController.update(data.dataRequest.id, data.dataRequest));
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
        if (data.Datasets || data.dataRequest) {
          if (data.Datasets) {
            const datasetsToUpdate = [];
            for (const dataset of data.Datasets) {
              if (!dataset.deleted && !dataset.id) {
                dataset.chart_id = id;
                updatePromises.push(this.datasetController.create(dataset));
              } else if (!dataset.deleted && dataset.id) {
                datasetsToUpdate.push(dataset);
              }
            }

            if (datasetsToUpdate.length > 0) {
              updatePromises
                .push(this.updateDatasets(id, data.Datasets));
            }
          }
          if (data.dataRequest && data.dataRequest.id) {
            updatePromises
              .push(this.dataRequestController.update(data.dataRequest.id, data.dataRequest));
          }

          if (data.dataRequest && !data.dataRequest.id) {
            const newDataRequest = { ...data.dataRequest, chart_id: id };
            updatePromises.push(this.dataRequestController.create(newDataRequest));
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
    noSource, skipParsing, filters, isExport, getCache,
  }) {
    let gChart;
    let gCache;
    let gChartData;
    let skipCache = false;
    return this.findById(id)
      .then((chart) => {
        gChart = chart;
        if (!chart || !chart.Datasets || chart.Datasets.length === 0) {
          return new Promise((resolve, reject) => reject("The chart doesn't have any datasets"));
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

        const requestPromises = [];
        gChart.Datasets.map((dataset) => {
          if (noSource && gCache && gCache.data) {
            requestPromises.push(
              this.datasetController.runRequest(dataset.id, gChart.id, true, getCache)
            );
          } else {
            requestPromises.push(
              this.datasetController.runRequest(dataset.id, gChart.id, false, getCache)
            );
          }
          return dataset;
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
        } else if (!skipCache) {
          // create a new cache for the data that was fetched
          this.chartCache.create(user.id, gChart.id, resolvingData);
        }

        return Promise.resolve(resolvingData);
      })
      .then((chartData) => {
        if (isExport) {
          return dataExtractor(chartData, filters);
        }

        if (gChart.type === "table") {
          const extractedData = dataExtractor(chartData, filters);
          const tableView = new TableView();
          return tableView.getTableData(extractedData, chartData.datasets);
        }

        const axisChart = new AxisChart(chartData);
        return axisChart.plot(skipParsing, filters, isExport);
      })
      .then(async (chartData) => {
        gChartData = chartData;

        if (filters || isExport) {
          return filters;
        }

        // update the datasets if needed
        const datasetsPromises = [];
        if (chartData.conditionsOptions) {
          chartData.conditionsOptions.forEach((opt) => {
            if (opt.dataset_id) {
              const dataset = gChart.Datasets.find((d) => d.id === opt.dataset_id);
              if (dataset && dataset.conditions) {
                const newConditions = dataset.conditions.map((c) => {
                  const optCondition = opt.conditions.find((o) => o.field === c.field);
                  const values = (optCondition && optCondition.values) || [];

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
        return this.update(id, { chartData: chartData.configuration, chartDataUpdated: moment() });
      })
      .then(() => {
        if (filters && !isExport) {
          const filteredChart = gChart;
          filteredChart.chartData = gChartData.configuration;
          return filteredChart;
        }

        if (isExport) {
          return gChartData.configuration;
        }

        return this.findById(id);
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
          keepAlive: 1,
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
          keepAlive: 1,
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
        if (noSource !== "true") {
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
      include: [{ model: db.Dataset }],
      order: [[db.Dataset, "order", "ASC"]],
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
                  datasets: chart.Datasets,
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

  findByShareString(shareString) {
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
}

module.exports = ChartController;
