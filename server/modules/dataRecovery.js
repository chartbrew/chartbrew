// Only source adapters create recovery details. Wrappers retain the original cause.
function getDataRecovery(error) {
  let datasetId;
  let connectionId;
  for (let cause = error, depth = 0; cause && depth < 10; cause = cause.cause, depth += 1) {
    datasetId ||= cause.datasetId;
    connectionId ||= cause.connectionId;
    if (cause.recovery) {
      return {
        code: cause.recovery.code,
        action: cause.recovery.action,
        message: cause.recovery.message,
        ...(Number.isSafeInteger(Number(datasetId)) && Number(datasetId) > 0 ? { datasetId: Number(datasetId) } : {}),
        ...(Number.isSafeInteger(Number(connectionId)) && Number(connectionId) > 0 ? { connectionId: Number(connectionId) } : {}),
      };
    }
  }
  return null;
}

module.exports = { getDataRecovery };
