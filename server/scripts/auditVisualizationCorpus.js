const Sequelize = require("sequelize");
const { assertVisualizationSpec } = require("../visualization/spec");
const { legacyChartToVisualization } = require("../visualization/legacyChartToVisualization");

function parseVisualization(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

async function auditVisualizationCorpus() {
  const databaseUrl = process.env.VIZ_AUDIT_DATABASE_URL;
  if (!databaseUrl) throw new Error("VIZ_AUDIT_DATABASE_URL is required");

  const sequelize = new Sequelize(databaseUrl, { logging: false });
  try {
    await sequelize.authenticate();
    const [charts, cdcs, datasets] = await Promise.all([
      sequelize.query("SELECT * FROM `Chart`", { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query("SELECT * FROM `ChartDatasetConfig`", { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query("SELECT * FROM `Dataset`", { type: Sequelize.QueryTypes.SELECT }),
    ]);
    const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
    const cdcsByChart = cdcs.reduce((grouped, cdc) => {
      const values = grouped.get(cdc.chart_id) || [];
      values.push({ ...cdc, Dataset: datasetById.get(cdc.dataset_id) || null });
      grouped.set(cdc.chart_id, values);
      return grouped;
    }, new Map());
    const report = {
      adapterRequired: 0,
      failed: 0,
      failures: [],
      legacyOwned: 0,
      native: 0,
      total: charts.length,
    };

    charts.forEach((chart) => {
      try {
        const stored = parseVisualization(chart.visualization);
        if (stored) {
          assertVisualizationSpec(stored, { allowIncomplete: stored.status !== "ready" });
          if (stored.metadata?.migratedFrom === "legacy") report.legacyOwned += 1;
          else report.native += 1;
          return;
        }

        const converted = legacyChartToVisualization({
          ...chart,
          ChartDatasetConfigs: (cdcsByChart.get(chart.id) || [])
            .sort((left, right) => (left.order || 0) - (right.order || 0)),
        });
        if (!converted.valid) throw new Error(converted.errors.join("; "));
        report.adapterRequired += 1;
      } catch (error) {
        report.failed += 1;
        report.failures.push({ chartId: chart.id, error: error.message });
      }
    });

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

auditVisualizationCorpus().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
