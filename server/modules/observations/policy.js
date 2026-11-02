const { getPlatformIntelligencePolicy } = require("../platformSettings/runtime");

function getObservationPolicy() {
  return getPlatformIntelligencePolicy().observations;
}

module.exports = {
  getObservationPolicy,
};
