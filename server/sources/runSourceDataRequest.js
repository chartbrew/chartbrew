const { findSourceForConnection } = require("./index");
const { assertSourceServerEnabled } = require("./sourceAvailability");
const { withSourceExecutionContext } = require("../modules/sourceExecution");
const db = require("../models/models");

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

  return Promise.all([
    db.Dataset.findByPk(options.dataRequest?.dataset_id, { attributes: ["team_id"] }),
    db.Connection.findByPk(options.connection.id, { attributes: ["team_id"] }),
  ]).then(([dataset, connection]) => {
    if (!dataset || !connection || dataset.team_id !== connection.team_id) {
      throw new Error("403");
    }

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
  });
}

module.exports = {
  getSourceDataRequestRunner,
  runSourceDataRequest,
};
