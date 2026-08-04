const DEFAULT_SCORING_VERSION = "deterministic-v1";

const SCORING_POLICIES = Object.freeze({
  "deterministic-v1": Object.freeze({
    confidenceSampleCount: 7,
    importanceBonusMaximum: 0.1,
    importanceBonusStep: 0.05,
    magnitudeTarget: 0.2,
    magnitudeWeight: 0.75,
    magnitudeWeightWithoutDeviation: 0.9,
    robustDeviationTarget: 3.5,
    robustDeviationWeight: 0.25,
  }),
});

function getScoringPolicy(version = DEFAULT_SCORING_VERSION) {
  const policy = SCORING_POLICIES[version];
  if (!policy) throw new Error(`Unknown observation scoring version: ${version}`);
  return policy;
}

module.exports = {
  DEFAULT_SCORING_VERSION,
  SCORING_POLICIES,
  getScoringPolicy,
};
