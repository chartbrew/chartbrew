const { scoreCandidate } = require("./scoreCandidate");

const CORPUS_VERSION = 1;

function validateCorpus(corpus) {
  if (!corpus || Number(corpus.version) !== CORPUS_VERSION) {
    throw new Error(`Replay corpus must use version ${CORPUS_VERSION}`);
  }
  if (!Array.isArray(corpus.scenarios) || corpus.scenarios.length === 0) {
    throw new Error("Replay corpus must contain at least one scenario");
  }
  corpus.scenarios.forEach((scenario, index) => {
    if (!scenario?.id || !scenario.baseline || !scenario.monitor) {
      throw new Error(`Replay scenario ${index + 1} is missing an id, baseline, or monitor`);
    }
  });
  return corpus;
}

function serializeDecision(candidate) {
  return {
    publish: Boolean(candidate.publish),
    reason: candidate.reason || null,
    score: Number.isFinite(candidate.score) ? candidate.score : null,
    scoreVersion: candidate.scoreVersion || null,
  };
}

function replayCorpus(corpus, referencePolicy, candidatePolicy) {
  validateCorpus(corpus);
  const results = corpus.scenarios.map((scenario) => {
    const reference = serializeDecision(
      scoreCandidate(scenario.baseline, scenario.monitor, referencePolicy)
    );
    const candidate = serializeDecision(
      scoreCandidate(scenario.baseline, scenario.monitor, candidatePolicy)
    );
    const hasExpectation = typeof scenario.expectedPublish === "boolean";
    return {
      candidate,
      changed: reference.publish !== candidate.publish,
      expectedPublish: hasExpectation ? scenario.expectedPublish : null,
      id: scenario.id,
      matchesExpectation: hasExpectation
        ? candidate.publish === scenario.expectedPublish
        : null,
      reference,
    };
  });
  const expectedResults = results.filter((result) => result.expectedPublish !== null);
  return {
    corpusVersion: CORPUS_VERSION,
    results,
    summary: {
      candidatePublished: results.filter((result) => result.candidate.publish).length,
      cases: results.length,
      decisionsChanged: results.filter((result) => result.changed).length,
      expectedCases: expectedResults.length,
      expectedMatches: expectedResults.filter((result) => result.matchesExpectation).length,
      falseNegatives: expectedResults.filter((result) => (
        result.expectedPublish && !result.candidate.publish
      )).length,
      falsePositives: expectedResults.filter((result) => (
        !result.expectedPublish && result.candidate.publish
      )).length,
      referencePublished: results.filter((result) => result.reference.publish).length,
    },
  };
}

module.exports = {
  CORPUS_VERSION,
  replayCorpus,
  validateCorpus,
};
