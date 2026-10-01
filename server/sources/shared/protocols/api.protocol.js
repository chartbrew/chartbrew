const querystring = require("querystring");
const sourceExecution = require("../../../modules/sourceExecution");
const { parseSourceResponse } = require("../../../modules/sourceResponse");
const moment = require("moment");

const db = require("../../../models/models");
const paginateRequests = require("../../../modules/paginateRequests");
const safeRequest = require("../../../modules/safeRequest");
const determineType = require("../../../modules/determineType");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { applyApiVariables } = require("./api.variables");
const { buildChartRuntimeContext } = require("../../../modules/chartRuntimeFilters");
const {
  sanitizeSnippet,
  serializeResponsePreview,
} = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../connectorRuntime");

const getMomentObj = (timezone) => {
  if (timezone) {
    return (...args) => moment(...args).tz(timezone);
  }

  return (...args) => moment.utc(...args);
};

function buildApiPolicyContext(source, connection, overrides = {}) {
  const context = {
    source,
    teamId: overrides.teamId || connection?.team_id || null,
    connectionId: overrides.connectionId || connection?.id || null,
  };

  if (typeof overrides.allowPrivateHost === "boolean") {
    context.allowPrivateHost = overrides.allowPrivateHost;
  } else if (overrides.allowPrivateHost === null) {
    context.allowPrivateHost = null;
  } else if (typeof connection?.allowPrivateHost === "boolean") {
    context.allowPrivateHost = connection.allowPrivateHost;
  } else {
    context.allowPrivateHost = null;
  }

  return context;
}

function isArrayPresent(responseData) {
  let arrayFound = false;
  Object.keys(responseData).forEach((k1) => {
    if (determineType(responseData[k1]) === "array") {
      arrayFound = true;
    }

    if (!arrayFound && determineType(responseData[k1]) === "object") {
      Object.keys(responseData[k1]).forEach((k2) => {
        if (determineType(responseData[k1][k2]) === "array") {
          arrayFound = true;
        }

        if (!arrayFound && determineType(responseData[k1][k2]) === "object") {
          Object.keys(responseData[k1][k2]).forEach((k3) => {
            if (determineType(responseData[k1][k2][k3]) === "array") {
              arrayFound = true;
            }
          });
        }
      });
    }
  });

  return arrayFound;
}

async function getSavedConnection(connectionOrId) {
  const connectionId = typeof connectionOrId === "object" ? connectionOrId?.id : connectionOrId;

  if (!connectionId) {
    return connectionOrId;
  }

  const savedConnection = await db.Connection.findByPk(connectionId);
  return savedConnection || connectionOrId;
}

function getApiTestOptions(connection) {
  if (connection.type !== "api") return false;

  const testOptions = {
    url: connection.host,
    method: "GET",
    headers: {},
    resolveWithFullResponse: true,
  };

  let globalHeaders = connection.options;
  if (connection.getHeaders) {
    globalHeaders = connection.getHeaders(connection);
  } else if (connection.authentication && connection.authentication.type === "bearer_token") {
    testOptions.headers.authorization = `Bearer ${connection.authentication.token}`;
  }

  if (globalHeaders && globalHeaders.length > 0) {
    for (const option of globalHeaders) {
      testOptions.headers[Object.keys(option)[0]] = option[Object.keys(option)[0]];
    }
  }

  if (connection.authentication && connection.authentication.type === "basic_auth") {
    testOptions.auth = {
      user: connection.authentication.user,
      pass: connection.authentication.pass,
    };
  }

  return testOptions;
}

function testApi(data, policyContext = {}) {
  const testOpt = getApiTestOptions(data);
  return safeRequest(testOpt, policyContext);
}

function testUnsavedConnection({ connection }) {
  if (connection.type !== "api") {
    return Promise.reject(new Error("No request type specified"));
  }

  return testApi(connection, buildApiPolicyContext(
    "connection_type_test",
    null,
    {
      teamId: connection.team_id || null,
      connectionId: null,
      allowPrivateHost: null,
    }
  ));
}

async function testConnection({ connection }) {
  const savedConnection = await getSavedConnection(connection);
  const response = await testApi(
    savedConnection,
    buildApiPolicyContext("connection_test", savedConnection)
  );

  if (response.statusCode < 300) {
    return { success: true };
  }

  throw new Error(400);
}

async function previewDataRequest({
  connection,
  dataRequest,
  itemsLimit,
  items,
  offset,
  pagination,
  paginationField,
}) {
  const savedConnection = await getSavedConnection(connection);
  const limit = itemsLimit ? parseInt(itemsLimit, 10) : 0;
  const policyContext = buildApiPolicyContext("api_request_test", savedConnection);
  const tempUrl = `${savedConnection.getApiUrl(savedConnection)}${dataRequest.route || ""}`;
  const queryParams = querystring.parse(tempUrl.split("?")[1]);

  let url = tempUrl;
  if (url.indexOf("?") > -1) {
    url = tempUrl.substring(0, tempUrl.indexOf("?"));
  }

  const options = {
    url,
    method: dataRequest.method || "GET",
    headers: {},
    qs: queryParams,
    resolveWithFullResponse: true,
    simple: false,
  };

  let headers = {};
  if (dataRequest.useGlobalHeaders) {
    const globalHeaders = savedConnection.getHeaders(savedConnection);
    for (const opt of globalHeaders) {
      headers = Object.assign(opt, headers);
    }

    if (dataRequest.headers) {
      headers = Object.assign(dataRequest.headers, headers);
    }
  }

  options.headers = headers;

  if (dataRequest.body && dataRequest.method !== "GET") {
    options.body = dataRequest.body;
    options.headers["Content-Type"] = "application/json";
  }

  if (pagination) {
    if ((options.url.indexOf(`?${items}=`) || options.url.indexOf(`&${items}=`))
      && (options.url.indexOf(`?${offset}=`) || options.url.indexOf(`&${offset}=`))
    ) {
      return sourceExecution.runSourceExecution({ connection: savedConnection, dataRequest, cacheHit: false }, () => {
        return paginateRequests(dataRequest.template, { options, limit, items, offset, paginationField, policyContext });
      });
    }
  }

  return sourceExecution.runSourceExecution({
    connection: savedConnection, dataRequest, cacheHit: false,
  }, async () => {
    const response = await safeRequest(options, policyContext);
    const data = parseSourceResponse(response);
    return pagination ? response : data;
  });
}

async function runDataRequest({
  connection,
  dataRequest,
  chartId,
  getCache,
  filters = [],
  timezone = "",
  variables = {},
  auditContext = null,
}) {
  if (getCache) {
    const drCache = await checkAndGetCache(connection.id, dataRequest);
    if (drCache) {
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType: "api",
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  const limit = dataRequest.itemsLimit
    ? parseInt(dataRequest.itemsLimit, 10) : 0;
  const { variables: requestVariables } = dataRequest;
  const savedConnection = await getSavedConnection(connection);
  const policyContext = buildApiPolicyContext("api_request_run", savedConnection);

  try {
    let processedRoute = dataRequest.route || "";
    let processedHeaders = dataRequest.headers || {};
    let processedBody = dataRequest.body || "";

    const result = applyApiVariables(dataRequest, variables);
    processedRoute = result.processedRoute || processedRoute;
    processedHeaders = result.processedHeaders || processedHeaders;
    processedBody = result.processedBody || processedBody;

    let tempUrl = savedConnection.getApiUrl(savedConnection);
    let route = processedRoute;
    if (route && (route[0] !== "/" && route[0] !== "?")) {
      route = `/${route}`;
    }

    tempUrl += route;

    const queryParams = querystring.parse(tempUrl.split("?")[1]);

    if (queryParams && Object.keys(queryParams).length > 0) {
      if (dataRequest.VariableBindings && dataRequest.VariableBindings.length > 0) {
        for (const q of Object.keys(queryParams)) {
          const paramValue = queryParams[q];
          if (typeof paramValue === "string") {
            let processedValue = paramValue;
            const variableMatches = [...paramValue.matchAll(/\{\{([^}]+)\}\}/g)];

            for (const match of variableMatches) {
              const variableName = match[1].trim();

              if (variableName === "start_date" || variableName === "end_date") {
                // oxlint-disable-next-line no-continue
                continue;
              }

              const binding = dataRequest.VariableBindings
                .find((vb) => vb.name === variableName);
              const runtimeValue = variables[variableName];
              const hasRuntimeValue = runtimeValue !== null
                && runtimeValue !== undefined && runtimeValue !== "";
              const hasDefaultValue = binding?.default_value !== null
                && binding?.default_value !== undefined
                && binding?.default_value !== "";

              if (hasRuntimeValue) {
                let replacementValue = runtimeValue;

                if (binding?.type) {
                  switch (binding.type) {
                    case "number":
                      replacementValue = Number.isNaN(Number(runtimeValue))
                        ? "0" : String(runtimeValue);
                      break;
                    case "boolean":
                      replacementValue = (runtimeValue === "true" || runtimeValue === true)
                        ? "true" : "false";
                      break;
                    default:
                      replacementValue = String(runtimeValue);
                  }
                } else {
                  replacementValue = String(runtimeValue);
                }

                processedValue = processedValue.replace(match[0], replacementValue);
              } else if (hasDefaultValue && binding) {
                let replacementValue = binding.default_value;

                if (binding.type) {
                  switch (binding.type) {
                    case "number":
                      replacementValue = Number.isNaN(Number(binding.default_value))
                        ? "0" : String(binding.default_value);
                      break;
                    case "boolean":
                      replacementValue = binding.default_value === "true"
                        || binding.default_value === true ? "true" : "false";
                      break;
                    default:
                      replacementValue = String(binding.default_value);
                  }
                } else {
                  replacementValue = String(binding.default_value);
                }

                processedValue = processedValue.replace(match[0], replacementValue);
              } else {
                if (binding?.required) {
                  throw new Error(`Required variable '${variableName}' has no value provided and no default value`);
                }

                processedValue = processedValue.replace(match[0], "");
              }
            }

            queryParams[q] = processedValue;
          }
        }
      }

      const keysFound = {};
      Object.keys(queryParams).forEach((q) => {
        const paramValue = queryParams[q];
        if (paramValue === "{{start_date}}") {
          keysFound[q] = { type: "startDate", format: "single" };
        } else if (paramValue === "{{end_date}}") {
          keysFound[q] = { type: "endDate", format: "single" };
        } else if (typeof paramValue === "string") {
          const startDateMatch = paramValue.match(/{{start_date}}/);
          const endDateMatch = paramValue.match(/{{end_date}}/);
          if (startDateMatch || endDateMatch) {
            keysFound[q] = {
              type: "combined",
              hasStartDate: !!startDateMatch,
              hasEndDate: !!endDateMatch,
              originalValue: paramValue
            };
          }
        }
      });

      if (Object.keys(keysFound).length > 0) {
        const chart = await db.Chart.findByPk(chartId);
        const runtimeContext = chart
          ? buildChartRuntimeContext(chart, filters, variables, timezone)
          : null;
        const effectiveDateRange = runtimeContext?.effectiveDateRange;

        if (chart && effectiveDateRange) {
          Object.keys(keysFound).forEach((q) => {
            const value = keysFound[q];
            const startDate = effectiveDateRange.startDate;
            const endDate = effectiveDateRange.endDate;

            if (value.format === "single") {
              if (value.type === "startDate" && startDate) {
                queryParams[q] = startDate.format(chart.dateVarsFormat || "");
              } else if (value.type === "endDate" && endDate) {
                queryParams[q] = endDate.format(chart.dateVarsFormat || "");
              }
            } else if (value.type === "combined") {
              let formattedValue = value.originalValue;
              if (value.hasStartDate && startDate) {
                formattedValue = formattedValue.replace(/{{start_date}}/g, startDate.format(chart.dateVarsFormat || ""));
              }
              if (value.hasEndDate && endDate) {
                formattedValue = formattedValue.replace(/{{end_date}}/g, endDate.format(chart.dateVarsFormat || ""));
              }
              queryParams[q] = formattedValue;
            }
          });
        } else if (requestVariables?.startDate?.value && requestVariables?.endDate?.value) {
          Object.keys(keysFound).forEach((q) => {
            const value = keysFound[q];
            const startDate = getMomentObj(timezone)(requestVariables.startDate.value);
            const endDate = getMomentObj(timezone)(requestVariables.endDate.value);

            if (value.format === "single") {
              if (value.type === "startDate" && startDate) {
                queryParams[q] = startDate.format(requestVariables.dateFormat?.value || "");
              } else if (value.type === "endDate" && endDate) {
                queryParams[q] = endDate.format(requestVariables.dateFormat?.value || "");
              }
            } else if (value.type === "combined") {
              let formattedValue = value.originalValue;
              if (value.hasStartDate && startDate) {
                formattedValue = formattedValue.replace(/{{start_date}}/g, startDate.format(requestVariables.dateFormat?.value || ""));
              }
              if (value.hasEndDate && endDate) {
                formattedValue = formattedValue.replace(/{{end_date}}/g, endDate.format(requestVariables.dateFormat?.value || ""));
              }
              queryParams[q] = formattedValue;
            }
          });
        }
      }
    }

    let url = tempUrl;
    if (url.indexOf("?") > -1) {
      url = tempUrl.substring(0, tempUrl.indexOf("?"));
    }

    if (queryParams && Object.keys(queryParams).length > 0) {
      Object.keys(queryParams).forEach((q) => {
        if (queryParams[q] === "{{start_date}}" || queryParams[q] === "{{end_date}}") {
          delete queryParams[q];
        }
      });
    }

    const options = {
      url,
      method: dataRequest.method || "GET",
      headers: {},
      qs: queryParams,
      resolveWithFullResponse: true,
      simple: false,
    };

    let headers = {};
    if (dataRequest.useGlobalHeaders) {
      const globalHeaders = savedConnection.getHeaders(savedConnection);
      for (const opt of globalHeaders) {
        headers = Object.assign(opt, headers);
      }

      if (processedHeaders) {
        headers = Object.assign(processedHeaders, headers);
      }
    }

    options.headers = headers;

    if (processedBody && dataRequest.method !== "GET") {
      options.body = processedBody;
      options.headers["Content-Type"] = "application/json";
    }

    if (savedConnection.authentication && savedConnection.authentication.type === "basic_auth") {
      options.auth = {
        user: savedConnection.authentication.user,
        pass: savedConnection.authentication.pass,
      };
    }

    if (dataRequest.pagination) {
      const paginatedResponse = await sourceExecution.runSourceExecution({
        connection: savedConnection, dataRequest, auditContext, chartId, cacheHit: false,
      }, () => paginateRequests(dataRequest.template, {
        options,
        limit,
        items: dataRequest.items,
        offset: dataRequest.offset,
        paginationField: dataRequest.paginationField,
        policyContext,
      }));

      const dataToCache = {
        dataRequest,
        responseData: {
          data: paginatedResponse,
        },
        connection_id: savedConnection.id,
      };

      await drCacheController.create(dataRequest.id, dataToCache);
      await completeConnectorAudit(auditContext, {
        cacheHit: false,
        connectionType: "api",
        paginated: true,
        ...serializeResponsePreview(dataToCache.responseData),
      });

      return dataToCache;
    }

    const { response, data } = await sourceExecution.runSourceExecution({
      connection: savedConnection, dataRequest, auditContext, chartId, cacheHit: false,
    }, async () => {
      const fetchedResponse = await safeRequest(options, policyContext);
      return { response: fetchedResponse, data: parseSourceResponse(fetchedResponse) };
    });

    const responseData = determineType(data) === "object" && !isArrayPresent(data) ? [data] : data;
    const dataToCache = {
      dataRequest,
      responseData: { data: responseData },
      connection_id: savedConnection.id,
    };

    await drCacheController.create(dataRequest.id, dataToCache);
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "api",
      statusCode: response.statusCode,
      bodySnippet: sanitizeSnippet(response.body),
      ...serializeResponsePreview(dataToCache.responseData),
    });

    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, error.auditStage || "connection", {
      cacheHit: false,
      connectionType: "api",
      statusCode: error?.statusCode || (typeof error === "number" ? error : null),
      responseSnippet: sanitizeSnippet(error?.body || error?.error || error?.message || error),
    });
    throw error;
  }
}

async function getBuilderMetadata({ connection, options = {} }) {
  const savedConnection = await getSavedConnection(connection);
  const { includeSensitive = false } = options;
  let globalHeaders = savedConnection.getHeaders(savedConnection);

  if (!Array.isArray(globalHeaders)) {
    try {
      globalHeaders = JSON.parse(globalHeaders);
    } catch {
      globalHeaders = [];
    }
  }

  return {
    host: savedConnection.getApiUrl(savedConnection),
    globalHeaders: globalHeaders.map((header) => {
      const key = Object.keys(header || {})[0];
      const value = key ? header[key] : "";
      let serializedValue = value;
      if (!includeSensitive) {
        serializedValue = value ? "Hidden" : "";
      }
      return {
        key: key || "",
        value: serializedValue,
      };
    }),
    hasGlobalHeaders: globalHeaders.length > 0,
  };
}

module.exports = {
  applyVariables({ dataRequest, variables }) {
    return applyApiVariables(dataRequest, variables);
  },
  buildApiPolicyContext,
  getApiTestOptions,
  getBuilderMetadata,
  previewDataRequest,
  runDataRequest,
  testApi,
  testConnection,
  testUnsavedConnection,
};
