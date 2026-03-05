const counters = {
  ssrf_blocked_total: 0,
  private_target_allowed_total: 0,
  metadata_blocked_total: 0,
};

function incrementSecurityCounter(name) {
  if (!Object.prototype.hasOwnProperty.call(counters, name)) {
    counters[name] = 0;
  }

  counters[name] += 1;
}

function getSecurityCounters() {
  return { ...counters };
}

function logOutboundSecurityEvent(payload) {
  const logPayload = {
    event: "outbound_security_policy",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Keep logs structured so they can be ingested in log pipelines.
  console.warn(JSON.stringify(logPayload)); // eslint-disable-line no-console
}

module.exports = {
  incrementSecurityCounter,
  getSecurityCounters,
  logOutboundSecurityEvent,
};
