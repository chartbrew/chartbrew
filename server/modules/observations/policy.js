const {
  getEnvIntelligencePolicy,
} = require("../intelligence/envPolicyProvider");

function getObservationPolicy() {
  return getEnvIntelligencePolicy().observations;
}

module.exports = {
  getObservationPolicy,
};
