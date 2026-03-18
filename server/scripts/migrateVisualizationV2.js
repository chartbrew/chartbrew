/* eslint-disable no-console */
const { Op } = require("sequelize");

const db = require("../models/models");
const {
  applyChartVisualizationMigrationReport,
  buildChartVisualizationMigrationReport,
  summarizeVisualizationMigrationReports,
} = require("../modules/visualizationV2/migration");

function parseIdList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseArgs(argv = []) {
  const options = {
    mode: "dry-run",
    chartIds: [],
    projectIds: [],
    teamIds: [],
    limit: null,
    json: false,
    help: false,
  };

  argv.forEach((arg) => {
    if (arg === "--apply") {
      options.mode = "apply";
    } else if (arg === "--dry-run") {
      options.mode = "dry-run";
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help") {
      options.help = true;
    } else if (arg.startsWith("--chart-id=")) {
      options.chartIds = parseIdList(arg.split("=")[1]);
    } else if (arg.startsWith("--project-id=")) {
      options.projectIds = parseIdList(arg.split("=")[1]);
    } else if (arg.startsWith("--team-id=")) {
      options.teamIds = parseIdList(arg.split("=")[1]);
    } else if (arg.startsWith("--limit=")) {
      const parsedLimit = Number.parseInt(arg.split("=")[1], 10);
      options.limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
    }
  });

  return options;
}

function printHelp() {
  console.log("Visualization V2 migration utility");
  console.log("");
  console.log("Usage:");
  console.log("  npm run viz:migrate -- [--dry-run|--apply] [--chart-id=1,2] [--project-id=10] [--team-id=5] [--limit=100] [--json]");
  console.log("");
  console.log("Examples:");
  console.log("  npm run viz:migrate -- --dry-run --project-id=12");
  console.log("  npm run viz:migrate -- --apply --chart-id=10,11");
}

async function fetchCharts(options) {
  const where = {};
  const projectInclude = {
    model: db.Project,
    attributes: ["id", "team_id", "name"],
    required: true,
  };

  if (options.chartIds.length > 0) {
    where.id = { [Op.in]: options.chartIds };
  }

  if (options.projectIds.length > 0) {
    where.project_id = { [Op.in]: options.projectIds };
  }

  if (options.teamIds.length > 0) {
    projectInclude.where = {
      team_id: { [Op.in]: options.teamIds },
    };
  }

  return db.Chart.findAll({
    where,
    attributes: [
      "id",
      "project_id",
      "name",
      "type",
      "mode",
      "includeZeros",
      "timeInterval",
      "pointRadius",
      "stacked",
      "horizontal",
      "dateVarsFormat",
    ],
    include: [
      projectInclude,
      {
        model: db.ChartDatasetConfig,
        attributes: [
          "id",
          "dataset_id",
          "legend",
          "formula",
          "datasetColor",
          "fillColor",
          "fill",
          "pointRadius",
          "sort",
          "maxRecords",
          "goal",
          "vizVersion",
          "vizConfig",
        ],
        include: [{
          model: db.Dataset,
          attributes: [
            "id",
            "xAxis",
            "yAxis",
            "yAxisOperation",
            "dateField",
            "dateFormat",
            "legend",
            "conditions",
            "fieldsSchema",
            "fieldsMetadata",
          ],
        }],
      },
    ],
    order: [["id", "ASC"], [db.ChartDatasetConfig, "order", "ASC"]],
    limit: options.limit || undefined,
  });
}

function buildPayload(options, reports, applyResults) {
  return {
    mode: options.mode,
    filters: {
      chartIds: options.chartIds,
      projectIds: options.projectIds,
      teamIds: options.teamIds,
      limit: options.limit,
    },
    summary: {
      ...summarizeVisualizationMigrationReports(reports),
      appliedChartCount: applyResults.length,
      appliedCdcCount: applyResults.reduce((count, item) => count + item.appliedCdcCount, 0),
    },
    charts: reports,
  };
}

function printHumanReport(payload) {
  console.log(`Visualization V2 migration ${payload.mode}`);
  console.log(`Charts scanned: ${payload.summary.chartCount}`);
  console.log(`Charts ready: ${payload.summary.readyChartCount}`);
  console.log(`Charts already migrated: ${payload.summary.alreadyMigratedChartCount}`);
  console.log(`Charts unsupported: ${payload.summary.unsupportedChartCount}`);
  console.log(`CDCs ready: ${payload.summary.readyCdcCount}`);
  console.log(`CDCs already migrated: ${payload.summary.alreadyMigratedCdcCount}`);
  console.log(`CDCs unsupported: ${payload.summary.unsupportedCdcCount}`);

  if (payload.mode === "apply") {
    console.log(`Charts applied: ${payload.summary.appliedChartCount}`);
    console.log(`CDCs applied: ${payload.summary.appliedCdcCount}`);
  }

  const unsupportedCharts = payload.charts.filter((chart) => chart.status === "unsupported");
  if (unsupportedCharts.length > 0) {
    console.log("");
    console.log("Unsupported charts:");

    unsupportedCharts.slice(0, 20).forEach((chart) => {
      const reason = chart.reasons[0];
      console.log(`- Chart ${chart.chartId} (${chart.chartType || "unknown"}): ${reason?.code || "unknown_reason"}${reason?.cdcId ? ` on ${reason.cdcId}` : ""}`);
    });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const charts = await fetchCharts(options);
  const reports = charts.map((chart) => buildChartVisualizationMigrationReport(chart));
  const applyResults = [];

  if (options.mode === "apply") {
    const readyCharts = charts
      .map((chart) => ({
        chart,
        report: reports.find((item) => item.chartId === chart.id),
      }))
      .filter((item) => item.report?.canApply);

    const appliedResults = await Promise.all(readyCharts.map(async ({ chart, report }) => {
      return db.sequelize.transaction(async (transaction) => {
        return applyChartVisualizationMigrationReport(chart, report, { transaction });
      });
    }));

    applyResults.push(...appliedResults);
  }

  const payload = buildPayload(options, reports, applyResults);

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHumanReport(payload);
  }

  await db.sequelize.close();
}

main()
  .catch(async (error) => {
    console.error(error);

    try {
      await db.sequelize.close();
    } catch (_error) {
      // no-op
    }

    process.exitCode = 1;
  });
