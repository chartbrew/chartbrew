const { auditCandidate } = require("./llmAudit");

let auditQueue = Promise.resolve();

function queueObservationAudit(payload) {
  auditQueue = auditQueue
    .then(() => auditCandidate(payload))
    .catch((error) => {
      console.error("[observation-audit] Audit failed", error.message); // oxlint-disable-line no-console
    });
}

module.exports = {
  queueObservationAudit,
};
