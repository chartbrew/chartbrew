const db = require("../models/models");
const ChartController = require("./ChartController");
const DatasetController = require("./DatasetController");
const {
  findAccessibleChart,
  findAccessibleDataset,
} = require("../modules/dataApiAccess");
const { buildChartRuntimeContext } = require("../modules/chartRuntimeFilters");
const { getDataApiLimits, withExecutionDeadline } = require("../modules/dataApiLimits");
const { incrementDataApiMetric } = require("../modules/dataApiMetrics");
const {
  DataApiError,
  matchesEtag,
  serializeDataApiResponse,
} = require("../modules/dataApiResponse");
const {
  parseDataApiId,
  requiresRefreshScope,
  validatePostBody,
} = require("../modules/dataApiValidation");
const {
  createDatasetData,
  getDatasetDataFingerprint,
} = require("../modules/datasetData");
const { loadPreparedSnapshot } = require("../modules/preparedSnapshot");
const runtimeCache = require("../modules/runtimeCache");
const {
  completeRun,
  failRun,
  startRun,
} = require("../modules/updateAudit");
const {
  getPreparedDataFingerprint,
  toPublicPreparedData,
} = require("../visualization/preparedData");
const { filterDatasetResult } = require("../visualization/filterDatasets");

function requestCounts(req) {
  return {
    filterCount: Array.isArray(req.body?.filters) ? req.body.filters.length : 0,
    variableCount: req.body?.variables && typeof req.body.variables === "object"
      && !Array.isArray(req.body.variables)
      ? Object.keys(req.body.variables).length
      : 0,
  };
}

function safeAuditId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function publicError(error, fallbackCode = "INTERNAL_ERROR") {
  if (error instanceof DataApiError) return error;
  if (error?.code === "EXECUTION_TIMEOUT") return new DataApiError("EXECUTION_TIMEOUT");
  return new DataApiError(fallbackCode, { cause: error });
}

class DataApiController {
  constructor() {
    this.chartController = new ChartController();
    this.datasetController = new DatasetController();
  }

  async _run(req, resourceType, identifiers, operation) {
    const startedAt = Date.now();
    const traceContext = await startRun({
      triggerType: "data_api",
      entityType: `${resourceType}_data`,
      status: "running",
      apiKeyId: req.apiKeyAccess.apiKeyId,
      teamId: req.apiKeyAccess.teamId,
      projectId: identifiers.projectId || null,
      chartId: identifiers.chartId || null,
      datasetId: identifiers.datasetId || null,
      summary: {
        apiVersion: "v1",
        method: req.method,
        refresh: req.body?.refresh === true,
        requestId: req.id,
        ...requestCounts(req),
      },
    });

    try {
      const response = await withExecutionDeadline(async (executionContext) => {
        const result = await operation(traceContext, executionContext);
        const notModified = req.method === "GET"
          && matchesEtag(req.get("if-none-match"), result.etag);
        if (notModified) {
          return {
            ...result,
            bytes: 0,
            notModified: true,
            serialized: null,
          };
        }
        const serialization = serializeDataApiResponse(result.body);
        return {
          ...result,
          ...serialization,
          notModified: false,
        };
      }, getDataApiLimits().executionMs);

      await completeRun(traceContext, {
        status: "success",
        summary: {
          apiVersion: "v1",
          dataStale: Boolean(response.stale),
          durationMs: Date.now() - startedAt,
          errorCode: null,
          filterCount: requestCounts(req).filterCount,
          method: req.method,
          refresh: req.body?.refresh === true,
          requestId: req.id,
          responseBytes: response.notModified ? 0 : response.bytes,
          statusCode: response.notModified ? 304 : 200,
          variableCount: requestCounts(req).variableCount,
        },
      });

      incrementDataApiMetric("requests", {
        resourceType,
        statusCode: response.notModified ? 304 : 200,
      });
      incrementDataApiMetric("response_bytes", { resourceType }, response.notModified ? 0 : response.bytes);
      incrementDataApiMetric("duration_ms", { resourceType }, Date.now() - startedAt);
      if (response.stale) incrementDataApiMetric("stale_responses", { resourceType });
      return response;
    } catch (error) {
      const safeError = publicError(error);
      await failRun(traceContext, safeError, {
        stage: "data_api",
        summary: {
          apiVersion: "v1",
          durationMs: Date.now() - startedAt,
          errorCode: safeError.code,
          filterCount: requestCounts(req).filterCount,
          method: req.method,
          refresh: req.body?.refresh === true,
          requestId: req.id,
          responseBytes: 0,
          statusCode: safeError.statusCode,
          variableCount: requestCounts(req).variableCount,
        },
      });
      incrementDataApiMetric("requests", {
        resourceType,
        statusCode: safeError.statusCode,
      });
      if (safeError.code === "EXECUTION_TIMEOUT") {
        incrementDataApiMetric("timeouts", { resourceType });
      }
      if (["REQUEST_TOO_LARGE", "RESPONSE_TOO_LARGE"].includes(safeError.code)) {
        incrementDataApiMetric("size_rejections", { resourceType, type: safeError.code });
      }
      throw safeError;
    }
  }

  _requireRefreshScope(req, request) {
    if (requiresRefreshScope(request)
      && !req.apiKeyAccess.scopes.includes("data:refresh")) {
      throw new DataApiError("API_KEY_SCOPE_REQUIRED");
    }
  }

  async _prepareDefaultChart(chartId, timezone, traceContext, executionContext) {
    const snapshot = await loadPreparedSnapshot(chartId);
    if (snapshot) {
      const fingerprints = await runtimeCache.buildChartFingerprints(chartId, timezone);
      if (snapshot.visualizationFingerprint === fingerprints.visualization) {
        const stale = snapshot.sourceFingerprint !== fingerprints.source;
        if (stale) {
          runtimeCache.triggerBackgroundRefresh(
            `data-api-default-refresh:${chartId}`,
            () => this.chartController.updateChartData(chartId, null, {
              finalizeRun: false,
              getCache: false,
              noSource: false,
              preparedOnly: true,
              traceContext: null,
              viewerScope: "data-api",
            })
          );
        }
        return {
          fingerprint: getPreparedDataFingerprint(snapshot.preparedData),
          generatedAt: snapshot.preparedData.generatedAt,
          preparedData: snapshot.preparedData,
          stale,
        };
      }
    }

    try {
      return await this.chartController.updateChartData(chartId, null, {
        finalizeRun: false,
        getCache: true,
        noSource: false,
        preparedOnly: true,
        traceContext,
        viewerScope: "data-api",
        signal: executionContext?.signal,
        deadlineAt: executionContext?.deadlineAt,
      });
    } catch (error) {
      if (executionContext?.signal?.aborted) throw new DataApiError("EXECUTION_TIMEOUT");
      throw new DataApiError("DATA_UNAVAILABLE", { cause: error });
    }
  }

  async chartData(req) {
    return this._run(req, "chart", {
      projectId: safeAuditId(req.params.project_id),
      chartId: safeAuditId(req.params.chart_id),
    }, async (traceContext, executionContext) => {
      const projectId = parseDataApiId(req.params.project_id);
      const chartId = parseDataApiId(req.params.chart_id);
      const chart = await findAccessibleChart(db, req.apiKeyAccess, projectId, chartId);
      if (!chart) throw new DataApiError("RESOURCE_NOT_FOUND");
      const project = chart.Project || await db.Project.findByPk(projectId, { attributes: ["timezone"] });

      let request = { filters: [], refresh: false, variables: {} };
      if (req.method === "POST") {
        const cdcs = await db.ChartDatasetConfig.findAll({
          attributes: ["id"],
          where: { chart_id: chartId },
        });
        request = validatePostBody(req.body, {
          cdcIds: cdcs.map((cdc) => cdc.id),
          resourceType: "chart",
        });
        this._requireRefreshScope(req, request);
      }

      let result;
      const hasRuntimeValues = request.filters.length > 0 || Object.keys(request.variables).length > 0;
      if (!hasRuntimeValues && !request.refresh) {
        result = await this._prepareDefaultChart(
          chartId,
          project?.timezone,
          traceContext,
          executionContext
        );
      } else {
        try {
          result = await this.chartController.updateChartData(chartId, null, {
            filters: request.filters,
            getCache: !request.refresh,
            noSource: false,
            preparedOnly: true,
            runtimeOnly: hasRuntimeValues,
            skipSave: hasRuntimeValues,
            traceContext,
            finalizeRun: false,
            variables: request.variables,
            viewerScope: "data-api",
            signal: executionContext.signal,
            deadlineAt: executionContext.deadlineAt,
          });
        } catch (error) {
          if (executionContext.signal.aborted) throw new DataApiError("EXECUTION_TIMEOUT");
          throw new DataApiError("DATA_UNAVAILABLE", { cause: error });
        }
      }

      const body = toPublicPreparedData(result.preparedData);
      return {
        body,
        cacheable: req.method === "GET",
        etag: `"pd-v1-${result.fingerprint || getPreparedDataFingerprint(result.preparedData)}"`,
        generatedAt: result.generatedAt,
        stale: result.stale,
      };
    });
  }

  async datasetData(req) {
    return this._run(req, "dataset", {
      datasetId: safeAuditId(req.params.dataset_id),
    }, async (traceContext, executionContext) => {
      const teamId = parseDataApiId(req.params.team_id);
      const datasetId = parseDataApiId(req.params.dataset_id);
      const dataset = await findAccessibleDataset(db, req.apiKeyAccess, teamId, datasetId);
      if (!dataset) throw new DataApiError("RESOURCE_NOT_FOUND");

      let request = { filters: [], refresh: false, timezone: "UTC", variables: {} };
      if (req.method === "POST") {
        request = validatePostBody(req.body, {
          resourceType: "dataset",
          schemaFields: Object.keys(dataset.fieldsSchema || {}),
        });
        this._requireRefreshScope(req, request);
      }

      const runtimeContext = buildChartRuntimeContext(
        {},
        request.filters,
        request.variables,
        request.timezone
      );
      const hasSourceRuntimeValues = runtimeContext.sourceAffecting.hasRuntimeFilters;
      const bypassDefaultSourceCache = request.refresh || hasSourceRuntimeValues;
      let result;
      try {
        result = await this.datasetController.runRequest({
          dataset_id: datasetId,
          team_id: teamId,
          noSource: false,
          getCache: !bypassDefaultSourceCache,
          filters: runtimeContext.sourceAffecting.filters,
          timezone: request.timezone,
          variables: request.variables,
          traceContext,
          teamId,
          runtimeContext,
          viewerScope: "data-api",
          readRuntimeSourceCache: !request.refresh && hasSourceRuntimeValues,
          writeRuntimeSourceCache: hasSourceRuntimeValues,
          maintainDatasetMetadata: req.method === "GET",
          signal: executionContext.signal,
          deadlineAt: executionContext.deadlineAt,
        });
      } catch (error) {
        if (executionContext.signal.aborted) throw new DataApiError("EXECUTION_TIMEOUT");
        throw new DataApiError("DATA_UNAVAILABLE", { cause: error });
      }

      const filteredData = filterDatasetResult(result.data, request.filters, request.timezone);
      const body = createDatasetData({
        dataset: result.options || dataset,
        data: filteredData,
      });
      const fingerprint = getDatasetDataFingerprint(body);
      return {
        body,
        cacheable: req.method === "GET",
        etag: `"dd-v1-${fingerprint}"`,
        generatedAt: body.generatedAt,
        stale: Boolean(result.cacheMetadata?.sourceCache?.stale),
      };
    });
  }
}

module.exports = DataApiController;
