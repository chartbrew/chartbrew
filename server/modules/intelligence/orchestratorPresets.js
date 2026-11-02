const DEFAULT_ANALYSIS_DEPTH = "thorough";

const ANALYSIS_DEPTH_PRESETS = Object.freeze({
  standard: Object.freeze({
    maximumParallelWorkers: 2,
    maximumToolCallsPerWorker: 4,
    maximumTotalToolCalls: 8,
    maximumWorkersPerRequest: 2,
  }),
  thorough: Object.freeze({
    maximumParallelWorkers: 2,
    maximumToolCallsPerWorker: 6,
    maximumTotalToolCalls: 12,
    maximumWorkersPerRequest: 3,
  }),
  extended: Object.freeze({
    maximumParallelWorkers: 2,
    maximumToolCallsPerWorker: 6,
    maximumTotalToolCalls: 18,
    maximumWorkersPerRequest: 4,
  }),
});

function getAnalysisDepth(value) {
  return Object.hasOwn(ANALYSIS_DEPTH_PRESETS, value)
    ? value
    : DEFAULT_ANALYSIS_DEPTH;
}

function getAnalysisDepthPreset(value) {
  return ANALYSIS_DEPTH_PRESETS[getAnalysisDepth(value)];
}

module.exports = {
  ANALYSIS_DEPTH_PRESETS,
  DEFAULT_ANALYSIS_DEPTH,
  getAnalysisDepth,
  getAnalysisDepthPreset,
};
