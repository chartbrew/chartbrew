const Sequelize = require("sequelize");
const { migrateChartVisualization } = require("../models/scripts/migrateChartVisualization");

async function auditVisualizationMigration() {
  const databaseUrl = process.env.VIZ_AUDIT_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("VIZ_AUDIT_DATABASE_URL is required");
  }

  const sequelize = new Sequelize(databaseUrl, {
    logging: false,
  });

  try {
    await sequelize.authenticate();
    const report = await migrateChartVisualization(sequelize.getQueryInterface(), {
      dryRun: true,
      hasVisualizationColumn: false,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

auditVisualizationMigration().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
