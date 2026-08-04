const fs = require("fs");
const path = require("path");

const { getObservationPolicy } = require("../modules/observations/policy");
const { replayCorpus } = require("../modules/observations/policyReplay");

const OPTION_FIELDS = {
  "minimum-percentage-point-change": "minimumPercentagePointChange",
  "minimum-relative-change": "minimumRelativeChange",
  "publish-score": "publishScore",
  "scoring-version": "scoringVersion",
};

function getUsage() {
  return [
    "Usage: npm run observations:replay -- <corpus.json> [options]",
    "",
    "Options:",
    "  --publish-score=<0-1>",
    "  --minimum-relative-change=<number>",
    "  --minimum-percentage-point-change=<number>",
    "  --scoring-version=<version>",
    "  --json",
  ].join("\n");
}

function parseArguments(args) {
  const corpusPath = args.find((value) => !value.startsWith("--"));
  if (!corpusPath) throw new Error(getUsage());
  const overrides = {};
  let json = false;
  args.filter((value) => value.startsWith("--")).forEach((value) => {
    if (value === "--json") {
      json = true;
      return;
    }
    const [rawName, rawValue] = value.slice(2).split("=");
    const field = OPTION_FIELDS[rawName];
    if (!field || rawValue === undefined || rawValue === "") {
      throw new Error(`Unknown or incomplete option: ${value}\n\n${getUsage()}`);
    }
    overrides[field] = field === "scoringVersion" ? rawValue : Number(rawValue);
    if (field !== "scoringVersion" && !Number.isFinite(overrides[field])) {
      throw new Error(`Choose a numeric value for --${rawName}`);
    }
    if (field === "publishScore" && (overrides[field] < 0 || overrides[field] > 1)) {
      throw new Error("Choose a publish score between 0 and 1");
    }
    if (["minimumPercentagePointChange", "minimumRelativeChange"].includes(field)
      && overrides[field] < 0) {
      throw new Error(`Choose a non-negative value for --${rawName}`);
    }
  });
  return { corpusPath, json, overrides };
}

function formatReport(report) {
  const lines = [
    "Observation policy replay",
    `${report.summary.cases} scenarios · ${report.summary.expectedMatches}/${report.summary.expectedCases} expected outcomes matched`,
    `Published: ${report.summary.referencePublished} current → ${report.summary.candidatePublished} proposed`,
    `Changed decisions: ${report.summary.decisionsChanged} · False positives: ${report.summary.falsePositives} · False negatives: ${report.summary.falseNegatives}`,
  ];
  const changed = report.results.filter((result) => result.changed);
  if (changed.length > 0) {
    lines.push("", "Changed scenarios:");
    changed.forEach((result) => {
      lines.push(
        `- ${result.id}: ${result.reference.publish ? "publish" : "suppress"} → ${result.candidate.publish ? "publish" : "suppress"}`
      );
    });
  }
  return lines.join("\n");
}

function run(args = process.argv.slice(2)) {
  const { corpusPath, json, overrides } = parseArguments(args);
  const resolvedPath = path.resolve(process.cwd(), corpusPath);
  const corpus = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  const referencePolicy = getObservationPolicy();
  const candidatePolicy = { ...referencePolicy, ...overrides };
  const report = replayCorpus(corpus, referencePolicy, candidatePolicy);
  const output = {
    candidatePolicy: {
      minimumPercentagePointChange: candidatePolicy.minimumPercentagePointChange,
      minimumRelativeChange: candidatePolicy.minimumRelativeChange,
      publishScore: candidatePolicy.publishScore,
      scoringVersion: candidatePolicy.scoringVersion,
    },
    corpus: resolvedPath,
    ...report,
  };
  process.stdout.write(`${json ? JSON.stringify(output, null, 2) : formatReport(output)}\n`);
  return report;
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatReport,
  getUsage,
  parseArguments,
  run,
};
