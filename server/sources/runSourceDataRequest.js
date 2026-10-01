const { findSourceForConnection } = require("./index");
const { assertSourceServerEnabled } = require("./sourceAvailability");
const { withSourceExecutionContext } = require("../modules/sourceExecution");

function getSourceDataRequestRunner(connection) {
  const source = findSourceForConnection(connection);
  const runDataRequest = source?.backend?.runDataRequest;

  if (!runDataRequest) {
    return null;
  }

  return {
    source,
    runDataRequest,
  };
}

function runSourceDataRequest(options) {
  const runner = getSourceDataRequestRunner(options.connection);

  if (!runner) {
    return null;
  }

  assertSourceServerEnabled(runner.source);

  const trace = options.auditContext?.traceContext || {};
  return withSourceExecutionContext({
    teamId: options.teamId || trace.teamId,
    triggerType: trace.triggerType,
    projectId: options.projectId || trace.projectId,
    chartId: options.chartId || trace.chartId,
    datasetId: options.dataRequest?.dataset_id || trace.datasetId,
    dataRequestId: options.dataRequest?.id,
    runId: trace.runId,
  }, () => runner.runDataRequest({ ...options, source: runner.source }));
}

module.exports = {
  getSourceDataRequestRunner,
  runSourceDataRequest,
};
