const fs = require("fs");
const path = require("path");

const {
  evaluateOrchestratorRuns,
} = require("../modules/workspaceContext/orchestratorEvaluation");

function readArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function main() {
  const corpusPath = readArgument("corpus")
    || path.join(__dirname, "../tests/fixtures/workspaceOrchestratorEvaluationCorpus.json");
  const corpus = readJson(corpusPath);
  const inputPath = readArgument("input");
  if (!inputPath) {
    process.stdout.write(`${JSON.stringify({
      cases: corpus.cases.length,
      corpusVersion: corpus.corpusVersion,
      readyForRecordedRuns: true,
    }, null, 2)}\n`);
    return;
  }
  const runs = readJson(inputPath);
  const result = evaluateOrchestratorRuns(
    runs,
    corpus.cases.map((item) => item.id)
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}

main();
