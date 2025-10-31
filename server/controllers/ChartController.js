const mongoose = require("mongoose");
const moment = require("moment");
const Sequelize = require("sequelize");
const { nanoid } = require("nanoid");
const { v4: uuid } = require("uuid");
const jwt = require("jsonwebtoken");

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
const getEmbeddedChartData = require("../modules/getEmbeddedChartData");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

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
      where: { project_id: projectId },
      order: [["dashboardOrder", "ASC"], [db.ChartDatasetConfig, "order", "ASC"]],
      include: [
        { model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] },
        { model: db.Chartshare },
        { model: db.Alert },
        { model: db.SharePolicy, scope: { entity_type: "Chart" } },
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
        { model: db.SharePolicy },
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
    noSource, skipParsing, filters, isExport, getCache, variables, skipSave,
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
          return new Promise((_resolve, reject) => reject("The chart doesn't have any datasets"));
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

        const requestPromises = [];
        gChart.ChartDatasetConfigs.forEach((cdc) => {
          // Build variables per CDC: start with provided variables and merge CDC-specific overrides
          const cdcVariables = { ...(variables || {}) };
          if (cdc?.configuration?.variables) {
            cdc.configuration.variables.forEach((configVar) => {
              if (cdcVariables[configVar.name] === undefined
                  || cdcVariables[configVar.name] === null
                  || cdcVariables[configVar.name] === "") {
                cdcVariables[configVar.name] = configVar.value;
              }
            });
          }

          if (noSource && gCache && gCache.data) {
            requestPromises.push(
              this.datasetController.runRequest({
                dataset_id: cdc.Dataset.id,
                chart_id: gChart.id,
                noSource: true,
                getCache,
                variables: cdcVariables,
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
                timezone: project?.timezone,
                variables: cdcVariables,
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

        if (!getCache && !noSource) {
          gChart = await this.update(id, { chartDataUpdated: moment() });
        }

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

        // Skip saving to database if skipSave flag is set
        if (skipSave) {
          // Return chart with updated data without saving to database
          const updatedChart = { ...gChart.toJSON() };
          updatedChart.chartData = gChartData.configuration;
          if (!getCache) {
            updatedChart.chartDataUpdated = moment();
          }
          return Promise.resolve(updatedChart);
        }

        return this.update(id, updateData);
      })
      .then((chart) => {
        if (skipSave) {
          // Chart is already processed above when skipSave is true
          return chart;
        }

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
          if (skipSave) {
            // For skipSave, chart is a plain object, so we create a new object with properties
            const chartWithTimeseries = {
              ...chart,
              isTimeseries: gChartData.isTimeseries,
              dateFormat: gChartData.dateFormat,
            };
            return chartWithTimeseries;
          } else {
            // For normal saves, chart is a Sequelize model
            chart.setDataValue("isTimeseries", gChartData.isTimeseries);
            chart.setDataValue("dateFormat", gChartData.dateFormat);
          }
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

  /**
   * Find a chart by share string [DEPRECATED]
   * @param {string} shareString - The share string from the share policy
   * @param {Object} queryParams - The query parameters
   * @returns {Promise<Object>} - The embedded chart data
   */
  async findByShareString(shareString, queryParams) {
    if (queryParams.snapshot) {
      const chart = await db.Chart.findOne({ where: { snapshotToken: shareString } });
      if (!chart) {
        return Promise.reject("Chart not found");
      }

      return this.findById(chart.id);
    }

    const chartShare = await db.Chartshare.findOne({ where: { shareString } });
    if (!chartShare) {
      return Promise.reject("Chart share not found");
    }

    // get the team's branding status
    const chart = await this.findById(chartShare.chart_id);
    const project = await db.Project.findByPk(chart.project_id);
    const team = await db.Team.findByPk(project.team_id);

    if (!chart.public && !chart.shareable) {
      return Promise.reject("401");
    }

    // Handle variable filtering based on share policy
    const urlVariables = this._extractVariablesFromQuery(queryParams);
    // If we have variables to apply, update the chart data with filters
    if (Object.keys(urlVariables).length > 0) {
      try {
        const updatedChart = await this.updateChartData(
          chart.id,
          null, // no user for embedded charts
          {
            noSource: false,
            skipParsing: false,
            variables: urlVariables,
            getCache: false,
          }
        );

        // Merge the updated chart data with the embedded chart structure
        const embeddedChartData = getEmbeddedChartData(updatedChart, team);
        return embeddedChartData;
      } catch (error) {
        // If variable filtering fails, return the chart without filtering
        // eslint-disable-next-line no-console
        console.error("Failed to apply variables to embedded chart:", error);
        const embeddedChartData = getEmbeddedChartData(chart, team);
        return embeddedChartData;
      }
    }

    const embeddedChartData = getEmbeddedChartData(chart, team);
    return embeddedChartData;
  }

  /**
   * Find a chart by share policy
   * @param {string} shareString - The share string from the share policy
   * @param {Object} queryParams - The query parameters
   * @returns {Promise<Object>} - The embedded chart data
   */
  async findBySharePolicy(shareString, queryParams) {
    if (!queryParams.token) {
      return Promise.reject("Token is missing");
    }

    const sharePolicy = await db.SharePolicy.findOne({ where: { share_string: shareString } });
    if (!sharePolicy) {
      return Promise.reject("Share policy not found");
    }

    // check if the token from the query parameters is valid
    const decodedToken = jwt.verify(queryParams.token, settings.secret);
    if (decodedToken?.sub?.type !== "Chart" || `${decodedToken?.sub?.id}` !== `${sharePolicy.entity_id}`) {
      return Promise.reject("Invalid token");
    }

    if (decodedToken?.exp < Date.now() / 1000) {
      return Promise.reject("Token expired");
    }

    const chart = await this.findById(sharePolicy.entity_id);
    const project = await db.Project.findByPk(chart.project_id);
    const team = await db.Team.findByPk(project.team_id);

    // Handle variable filtering based on share policy
    const urlVariables = this._extractVariablesFromQuery(queryParams);
    const finalVariables = this._mergeVariablesWithPolicy(urlVariables, sharePolicy);
    // If we have variables to apply, update the chart data with filters
    if (Object.keys(finalVariables).length > 0) {
      try {
        const updatedChart = await this.updateChartData(
          chart.id,
          null, // no user for embedded charts
          {
            noSource: false,
            skipParsing: false,
            variables: finalVariables,
            getCache: false,
          }
        );

        // Merge the updated chart data with the embedded chart structure
        const embeddedChartData = getEmbeddedChartData(updatedChart, team);
        return embeddedChartData;
      } catch (error) {
        // If variable filtering fails, return the chart without filtering
        // eslint-disable-next-line no-console
        console.error("Failed to apply variables to embedded chart:", error);
        const embeddedChartData = getEmbeddedChartData(chart, team);
        return embeddedChartData;
      }
    }

    const embeddedChartData = getEmbeddedChartData(chart, team);
    return embeddedChartData;
  }

  /**
   * Extract variables from query parameters, excluding special parameters
   * @param {Object} queryParams - The query parameters object
   * @returns {Object} - Object containing extracted variables
   */
  _extractVariablesFromQuery(queryParams) {
    const variables = {};
    const specialParams = ["token", "theme", "isSnapshot", "snapshot"];

    if (queryParams && typeof queryParams === "object") {
      Object.keys(queryParams).forEach((key) => {
        if (!specialParams.includes(key)) {
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

  async generateShareToken(chartId, data) {
    // Find the first share policy if no specific policy ID is provided
    let sharePolicy;
    if (data?.sharePolicyId) {
      sharePolicy = await db.SharePolicy.findByPk(data.sharePolicyId);
    } else {
      sharePolicy = await db.SharePolicy.findOne({
        where: {
          entity_type: "Chart",
          entity_id: chartId,
        },
      });
    }

    if (!sharePolicy) {
      return Promise.reject("Share policy not found");
    }

    const payload = {
      sub: { type: "Chart", id: chartId, sharePolicyId: sharePolicy.id },
    };

    if (data?.share_policy) {
      await db.SharePolicy.update(data.share_policy, { where: { id: sharePolicy.id } });
      // Refresh the sharePolicy to get updated data
      sharePolicy = await db.SharePolicy.findByPk(sharePolicy.id);
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

    const token = jwt.sign(payload, settings.secret, { expiresIn });

    // Use the SharePolicy's share_string instead of Chartshares
    const shareString = sharePolicy.share_string;
    const url = `${settings.client}/chart/${shareString}/share?token=${token}`;

    return { token, url };
  }

  async createShare(chartId) {
    const shareString = uuid();
    const transaction = await db.sequelize.transaction();

    const sharePolicy = await db.SharePolicy.create({
      entity_type: "Chart",
      entity_id: chartId,
      visibility: "private",
    }, { transaction });

    const chartShare = await db.Chartshare.create({
      chart_id: chartId,
      shareString,
    }, { transaction });

    if (!sharePolicy || !chartShare) {
      await transaction.rollback();
      return Promise.reject("Failed to create share");
    }

    await transaction.commit();

    return shareString;
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

  async createSharePolicy(chartId) {
    return db.SharePolicy.create({
      entity_type: "Chart",
      entity_id: chartId,
      visibility: "private",
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
