const WORKER_STATUSES = new Set(["complete", "failed", "partial"]);

function createWorkerError(message, code = "WORKER_OUTPUT_INVALID") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function assertObjectKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createWorkerError(`${label} must be an object`);
  }
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw createWorkerError(`${label} contains an unsupported field`);
  }
}

function getBoundedStrings(value, maximum, label) {
  if (!Array.isArray(value) || value.length > maximum
    || value.some((item) => typeof item !== "string" || item.length > 200)) {
    throw createWorkerError(`${label} must be a bounded string list`);
  }
  return [...new Set(value)];
}

function getRegistryFact(factRegistry, factId) {
  return factRegistry instanceof Map ? factRegistry.get(factId) : factRegistry?.[factId];
}

function normalizeWorkerFact(fact, options) {
  assertObjectKeys(fact, new Set([
    "evidenceRefs",
    "factId",
    "factType",
    "state",
  ]), "Worker fact");
  if (typeof fact.factId !== "string" || !fact.factId || fact.factId.length > 200
    || typeof fact.factType !== "string" || !fact.factType || fact.factType.length > 80
    || typeof fact.state !== "string" || !fact.state || fact.state.length > 80) {
    throw createWorkerError("A worker fact identifier or state is not valid");
  }
  if (!options.allowedFactIds?.has(fact.factId)) {
    throw createWorkerError("A worker returned a fact outside its server evidence", "WORKER_FACT_FORBIDDEN");
  }
  const serverFact = getRegistryFact(options.factRegistry, fact.factId);
  if (!serverFact) {
    throw createWorkerError("A worker returned an unknown server fact", "WORKER_FACT_UNKNOWN");
  }
  if (serverFact.factType !== fact.factType || serverFact.state !== fact.state) {
    throw createWorkerError("A worker changed server fact metadata", "WORKER_FACT_CHANGED");
  }
  const evidenceRefs = getBoundedStrings(fact.evidenceRefs || [], 20, "Fact evidence");
  const allowedEvidenceRefs = new Set(serverFact.evidenceRefs || []);
  if (evidenceRefs.some((reference) => !allowedEvidenceRefs.has(reference))) {
    throw createWorkerError("A worker returned unknown fact evidence", "WORKER_EVIDENCE_FORBIDDEN");
  }
  return {
    evidenceRefs,
    factId: fact.factId,
    factType: fact.factType,
    state: fact.state,
  };
}

function validateWorkerOutput(rawOutput, options = {}) {
  assertObjectKeys(rawOutput, new Set([
    "coverage",
    "facts",
    "previewPrepared",
    "status",
    "taskId",
    "workerContractVersion",
  ]), "Worker output");
  if (rawOutput.workerContractVersion !== 2
    || !WORKER_STATUSES.has(rawOutput.status)
    || typeof rawOutput.taskId !== "string"
    || rawOutput.taskId !== options.task?.taskId) {
    throw createWorkerError("The worker output version, task, or status is not valid");
  }
  if (!Array.isArray(rawOutput.facts) || rawOutput.facts.length > 100) {
    throw createWorkerError("The worker returned too many facts");
  }
  assertObjectKeys(rawOutput.coverage, new Set([
    "complete",
    "missingEvidence",
    "truncated",
  ]), "Worker coverage");
  if (typeof rawOutput.coverage.complete !== "boolean"
    || typeof rawOutput.coverage.truncated !== "boolean") {
    throw createWorkerError("Worker coverage is not valid");
  }
  if (rawOutput.status === "complete" && !rawOutput.coverage.complete) {
    throw createWorkerError("A complete worker result needs complete coverage");
  }
  if (rawOutput.status === "failed" && rawOutput.facts.length > 0) {
    throw createWorkerError("A failed worker cannot return facts");
  }
  if (typeof rawOutput.previewPrepared !== "boolean") {
    throw createWorkerError("Worker preview state is not valid");
  }
  if (rawOutput.previewPrepared !== Boolean(options.previewPrepared)) {
    throw createWorkerError(
      "The worker preview state does not match the server result",
      "WORKER_PREVIEW_FORBIDDEN"
    );
  }
  return {
    coverage: {
      complete: rawOutput.coverage.complete,
      missingEvidence: getBoundedStrings(
        rawOutput.coverage.missingEvidence || [],
        20,
        "Missing evidence"
      ),
      truncated: rawOutput.coverage.truncated,
    },
    facts: rawOutput.facts.map((fact) => normalizeWorkerFact(fact, options)),
    previewPrepared: rawOutput.previewPrepared,
    status: rawOutput.status,
    taskId: rawOutput.taskId,
    workerContractVersion: 2,
  };
}

function buildFailedWorkerOutput(taskId, failureCode = "worker_failed") {
  return {
    coverage: {
      complete: false,
      missingEvidence: [failureCode],
      truncated: false,
    },
    facts: [],
    previewPrepared: false,
    status: "failed",
    taskId,
    workerContractVersion: 2,
  };
}

module.exports = {
  WORKER_STATUSES,
  buildFailedWorkerOutput,
  createWorkerError,
  validateWorkerOutput,
};
