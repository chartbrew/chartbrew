const db = require("../models/models");
const { backfillPreparedSnapshots } = require("../modules/backfillPreparedSnapshots");
const runtimeCache = require("../modules/runtimeCache");

function readOption(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

async function run() {
  try {
    const dryRun = process.argv.includes("--dry-run");
    const quiet = process.argv.includes("--quiet");
    const refreshUnresolved = process.argv.includes("--refresh-unresolved");
    const mode = refreshUnresolved ? "unresolved live refresh" : "local inference";
    let dryRunDetail = "";
    if (dryRun) {
      dryRunDetail = refreshUnresolved
        ? " dry run; source requests enabled and writes disabled"
        : " dry run; no source requests or writes";
    }
    process.stderr.write(`[prepared-backfill] Starting ${mode}${dryRunDetail}.\n`);
    const report = await backfillPreparedSnapshots({
      afterId: readOption("after-id"),
      batchSize: readOption("batch-size"),
      dryRun,
      force: process.argv.includes("--force"),
      limit: readOption("limit"),
      refreshUnresolved,
      onProgress: (event) => {
        if (quiet) return;
        if (event.type === "chart_started") {
          process.stderr.write(
            `[prepared-backfill] Processing chart ${event.chartId} (${event.processed}).\n`
          );
          return;
        }
        const detail = event.message ? `: ${event.message}` : "";
        process.stderr.write(
          `[prepared-backfill] Chart ${event.chartId}: ${event.status}${detail}.\n`
        );
      },
      timeoutMs: readOption("timeout-ms"),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failed > 0 || report.unresolved > 0) process.exitCode = 1;
  } finally {
    try {
      await db.sequelize.close();
    } finally {
      await runtimeCache.close();
    }
  }
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
