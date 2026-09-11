const { getReportOrder, getLayouts, arrangeRows, deriveLayouts, breakpoints } = require("../../shared/dashboard/layout.mjs");
const { nanoid } = require("nanoid");
const { v4: uuid } = require("uuid");
const { Op } = require("sequelize");

const { createPlacedChart, removePlacedChart, lockDashboard, saveMetadata } = require("../modules/dashboardLayout");
const {
  buildChartRuntimeContext,
  getDatasetRuntimeFilters,
} = require("../modules/chartRuntimeFilters");
const runtimeCache = require("../modules/runtimeCache");
const {
  attachUnavailableRender,
  attachPreparedRender,
  compilePreparedRender,
  loadPreparedSnapshot,
  persistPreparedSnapshot,
} = require("../modules/preparedSnapshot");
const { getDatasetName, resolveChartDatasetOptions } = require("../modules/resolveChartDatasetOptions");
const { findSourceForConnection } = require("../sources");
const { assertSourceServerEnabled } = require("../sources/sourceAvailability");
const {
  markChartDatasetIntelligenceStale,
  markDatasetIntelligenceStale,
} = require("../modules/datasetIntelligence/profileLifecycle");
const { processChartResult } = require("../modules/observations/processChartResult");

const db = require("../models/models");
const DatasetController = require("./DatasetController");
const ConnectionController = require("./ConnectionController");
const DataRequestController = require("./DataRequestController");
const ChartCacheController = require("./ChartCacheController");
const { snapChart } = require("../modules/snapshots");
const { VisualizationEngine } = require("../visualization/VisualizationEngine");
const { getPreparedDataFingerprint } = require("../visualization/preparedData");
const {
  legacyChartDataToPreparedData,
} = require("../visualization/legacyChartDataToPreparedData");
const {
  buildLegacyLayer,
  legacyChartToVisualization,
} = require("../visualization/legacyChartToVisualization");
const {
  addBindingLayer,
  applyCdcCompatibilityUpdate,
  applyChartCompatibilityUpdate,
  removeBindingLayers,
} = require("../visualization/compatibilityUpdates");
const {
  isLegacyOwnedVisualization,
  shouldSyncLegacyCdc,
  shouldSyncLegacyChart,
} = require("../visualization/legacyVisualizationSync");
const { remapVisualizationBindings } = require("../visualization/remapBindings");
const {
  signLegacyShareToken,
  signShareToken,
  validateShareTokenPolicy,
  verifyShareToken,
} = require("../modules/shareToken");
const {
  completeRun,
  failRun,
  finishEvent,
  getItemCount,
  recordInstantEvent,
  startEvent,
} = require("../modules/updateAudit");

const getEmbeddedChartData = require("../modules/getEmbeddedChartData");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

function toAuditError(error, stage = "unknown") {
  if (error instanceof Error) {
    const wrappedError = error;
    wrappedError.auditStage = wrappedError.auditStage || stage;
    return wrappedError;
  }

  const wrappedError = new Error(String(error));
  wrappedError.auditStage = stage;
  return wrappedError;
}

function getRuntimeDatasetKey(options = {}) {
  return options.dataset_id || options.id || null;
}

function createRuntimeShortCircuit(chart) {
  return {
    __runtimeCachedChart: true,
    chart,
  };
}

function isRuntimeShortCircuit(value) {
  return Boolean(value && value.__runtimeCachedChart);
}

function createPreparedResult(preparedData, options = {}) {
  return {
    preparedData,
    fingerprint: getPreparedDataFingerprint(preparedData),
    generatedAt: preparedData.generatedAt,
    stale: Boolean(options.stale),
  };
}

function reconcileVisualizationBindings(chart) {
  if (!chart || isLegacyOwnedVisualization(chart.visualization)) return chart;

  let visualization = chart.visualization;
  (chart.ChartDatasetConfigs || []).forEach((cdc, index) => {
    visualization = addBindingLayer(
      visualization,
      buildLegacyLayer(chart, cdc, index)
    );
  });
  if (chart.type || chart.subType) {
    visualization = applyChartCompatibilityUpdate(visualization, {
      ...(chart.type ? { type: chart.type } : {}),
      ...(chart.subType ? { subType: chart.subType } : {}),
    });
  }

  if (JSON.stringify(visualization) !== JSON.stringify(chart.visualization)) {
    if (typeof chart.set === "function") {
      chart.set("visualization", visualization);
      chart.changed("visualization", false);
    } else {
      chart.visualization = visualization;
    }
  }

  return chart;
}

function getSourceRuntimeFiltersForDataset(runtimeContext, cdc, fallbackFilters = []) {
  if (!runtimeContext) return fallbackFilters;

  const dateFilters = runtimeContext.filters.filter((filter) => {
    return filter.type === "date" && filter.startDate && filter.endDate;
  });

  return dateFilters.concat(getDatasetRuntimeFilters(runtimeContext, cdc));
}

function toPlainChart(chart) {
  if (!chart) return chart;
  return typeof chart.toJSON === "function" ? chart.toJSON() : { ...chart };
}

function attachRuntimeCacheMetadata(chart, metadata = {}) {
  if (!chart) return chart;

  const plainChart = toPlainChart(chart);
  plainChart.cacheStatus = metadata.cacheStatus || plainChart.cacheStatus || "miss";
  plainChart.variantHash = metadata.variantHash || plainChart.variantHash || null;
  plainChart.stale = Boolean(metadata.stale);
  return plainChart;
}

function removeRuntimeChartFields(data = {}) {
  const chartData = { ...data };
  [
    "chartData",
    "chartDataUpdated",
    "preparedData",
    "preparedDataFingerprint",
    "preparedDataSourceFingerprint",
    "preparedDataUpdatedAt",
    "preparedDataVisualizationFingerprint",
    "render",
  ].forEach((field) => delete chartData[field]);
  if ((chartData.type === "bar" || chartData.type === undefined) && chartData.horizontal === true) {
    chartData.type = "horizontalBar";
    chartData.horizontal = false;
  } else if (chartData.type === "horizontalBar") {
    chartData.horizontal = false;
  }
  return chartData;
}

function applyRuntimeChartValues(chart, runtimeChart) {
  if (!chart?.setDataValue || !runtimeChart) return runtimeChart || chart;
  [
    "cacheStatus",
    "dateFormat",
    "isTimeseries",
    "preparedDataUpdatedAt",
    "render",
    "stale",
    "variantHash",
  ].forEach((field) => {
    if (runtimeChart[field] !== undefined) {
      chart.setDataValue(field, runtimeChart[field]);
      if (chart[field] === undefined) chart[field] = runtimeChart[field];
    }
  });
  return chart;
}

class ChartController {
  constructor() {
    this.connectionController = new ConnectionController();
    this.datasetController = new DatasetController();
    this.dataRequestController = new DataRequestController();
    this.chartCache = new ChartCacheController();
  }

  async prepareLegacyChartData(chartId, options = {}) {
    const chart = options.chart || await db.Chart.unscoped().findByPk(chartId, {
      include: [{ model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] }],
      order: [[db.ChartDatasetConfig, "order", "ASC"]],
    });
    const legacyChart = options.chart
      ? await db.Chart.unscoped().findByPk(chartId, {
        attributes: ["chartData", "chartDataUpdated"],
      })
      : chart;
    if (!chart) throw new Error("Chart not found");

    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: legacyChart?.chartData,
      generatedAt: legacyChart?.chartDataUpdated,
      timezone: options.timezone,
    });
    const currentFingerprints = await runtimeCache.buildChartFingerprints(
      chartId,
      options.timezone
    );
    const fingerprints = {
      combined: getPreparedDataFingerprint(preparedData),
      source: null,
      visualization: currentFingerprints.visualization,
    };
    const renderedChart = compilePreparedRender(chart, preparedData, {
      snapshotUpdatedAt: preparedData.generatedAt,
      stale: true,
      timezone: options.timezone,
      updatedAt: preparedData.generatedAt,
    });
    const snapshot = options.skipSave
      ? { reason: "dry_run", saved: false }
      : await persistPreparedSnapshot({ chartId, fingerprints, preparedData });
    renderedChart.preparedDataUpdatedAt = snapshot.updatedAt || preparedData.generatedAt;

    return { chart: renderedChart, preparedData, snapshot };
  }

  async hydratePreparedChart(chart, options = {}) {
    if (!chart) return chart;

    const snapshot = await loadPreparedSnapshot(chart.id, options);
    // Reuse refresh history; keep the last successful snapshot when a source fails.
    const failedRefresh = snapshot?.updatedAt ? await db.UpdateRun.findOne({
      attributes: ["summary", "finishedAt"],
      where: { chartId: chart.id, entityType: "chart", status: "failed", finishedAt: { [Op.gt]: snapshot.updatedAt } },
      order: [["finishedAt", "DESC"]],
    }).catch(() => null) : null;
    const refreshError = failedRefresh?.summary?.dataRecovery || null;
    if (chart.setDataValue) chart.setDataValue("refreshError", refreshError);
    else chart.refreshError = refreshError;
    const refreshKey = `prepared-snapshot-refresh:${chart.id}`;
    const refresh = () => this.updateChartData(chart.id, null, {
      finalizeRun: false,
      getCache: false,
      noSource: false,
      traceContext: null,
    });

    if (!snapshot) {
      if (options.refresh !== false) {
        try {
          const inferred = await runtimeCache.runSingleFlight(
            `prepared-snapshot-infer:${chart.id}`,
            () => this.prepareLegacyChartData(chart.id, {
              chart,
              timezone: options.timezone,
            })
          );
          runtimeCache.triggerBackgroundRefresh(refreshKey, refresh);
          return applyRuntimeChartValues(chart, inferred.chart);
        } catch (error) {
          runtimeCache.triggerBackgroundRefresh(refreshKey, refresh);
        }
      }
      return applyRuntimeChartValues(chart, attachUnavailableRender(chart, { stale: true }));
    }

    const fingerprints = await runtimeCache.buildChartFingerprints(
      chart.id,
      options.timezone
    );
    const migratedHorizontalSnapshot = !snapshot.visualizationFingerprint
      && chart.type === "horizontalBar"
      && snapshot.preparedData.results.every((result) => result.mark === "horizontalBar");
    if (snapshot.visualizationFingerprint !== fingerprints.visualization
      && !migratedHorizontalSnapshot
    ) {
      if (options.refresh !== false) {
        try {
          return await runtimeCache.runSingleFlight(refreshKey, refresh);
        } catch (error) {
          return applyRuntimeChartValues(chart, attachUnavailableRender(chart, { stale: true }));
        }
      }
      return applyRuntimeChartValues(chart, attachUnavailableRender(chart, { stale: true }));
    }

    if (migratedHorizontalSnapshot && options.refresh !== false) {
      runtimeCache.triggerBackgroundRefresh(refreshKey, refresh);
    }

    const stale = Boolean(refreshError) || migratedHorizontalSnapshot
      || snapshot.sourceFingerprint !== fingerprints.source;
    let renderedChart;
    try {
      renderedChart = compilePreparedRender(chart, snapshot.preparedData, {
        snapshotUpdatedAt: snapshot.updatedAt,
        stale,
        timezone: options.timezone,
        updatedAt: snapshot.updatedAt,
      });
    } catch (error) {
      if (options.refresh !== false) {
        runtimeCache.triggerBackgroundRefresh(refreshKey, refresh);
      }
      return applyRuntimeChartValues(chart, attachUnavailableRender(chart, { stale: true }));
    }

    if (stale && options.refresh !== false) {
      runtimeCache.triggerBackgroundRefresh(refreshKey, refresh);
    }
    return applyRuntimeChartValues(chart, renderedChart);
  }

  async hydratePreparedCharts(charts, options = {}) {
    return Promise.all((charts || []).map((chart) => {
      return this.hydratePreparedChart(chart, options);
    }));
  }

  create(data, user) {
    return createPlacedChart(removeRuntimeChartFields(data))
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

  async findByProject(projectId) {
    try {
      const [charts, project] = await Promise.all([db.Chart.findAll({
        where: { project_id: projectId },
        order: [["dashboardOrder", "ASC"], [db.ChartDatasetConfig, "order", "ASC"]],
        include: [
          { model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] },
          { model: db.Chartshare },
          { model: db.Alert },
          { model: db.SharePolicy, scope: { entity_type: "Chart" } },
        ],
      }), db.Project.findByPk(projectId, { attributes: ["timezone", "layoutOrder"] })]);
      const order = getReportOrder(charts, project?.layoutOrder);
      charts.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
      return this.hydratePreparedCharts(charts, {
        refresh: true,
        timezone: project?.timezone,
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  findById(id, customQuery, options = {}) {
    const query = {
      where: { id },
      transaction: options.transaction,
      include: [
        { model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] },
        { model: db.Chartshare },
        { model: db.Alert },
        { model: db.SharePolicy },
      ],
      order: [[db.ChartDatasetConfig, "order", "ASC"]],
    };

    return db.Chart.findOne(customQuery || query)
      .then(async (chart) => {
        const reconciledChart = options.reconcileVisualizationBindings === false
          ? chart
          : reconcileVisualizationBindings(chart);
        const shouldHydrate = options.hydratePreparedData !== false
          && !options.transaction
          && !customQuery
          && typeof reconciledChart?.toJSON === "function";
        if (!shouldHydrate || !reconciledChart) return reconciledChart;

        const project = reconciledChart.project_id
          ? await db.Project.findByPk(reconciledChart.project_id, { attributes: ["timezone"] })
          : null;
        return this.hydratePreparedChart(reconciledChart, {
          refresh: options.refreshPreparedData === true,
          timezone: project?.timezone,
        });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async syncLegacyVisualization(chartId, options = {}, compatibility = {}) {
    const chart = await this.findById(chartId, null, {
      ...options,
      hydratePreparedData: false,
      reconcileVisualizationBindings: false,
    });
    if (!chart) return chart;

    if (!isLegacyOwnedVisualization(chart.visualization)) {
      let visualization = applyChartCompatibilityUpdate(chart.visualization, {
        ...(chart.type ? { type: chart.type } : {}),
        ...(chart.subType ? { subType: chart.subType } : {}),
      });
      if (compatibility.chartChanges) {
        visualization = applyChartCompatibilityUpdate(visualization, compatibility.chartChanges);
      }
      if (compatibility.cdcData) {
        visualization = applyCdcCompatibilityUpdate(
          visualization,
          compatibility.bindingId,
          compatibility.cdcData
        );
      }
      if (compatibility.removeBinding) {
        visualization = removeBindingLayers(visualization, compatibility.removeBinding);
      }
      if (compatibility.addBinding) {
        const bindingIndex = chart.ChartDatasetConfigs.findIndex((cdc) => {
          return `${cdc.id}` === `${compatibility.addBinding}`;
        });
        if (bindingIndex >= 0) {
          visualization = addBindingLayer(
            visualization,
            buildLegacyLayer(chart, chart.ChartDatasetConfigs[bindingIndex], bindingIndex)
          );
        }
      }
      if (JSON.stringify(visualization) === JSON.stringify(chart.visualization)) return chart;
      await db.Chart.update(
        { visualization },
        { transaction: options.transaction, where: { id: chartId } }
      );
      return this.findById(chartId, null, options);
    }

    const result = legacyChartToVisualization(chart);
    if (!result.valid) {
      throw new Error(result.errors.join("; "));
    }

    await db.Chart.update(
      { visualization: result.visualization },
      { transaction: options.transaction, where: { id: chartId } }
    );
    return this.findById(chartId, null, options);
  }

  async repairVisualization(chartId, bindingId) {
    const chart = await this.findById(chartId, null, {
      reconcileVisualizationBindings: false,
    });
    if (!chart) throw new Error("Chart not found");

    const binding = (chart.ChartDatasetConfigs || []).find((cdc) => {
      return `${cdc.id}` === `${bindingId}`;
    });
    if (!binding) throw new Error("Dataset configuration not found");

    return this.syncLegacyVisualization(chartId, {}, {
      addBinding: binding.id,
    });
  }

  update(id, data, user, justUpdates) {
    const chartUpdates = removeRuntimeChartFields(data);
    ["layout", "dashboardOrder", "project_id"].forEach((field) => delete chartUpdates[field]);

    if (data.autoUpdate || data.autoUpdate === 0) {
      return db.Chart.update(chartUpdates, {
        where: { id },
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
        .then(async (chart) => {
          const updatedChart = shouldSyncLegacyChart(data)
            ? await this.syncLegacyVisualization(id, {}, { chartChanges: data })
            : chart;
          await markChartDatasetIntelligenceStale(id);
          return updatedChart;
        })
        .catch((error) => {
          return new Promise((resolve, reject) => reject(error));
        });
    }

    return db.Chart.update(chartUpdates, {
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
            attributes: ["id"].concat(Object.keys(chartUpdates)),
          });
        } else {
          return this.findById(id);
        }
      })
      .then(async (chart) => {
        const updatedChart = shouldSyncLegacyChart(data)
          ? await this.syncLegacyVisualization(id, {}, { chartChanges: data })
          : chart;
        await markChartDatasetIntelligenceStale(id);
        return updatedChart;
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

  async changeDashboardOrder(selectedId, otherId) {
    const chart = await db.Chart.findByPk(selectedId);
    if (!chart) throw new Error("Chart not found");
    return db.sequelize.transaction(async (transaction) => {
      const { project, charts } = await lockDashboard(chart.project_id, transaction);
      const order = getReportOrder(charts, project.layoutOrder);
      const selected = String(selectedId);
      const index = order.indexOf(selected);
      const target = order.indexOf(String(otherId));
      if (index < 0 || (target < 0 && !["top", "bottom"].includes(otherId))) throw new Error("Chart not found in dashboard");
      if (otherId === "top" || otherId === "bottom") {
        order.splice(index, 1);
        order.splice(otherId === "top" ? 0 : order.length, 0, selected);
      } else {
        [order[index], order[target]] = [order[target], order[index]];
      }
      const layouts = getLayouts(charts);
      const byId = new Map(layouts.lg.map((item) => [item.i, item]));
      layouts.lg = arrangeRows(order.map((id) => byId.get(id)), "lg");
      const next = deriveLayouts(layouts, order, project.layoutCustom || breakpoints);
      await Promise.all(charts.map((item) => item.update({
        layout: Object.fromEntries(breakpoints.map((bp) => {
          const rect = next[bp].find((entry) => entry.i === String(item.id));
          return [bp, [rect.x, rect.y, rect.w, rect.h]];
        })),
      }, { transaction })));
      await saveMetadata(project, charts, transaction, { layoutOrder: order });
      return charts;
    });
  }

  remove(id) {
    return removePlacedChart(id)
      .then((response) => {
        return response;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateChartData(id, user, {
    noSource,
    filters,
    isExport,
    exportMode,
    getCache,
    cacheOnly = false,
    variables,
    skipSave,
    runtimeOnly = false,
    traceContext,
    finalizeRun = true,
    returnPreparedData = false,
    preparedOnly = false,
    maintainDatasetMetadata = true,
    viewerScope,
    signal,
    deadlineAt,
  }) {
    let gChart;
    let gCache;
    let gChartData;
    let skipCache = false;
    let project;
    let runtimeContext;
    let effectiveFilters = Array.isArray(filters) ? filters : [];
    let effectiveVariables = variables || {};
    const chartTraceContext = traceContext || null;
    const shouldFinalizeAuditRun = Boolean(chartTraceContext) && finalizeRun !== false;
    let chartPersistEvent;
    let effectiveNoSource = noSource;
    let effectiveGetCache = getCache;
    const requestedGetCache = Boolean(getCache);
    const shouldReadRuntimeCache = requestedGetCache;
    let runtimeChartCacheEntry;
    let runtimeChartCacheParams;
    let runtimeChartVersion;
    let runtimeViewerScope = viewerScope || (user ? "authenticated" : "anonymous");
    let snapshotPersistResult = null;

    return this.findById(id, null, { hydratePreparedData: false })
      .then(async (chart) => {
        gChart = chart;
        if (!chart || !chart.ChartDatasetConfigs || chart.ChartDatasetConfigs.length === 0) {
          return new Promise((_resolve, reject) => reject(toAuditError("The chart doesn't have any datasets")));
        }

        if (chart.project_id) {
          project = await db.Project.findByPk(chart.project_id);
        }

        runtimeContext = buildChartRuntimeContext(chart, filters, variables, project?.timezone);
        effectiveFilters = runtimeContext.filters;
        effectiveVariables = runtimeContext.variables;

        runtimeCache.debugLog("chart_runtime_context", {
          chartId: id,
          viewerScope: runtimeViewerScope,
          getCache: requestedGetCache,
          isExport: Boolean(isExport),
          hasRuntimeFilters: Boolean(runtimeContext?.hasRuntimeFilters),
          cacheable: Boolean(runtimeContext?.cacheableChartPayload?.hasRuntimeFilters),
          needsSourceRefresh: Boolean(runtimeContext?.needsSourceRefresh),
          sourceVariantHash: runtimeContext?.sourceVariantHash || null,
          chartVariantHash: runtimeContext?.chartVariantHash || null,
          filterCounts: {
            filters: Array.isArray(effectiveFilters) ? effectiveFilters.length : 0,
            sourceAffecting: runtimeContext?.classifiedFilters?.sourceAffecting?.length || 0,
            serverParseAffecting: runtimeContext?.classifiedFilters?.serverParseAffecting?.length || 0,
            clientOnly: runtimeContext?.classifiedFilters?.clientOnly?.length || 0,
          },
        });

        if (runtimeContext.cacheableChartPayload?.hasRuntimeFilters && !isExport) {
          runtimeChartVersion = await runtimeCache.buildChartVersion(id, project?.timezone);
          runtimeChartCacheParams = {
            chartId: id,
            chartVersion: runtimeChartVersion,
            variantHash: runtimeContext.chartVariantHash,
            viewerScope: runtimeViewerScope,
          };
          runtimeChartCacheEntry = shouldReadRuntimeCache
            ? await runtimeCache.getPreparedCache(runtimeChartCacheParams)
            : null;
          let chartCacheLookupResult = "skipped";
          if (runtimeChartCacheEntry) {
            chartCacheLookupResult = runtimeChartCacheEntry.stale ? "stale" : "hit";
          } else if (shouldReadRuntimeCache) {
            chartCacheLookupResult = "miss";
          }

          runtimeCache.debugLog("chart_cache_lookup", {
            chartId: id,
            viewerScope: runtimeViewerScope,
            shouldReadRuntimeCache,
            chartVersion: runtimeChartVersion,
            cacheKey: runtimeChartCacheParams.chartVersion
              ? runtimeCache.preparedCacheKey(runtimeChartCacheParams)
              : null,
            variantHash: runtimeContext.chartVariantHash,
            result: chartCacheLookupResult,
          });

          if (runtimeChartCacheEntry?.payload) {
            const cachedChart = preparedOnly
              ? createPreparedResult(runtimeChartCacheEntry.payload, {
                stale: runtimeChartCacheEntry.stale,
              })
              : attachRuntimeCacheMetadata(compilePreparedRender(
                gChart,
                runtimeChartCacheEntry.payload,
                {
                  stale: runtimeChartCacheEntry.stale,
                  timezone: project?.timezone,
                  updatedAt: runtimeChartCacheEntry.payload.generatedAt,
                }
              ), {
                cacheStatus: runtimeChartCacheEntry.stale ? "stale" : "hit",
                variantHash: runtimeContext.chartVariantHash,
                stale: runtimeChartCacheEntry.stale,
              });

            await runtimeCache.trackChartVariantUsage({
              chartId: id,
              variantHash: runtimeContext.chartVariantHash,
              runtimePayload: runtimeContext.cacheableChartPayload,
            });

            if (runtimeChartCacheEntry.stale && !cacheOnly) {
              runtimeCache.triggerBackgroundRefresh(
                runtimeChartCacheParams.chartId
                  ? `chart-runtime-refresh:${runtimeChartCacheParams.chartId}:${runtimeContext.chartVariantHash}:${runtimeViewerScope}`
                  : `chart-runtime-refresh:${id}:${runtimeContext.chartVariantHash}:${runtimeViewerScope}`,
                () => this.updateChartData(id, user, {
                  noSource: false,
                  skipParsing: false,
                  filters: effectiveFilters,
                  getCache: false,
                  variables: effectiveVariables,
                  skipSave: true,
                  runtimeOnly: true,
                  traceContext: null,
                  finalizeRun: false,
                  preparedOnly,
                  viewerScope: runtimeViewerScope,
                })
              );
            }

            return createRuntimeShortCircuit(cachedChart);
          }
        }

        if (cacheOnly) {
          runtimeCache.debugLog("chart_cache_only_miss", {
            chartId: id,
            viewerScope: runtimeViewerScope,
            hasRuntimeFilters: Boolean(runtimeContext?.cacheableChartPayload?.hasRuntimeFilters),
            chartVariantHash: runtimeContext?.chartVariantHash || null,
          });

          if (runtimeContext.cacheableChartPayload?.hasRuntimeFilters) {
            const cacheMissError = new Error("Runtime chart cache miss");
            cacheMissError.code = "RUNTIME_CHART_CACHE_MISS";
            throw cacheMissError;
          }

          const defaultSnapshot = await loadPreparedSnapshot(id);
          if (preparedOnly && !defaultSnapshot) {
            const cacheMissError = new Error("Prepared chart snapshot is not available");
            cacheMissError.code = "PREPARED_SNAPSHOT_MISS";
            throw cacheMissError;
          }
          let storedChart = attachUnavailableRender(gChart, { stale: true });
          if (defaultSnapshot && preparedOnly) {
            storedChart = createPreparedResult(defaultSnapshot.preparedData, { stale: false });
          } else if (defaultSnapshot) {
            storedChart = compilePreparedRender(gChart, defaultSnapshot.preparedData, {
              snapshotUpdatedAt: defaultSnapshot.updatedAt,
              stale: false,
              timezone: project?.timezone,
              updatedAt: defaultSnapshot.updatedAt,
            });
          }
          return createRuntimeShortCircuit(preparedOnly
            ? storedChart
            : attachRuntimeCacheMetadata(storedChart, {
              cacheStatus: "stored",
              variantHash: runtimeContext?.chartVariantHash || null,
              stale: false,
            }));
        }

        if (runtimeContext.needsSourceRefresh) {
          runtimeCache.debugLog("chart_runtime_source_refresh_forced", {
            chartId: id,
            viewerScope: runtimeViewerScope,
            chartVariantHash: runtimeContext?.chartVariantHash || null,
          });
          effectiveNoSource = false;
          effectiveGetCache = false;
        }

        if (chartTraceContext) {
          await recordInstantEvent(chartTraceContext, "chart_loaded", {
            chartId: chart.id,
            projectId: chart.project_id,
            chartType: chart.type,
            datasetCount: chart.ChartDatasetConfigs.length,
            noSource: Boolean(effectiveNoSource),
            getCache: Boolean(effectiveGetCache),
            skipSave: Boolean(skipSave || runtimeOnly),
          });
        }

        if (runtimeContext.cacheableChartPayload?.hasRuntimeFilters && !runtimeChartCacheEntry) {
          await runtimeCache.trackChartVariantUsage({
            chartId: id,
            variantHash: runtimeContext.chartVariantHash,
            runtimePayload: runtimeContext.cacheableChartPayload,
          });
        }

        if (!user) {
          skipCache = true;
          return new Promise((resolve) => resolve(false));
        }

        return this.chartCache.findLast(user.id, chart.id);
      })
      .then((cache) => {
        if (isRuntimeShortCircuit(cache)) {
          return cache;
        }

        if (!skipCache) {
          gCache = cache;
        }

        const requestPromises = [];
        gChart.ChartDatasetConfigs.forEach((cdc) => {
          // Build variables per CDC: start with provided variables and merge CDC-specific overrides
          const cdcVariables = { ...effectiveVariables };
          if (cdc?.configuration?.variables) {
            cdc.configuration.variables.forEach((configVar) => {
              if (cdcVariables[configVar.name] === undefined
                  || cdcVariables[configVar.name] === null
                  || cdcVariables[configVar.name] === "") {
                cdcVariables[configVar.name] = configVar.value;
              }
            });
          }

          if (effectiveNoSource && gCache && gCache.data) {
            requestPromises.push(
              this.datasetController.runRequest({
                dataset_id: cdc.Dataset.id,
                chart_id: gChart.id,
                noSource: true,
                getCache: effectiveGetCache,
                variables: cdcVariables,
                traceContext: chartTraceContext,
                projectId: project?.id || gChart.project_id,
                teamId: project?.team_id || chartTraceContext?.teamId || null,
                runtimeContext,
                viewerScope: runtimeViewerScope,
                readRuntimeSourceCache: shouldReadRuntimeCache,
                writeRuntimeSourceCache: Boolean(runtimeContext?.cacheableChartPayload?.hasRuntimeFilters),
                maintainDatasetMetadata,
                signal,
                deadlineAt,
              })
            );
          } else {
            requestPromises.push(
              this.datasetController.runRequest({
                dataset_id: cdc.Dataset.id,
                chart_id: gChart.id,
                noSource: false,
                getCache: effectiveGetCache,
                filters: getSourceRuntimeFiltersForDataset(runtimeContext, cdc, effectiveFilters),
                timezone: project?.timezone,
                variables: cdcVariables,
                traceContext: chartTraceContext,
                projectId: project?.id || gChart.project_id,
                teamId: project?.team_id || chartTraceContext?.teamId || null,
                runtimeContext,
                viewerScope: runtimeViewerScope,
                readRuntimeSourceCache: shouldReadRuntimeCache,
                writeRuntimeSourceCache: Boolean(runtimeContext?.cacheableChartPayload?.hasRuntimeFilters),
                maintainDatasetMetadata,
                signal,
                deadlineAt,
              })
            );
          }
        });
        if (runtimeChartCacheParams && runtimeContext?.cacheableChartPayload?.hasRuntimeFilters) {
          return runtimeCache.runSingleFlight(
            `chart-runtime-generate:${id}:${runtimeContext.chartVariantHash}:${runtimeViewerScope}`,
            async () => Promise.all(requestPromises),
          );
        }

        return Promise.all(requestPromises);
      })
      .then(async (datasets) => {
        if (isRuntimeShortCircuit(datasets)) {
          return datasets;
        }
        if (signal?.aborted) {
          const timeoutError = new Error("The request exceeded the execution time limit.");
          timeoutError.code = "EXECUTION_TIMEOUT";
          throw timeoutError;
        }

        const resolvedDatasets = datasets.map((dataset, index) => {
          const cdc = gChart.ChartDatasetConfigs[index];
          return {
            ...dataset,
            options: resolveChartDatasetOptions(cdc, dataset?.options),
          };
        });

        const resolvingData = {
          chart: gChart,
          datasets: resolvedDatasets,
        };

        // change the datasets data if the cache is called
        if (!skipCache && effectiveNoSource === true && gCache && gCache.data && gCache.data.datasets) {
          resolvingData.datasets = gCache.data.datasets.map((item) => {
            const tempItem = item;
            for (let i = 0; i < resolvedDatasets.length; i++) {
              if (getRuntimeDatasetKey(item.options)
                === getRuntimeDatasetKey(resolvedDatasets[i].options)
              ) {
                tempItem.options = resolvedDatasets[i].options;
                break;
              }
            }
            return tempItem;
          });
        } else if (!skipCache && user?.id && !runtimeOnly && !runtimeContext?.hasRuntimeFilters) {
          // create a new cache for the data that was fetched
          this.chartCache.create(user.id, gChart.id, resolvingData);
        }

        if (chartTraceContext) {
          await recordInstantEvent(chartTraceContext, "dataset_join_finished", {
            chartId: gChart.id,
            datasetCount: resolvingData.datasets.length,
            datasets: resolvingData.datasets.map((dataset) => ({
              datasetId: dataset?.options?.id || null,
              itemCount: getItemCount(dataset?.data),
            })),
          });
        }

        return Promise.resolve(resolvingData);
      })
      .then((chartData) => {
        if (isRuntimeShortCircuit(chartData)) {
          return chartData;
        }

        try {
          const visualizationEngine = new VisualizationEngine({
            ...chartData,
            timezone: project?.timezone,
          });
          const engineOptions = {
            filters: effectiveFilters,
            timezone: project?.timezone,
            variables: effectiveVariables,
          };

          if (preparedOnly) return visualizationEngine.prepare(engineOptions);

          return isExport
            ? visualizationEngine.export({ ...engineOptions, mode: exportMode || "source" })
            : visualizationEngine.render(engineOptions);
        } catch (error) {
          return Promise.reject(toAuditError(error, "transform"));
        }
      })
      .then(async (chartData) => {
        if (isRuntimeShortCircuit(chartData)) {
          return chartData;
        }
        if (signal?.aborted) {
          const timeoutError = new Error("The request exceeded the execution time limit.");
          timeoutError.code = "EXECUTION_TIMEOUT";
          throw timeoutError;
        }

        gChartData = chartData;
        try {
          if (chartTraceContext) {
            await recordInstantEvent(chartTraceContext, "chart_parse_finished", {
              chartId: id,
              chartType: gChart.type,
              isTimeseries: preparedOnly ? false : chartData?.isTimeseries || false,
              datasetCount: chartData?.preparedData?.results?.length || 0,
              labelCount: chartData?.preparedData?.results
                ?.reduce((count, result) => count + result.rows.length, 0) || 0,
              visualizationAdapted: Boolean(chartData?.adapted),
            });
          }

          const hasRuntimeVariables = Boolean(effectiveVariables) && Object.keys(effectiveVariables).length > 0;
          const shouldPersist = !skipSave
            && !runtimeOnly
            && !(effectiveFilters && effectiveFilters.length > 0)
            && !hasRuntimeVariables
            && !isExport;
          const shouldUpdateConditionOptions = !runtimeOnly
            && !(effectiveFilters && effectiveFilters.length > 0)
            && !hasRuntimeVariables
            && !isExport;
          if (chartTraceContext && shouldPersist) {
            chartPersistEvent = await startEvent(chartTraceContext, "chart_persist_started", {
              chartId: id,
              getCache: Boolean(effectiveGetCache),
              noSource: Boolean(effectiveNoSource),
            });
          }

          if (isExport) return chartData.configuration;

          // update the datasets if needed
          const datasetsPromises = [];
          if (shouldUpdateConditionOptions && chartData.conditionsOptions) {
            chartData.conditionsOptions.forEach((opt) => {
              if (opt.dataset_id) {
                const cdc = gChart.ChartDatasetConfigs.find((d) => `${d.id}` === `${opt.dataset_id}`
                  || `${d.dataset_id}` === `${opt.dataset_id}`);
                const cdcConditions = cdc?.conditions !== undefined && cdc?.conditions !== null
                  ? cdc.conditions
                  : cdc?.Dataset?.conditions;

                if (Array.isArray(cdcConditions)) {
                  const newConditions = cdcConditions.map((c) => {
                    const optCondition = opt.conditions.find((o) => o.field === c.field);
                    let values = (optCondition && optCondition.values) || [];
                    values = optCondition?.hideValues ? [] : values.slice(0, 100);

                    return { ...c, values };
                  });

                  datasetsPromises.push(
                    db.ChartDatasetConfig.update(
                      { conditions: newConditions },
                      { where: { id: cdc.id } }
                    )
                  );
                }
              }
            });
          }

          await Promise.all(datasetsPromises);

          let responseChart = gChart;
          if (shouldPersist) {
            const fingerprints = await runtimeCache.buildChartFingerprints(id, project?.timezone);
            snapshotPersistResult = await persistPreparedSnapshot({
              chartId: id,
              fingerprints,
              preparedData: chartData.preparedData,
            });
            responseChart = await this.findById(id, null, { hydratePreparedData: false });
          }

          if (chartTraceContext && chartPersistEvent) {
            await finishEvent(chartTraceContext, chartPersistEvent, "success", {
              chartId: id,
              saved: Boolean(snapshotPersistResult?.saved),
              sizeBytes: snapshotPersistResult?.sizeBytes || null,
            });
          }

          if (preparedOnly) {
            return createPreparedResult(chartData.preparedData, { stale: false });
          }

          return attachPreparedRender(responseChart, chartData, chartData.preparedData, {
            snapshotUpdatedAt: snapshotPersistResult?.saved
              ? snapshotPersistResult.updatedAt
              : responseChart?.preparedDataUpdatedAt,
            stale: false,
            timezone: project?.timezone,
            updatedAt: chartData.preparedData.generatedAt,
          });
        } catch (error) {
          throw toAuditError(error, "persist");
        }
      })
      .then(async (chart) => {
        if (isRuntimeShortCircuit(chart)) {
          if (chartTraceContext && shouldFinalizeAuditRun) {
            await completeRun(chartTraceContext, {
              status: "success",
              summary: {
                chartId: id,
                chartType: gChart?.type || null,
                datasetCount: gChart?.ChartDatasetConfigs?.length || 0,
                labelCount: Object.values(chart.chart?.render?.tabularData || {})
                  .reduce((count, rows) => count + (Array.isArray(rows) ? rows.length : 0), 0),
              },
            });
          }

          return chart.chart;
        }

        let finalChart = chart;

        if (!isExport
          && runtimeChartCacheParams
          && runtimeContext?.cacheableChartPayload?.hasRuntimeFilters
        ) {
          if (!preparedOnly) {
            finalChart = attachRuntimeCacheMetadata(finalChart, {
              cacheStatus: "miss",
              variantHash: runtimeContext.chartVariantHash,
              stale: false,
            });
          }

          await runtimeCache.setPreparedCache({
            ...runtimeChartCacheParams,
            payload: gChartData.preparedData,
          });
          runtimeCache.debugLog("prepared_cache_write_complete", {
            chartId: id,
            viewerScope: runtimeViewerScope,
            chartVersion: runtimeChartVersion,
            variantHash: runtimeContext.chartVariantHash,
          });
        }

        const hasObservationRuntimePayload = ((effectiveFilters && effectiveFilters.length > 0)
          || (effectiveVariables && Object.keys(effectiveVariables).length > 0)
          || runtimeOnly);
        const shouldProcessObservations = !isExport
          && !skipSave
          && !runtimeOnly
          && !effectiveGetCache
          && !effectiveNoSource
          && !hasObservationRuntimePayload
          && Boolean(gChartData?.preparedData);
        if (shouldProcessObservations) {
          try {
            await processChartResult({
              chart: gChart,
              preparedData: gChartData.preparedData,
              refreshedAt: new Date(),
              teamId: project?.team_id || chartTraceContext?.teamId || null,
              updateRunId: chartTraceContext?.runId || null,
              visualization: gChartData.visualization,
            });
          } catch (error) {
            console.error("[observations] Chart result processing failed", error.message); // eslint-disable-line no-console
          }
        }

        if (chartTraceContext && shouldFinalizeAuditRun) {
          await completeRun(chartTraceContext, {
            status: "success",
            summary: {
              chartId: id,
              chartType: gChart?.type || null,
              datasetCount: gChart?.ChartDatasetConfigs?.length || 0,
              labelCount: gChartData?.preparedData?.results
                ?.reduce((count, result) => count + result.rows.length, 0) || 0,
            },
          });
        }

        if (preparedOnly) return finalChart;

        if (returnPreparedData) {
          return {
            chart: finalChart,
            preparedData: gChartData?.preparedData || null,
            snapshot: snapshotPersistResult,
          };
        }

        return finalChart;
      })
      .catch(async (err) => {
        const wrappedError = toAuditError(err, err?.auditStage || "unknown");

        if (chartTraceContext && chartPersistEvent) {
          await finishEvent(chartTraceContext, chartPersistEvent, "failed", {
            chartId: id,
            errorMessage: wrappedError.message,
          });
        }

        if (chartTraceContext && shouldFinalizeAuditRun) {
          await failRun(chartTraceContext, wrappedError, {
            stage: wrappedError.auditStage || "unknown",
            payload: {
              chartId: id,
              projectId: gChart?.project_id || project?.id || null,
            },
            summary: {
              chartId: id,
            },
          });
        }

        return new Promise((_resolve, reject) => reject(wrappedError));
      });
  }

  findConnectionForProject(connectionId, projectId) {
    return db.Project.findByPk(projectId, { attributes: ["team_id"] })
      .then((project) => {
        if (!project) {
          throw new Error(404);
        }
        return this.connectionController.findByIdAndTeam(connectionId, project.team_id);
      });
  }

  testQuery(chart, projectId) {
    return this.findConnectionForProject(chart.connection_id, projectId)
      .then((connection) => {
        const source = findSourceForConnection(connection);
        if (source?.backend?.runChartQuery) {
          assertSourceServerEnabled(source);
          return source.backend.runChartQuery({ connection, query: chart.query });
        }

        return new Promise((resolve, reject) => reject("The connection type is not supported"));
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

        return this.findConnectionForProject(chart.connection_id, projectId);
      })
      .then((connection) => {
        if (noSource === "true") {
          return new Promise((resolve) => resolve(connection));
        }

        const source = findSourceForConnection(connection);
        if (source?.backend?.runChartQuery) {
          assertSourceServerEnabled(source);
          return source.backend.runChartQuery({ connection, query: chart.query });
        }

        return new Promise((resolve, reject) => reject("The connection type is not supported"));
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
        if (!data?.chart || !Array.isArray(data.datasets)) {
          throw new Error("Chart preview data is not available");
        }
        const compiled = new VisualizationEngine(data).render();
        return attachPreparedRender(data.chart, compiled, compiled.preparedData, {
          stale: false,
          updatedAt: compiled.preparedData.generatedAt,
        });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  exportChartData(userId, chartIds, filters, projectId, exportMode = "source") {
    const parsedChartIds = Array.isArray(chartIds)
      ? [...new Set(chartIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0))]
      : [];

    if (parsedChartIds.length === 0) {
      return Promise.reject(new Error("Invalid chart IDs"));
    }

    const whereCondition = { id: parsedChartIds };
    if (projectId) {
      whereCondition.project_id = projectId;
    }

    return db.Chart.findAll({
      where: whereCondition,
      include: [{ model: db.ChartDatasetConfig, include: [{ model: db.Dataset }] }],
      order: [[db.ChartDatasetConfig, "order", "ASC"]],
    })
      .then((charts) => {
        if (charts.length !== parsedChartIds.length) {
          return Promise.reject(new Error("One or more charts are not accessible"));
        }

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
                isExport: true,
                exportMode,
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
    let chart = await this.findById(chartShare.chart_id);
    const project = await db.Project.findByPk(chart.project_id);
    const team = await db.Team.findByPk(project.team_id);

    if (!chart.public && !chart.shareable) {
      return Promise.reject("401");
    }
    chart = await this.hydratePreparedChart(chart, {
      refresh: true,
      timezone: project.timezone,
    });

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
        // oxlint-disable-next-line no-console
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
    const decodedToken = verifyShareToken(queryParams.token);
    validateShareTokenPolicy(decodedToken, sharePolicy, "Chart", sharePolicy.entity_id);

    let chart = await this.findById(sharePolicy.entity_id);
    const project = await db.Project.findByPk(chart.project_id);
    const team = await db.Team.findByPk(project.team_id);
    chart = await this.hydratePreparedChart(chart, {
      refresh: true,
      timezone: project.timezone,
    });

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
        // oxlint-disable-next-line no-console
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

    if (sharePolicy.entity_type !== "Chart" || `${sharePolicy.entity_id}` !== `${chartId}`) {
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
      sub: { type: "Chart", id: chartId, sharePolicyId: sharePolicy.id },
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

    // Use the SharePolicy's share_string instead of Chartshares
    const shareString = sharePolicy.share_string;
    const url = `${settings.client}/chart/${shareString}/share?token=${token}`;

    return { token, url, sharePolicy };
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
      legend: data.legend || getDatasetName(dataset),
      chart_id: chartId,
    })
      .then(async (chartDatasetConfig) => {
        await this.syncLegacyVisualization(chartId, {}, {
          addBinding: chartDatasetConfig.id,
        });
        await markDatasetIntelligenceStale(chartDatasetConfig.dataset_id);
        return chartDatasetConfig;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  async updateChartDatasetConfig(id, data) {
    return db.ChartDatasetConfig.update(data, { where: { id } })
      .then(async () => {
        const chartDatasetConfig = await db.ChartDatasetConfig.findByPk(id);
        if (chartDatasetConfig && shouldSyncLegacyCdc(data)) {
          await this.syncLegacyVisualization(chartDatasetConfig.chart_id, {}, {
            bindingId: chartDatasetConfig.id,
            cdcData: data,
          });
        }
        await markDatasetIntelligenceStale(chartDatasetConfig?.dataset_id);
        return chartDatasetConfig;
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  async deleteChartDatasetConfig(id) {
    const chartDatasetConfig = await db.ChartDatasetConfig.findByPk(id);
    return db.ChartDatasetConfig.destroy({ where: { id } })
      .then(async (result) => {
        if (chartDatasetConfig) {
          await this.syncLegacyVisualization(chartDatasetConfig.chart_id, {}, {
            removeBinding: chartDatasetConfig.id,
          });
          await markDatasetIntelligenceStale(chartDatasetConfig.dataset_id);
        }
        return result;
      })
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

  /**
   * Create a chart with all its chart dataset configs in one go
   * @param {Object} data - Chart data with chartDatasetConfigs array
   * @param {Array} data.chartDatasetConfigs - Array of chart dataset config objects to create
   * @returns {Promise<Object>} Created chart with all chart dataset configs
   */
  async createWithChartDatasetConfigs(data, user, options = {}) {
    if (!options.transaction) {
      const chart = await db.sequelize.transaction((transaction) => this.createWithChartDatasetConfigs(data, user, {
        ...options, transaction, skipBackgroundUpdate: true,
      }));
      if (!options.skipBackgroundUpdate) {
        const update = this.updateChartData(chart.id, user, options.waitForData ? { getCache: true } : {});
        if (options.waitForData) await update;
        else update.catch(() => null);
      }
      return this.findById(chart.id);
    }
    const { transaction, skipBackgroundUpdate = false, waitForData = false } = options;
    const {
      chartDatasetConfigs = [],
      ...chartData
    } = data;
    const canonicalChartData = removeRuntimeChartFields(chartData);

    // Filter out legacy fields and auto-populated fields
    const legacyFields = ["dashboardOrder", "chartSize"];
    const autoPopulatedFields = [];

    const cleanChartData = {};
    const allowedFields = [
      "project_id", "name", "type", "subType", "public", "shareable",
      "displayLegend", "pointRadius", "dataLabels", "startDate", "endDate",
      "dateVarsFormat", "includeZeros", "currentEndDate", "fixedStartDate",
      "timeInterval", "autoUpdate", "draft", "mode", "maxValue", "minValue",
      "disabledExport", "onReport", "xLabelTicks", "stacked", "horizontal",
      "showGrowth", "invertGrowth", "layout", "snapshotToken", "isLogarithmic",
      "content", "ranges", "dashedLastPoint", "defaultRowsPerPage", "visualization"
    ];

    allowedFields.forEach((field) => {
      if (canonicalChartData[field] !== undefined
        && !legacyFields.includes(field)
        && !autoPopulatedFields.includes(field)
      ) {
        cleanChartData[field] = canonicalChartData[field];
      }
    });

    const chart = await createPlacedChart(cleanChartData, {
      transaction, preserveLayout: options.preserveLayout === true,
    });

    // Delete chart cache if user is provided
    if (user) {
      this.chartCache.remove(user.id, chart.id);
    }

    // Create all chart dataset configs
    let createdChartDatasetConfigs = [];
    if (chartDatasetConfigs && chartDatasetConfigs.length > 0) {
      // Fetch datasets to get their legend for default values
      const datasetIds = chartDatasetConfigs.map((cdc) => cdc.dataset_id).filter(Boolean);
      const datasets = await db.Dataset.findAll({
        where: { id: datasetIds },
        transaction,
      });
      const datasetMap = {};
      datasets.forEach((ds) => {
        datasetMap[ds.id] = ds;
      });

      createdChartDatasetConfigs = await Promise.all(
        chartDatasetConfigs.map((cdcData) => {
          const dataset = datasetMap[cdcData.dataset_id];

          const cdcToCreate = {
            ...cdcData,
            chart_id: chart.id,
            legend: cdcData.legend || getDatasetName(dataset) || null
          };
          [
            "Dataset",
            "bindingId",
            "createdAt",
            "id",
            "templateBindingId",
            "updatedAt",
          ].forEach((field) => delete cdcToCreate[field]);

          return db.ChartDatasetConfig.create(cdcToCreate, { transaction });
        })
      );
    }

    if (cleanChartData.visualization && createdChartDatasetConfigs.length > 0) {
      const visualization = remapVisualizationBindings(
        cleanChartData.visualization,
        chartDatasetConfigs,
        createdChartDatasetConfigs
      );
      await chart.update({ visualization }, { transaction });
    }

    await this.syncLegacyVisualization(chart.id, { transaction });

    // AI previews need the prepared snapshot before they can be returned or exported.
    if (!skipBackgroundUpdate) {
      const update = this.updateChartData(chart.id, user, waitForData ? { getCache: true } : {});
      if (waitForData) await update;
      else update.catch(() => null);
    }

    // Return the full chart with all chart dataset configs
    return this.findById(chart.id, null, { transaction });
  }
}

module.exports = ChartController;
