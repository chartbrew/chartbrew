const db = require("../models/models");
const { backfillPreparedSnapshots } = require("../modules/backfillPreparedSnapshots");

function readOption(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

async function run() {
  try {
    const report = await backfillPreparedSnapshots({
      afterId: readOption("after-id"),
      batchSize: readOption("batch-size"),
      force: process.argv.includes("--force"),
      limit: readOption("limit"),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
