const { legacyToVizConfig } = require("./legacyToVizConfig");

function createIssue(code, message) {
  return { code, message };
}

function normalizeVizVersion(value) {
  return Number.parseInt(value, 10) === 2 ? 2 : 1;
}

function buildChartVisualizationMigrationReport(chart) {
  const cdcReports = [];
  const reasons = [];
  const warnings = [];

  if (
    !chart
    || !Array.isArray(chart.ChartDatasetConfigs)
    || chart.ChartDatasetConfigs.length === 0
  ) {
    return {
      chartId: chart?.id || null,
      projectId: chart?.project_id || null,
      chartType: chart?.type || null,
      status: "unsupported",
      supported: false,
      canApply: false,
      reasons: [createIssue("missing_cdcs", "Chart must have at least one chart dataset config to migrate.")],
      warnings,
      cdcReports,
    };
  }

  const versions = new Set(
    chart.ChartDatasetConfigs.map((cdc) => normalizeVizVersion(cdc?.vizVersion))
  );
  if (versions.size > 1) {
    reasons.push(
      createIssue(
        "mixed_viz_versions",
        "Chart contains a mix of legacy and V2 CDCs. Migration must be applied at whole-chart scope."
      )
    );
  }

  chart.ChartDatasetConfigs.forEach((cdc) => {
    const report = legacyToVizConfig({
      chart,
      dataset: cdc?.Dataset || null,
      cdc,
    });

    cdcReports.push({
      chartId: chart.id,
      cdcId: cdc.id,
      datasetId: cdc.dataset_id,
      ...report,
    });

    if (Array.isArray(report.warnings)) {
      warnings.push(...report.warnings.map((warning) => ({ ...warning, cdcId: cdc.id })));
    }
  });

  if (reasons.length > 0) {
    return {
      chartId: chart.id,
      projectId: chart.project_id,
      chartType: chart.type,
      status: "unsupported",
      supported: false,
      canApply: false,
      reasons,
      warnings,
      cdcReports,
    };
  }

  const unsupportedReports = cdcReports.filter((report) => report.status === "unsupported");
  if (unsupportedReports.length > 0) {
    return {
      chartId: chart.id,
      projectId: chart.project_id,
      chartType: chart.type,
      status: "unsupported",
      supported: false,
      canApply: false,
      reasons: unsupportedReports.flatMap((report) => {
        return report.reasons.map((reason) => ({ ...reason, cdcId: report.cdcId }));
      }),
      warnings,
      cdcReports,
    };
  }

  const readyReports = cdcReports.filter((report) => report.status === "ready");
  const alreadyMigratedReports = cdcReports.filter((report) => report.status === "already_migrated");

  if (alreadyMigratedReports.length === cdcReports.length) {
    return {
      chartId: chart.id,
      projectId: chart.project_id,
      chartType: chart.type,
      status: "already_migrated",
      supported: false,
      canApply: false,
      reasons,
      warnings,
      cdcReports,
    };
  }

  return {
    chartId: chart.id,
    projectId: chart.project_id,
    chartType: chart.type,
    status: "ready",
    supported: readyReports.length === cdcReports.length,
    canApply: readyReports.length === cdcReports.length && readyReports.length > 0,
    reasons,
    warnings,
    cdcReports,
  };
}

async function applyChartVisualizationMigrationReport(chart, report, options = {}) {
  if (!chart || !report?.canApply) {
    throw new Error("Chart migration report is not apply-safe.");
  }

  const readyReports = report.cdcReports.filter((cdcReport) => cdcReport.status === "ready");

  await Promise.all(readyReports.map(async (cdcReport) => {
    const cdc = chart.ChartDatasetConfigs.find((item) => item.id === cdcReport.cdcId);
    if (!cdc) {
      throw new Error(`Chart dataset config ${cdcReport.cdcId} is missing from the chart instance.`);
    }

    if (typeof cdc.update === "function") {
      await cdc.update({
        vizVersion: 2,
        vizConfig: cdcReport.vizConfig,
      }, options);
    } else {
      cdc.vizVersion = 2;
      cdc.vizConfig = cdcReport.vizConfig;
    }
  }));

  return {
    chartId: chart.id,
    appliedCdcCount: readyReports.length,
  };
}

function summarizeVisualizationMigrationReports(reports = []) {
  return reports.reduce((summary, report) => {
    const nextSummary = { ...summary };
    nextSummary.chartCount += 1;

    if (report.status === "ready") {
      nextSummary.readyChartCount += 1;
    } else if (report.status === "already_migrated") {
      nextSummary.alreadyMigratedChartCount += 1;
    } else {
      nextSummary.unsupportedChartCount += 1;
    }

    report.cdcReports.forEach((cdcReport) => {
      nextSummary.cdcCount += 1;

      if (cdcReport.status === "ready") {
        nextSummary.readyCdcCount += 1;
      } else if (cdcReport.status === "already_migrated") {
        nextSummary.alreadyMigratedCdcCount += 1;
      } else {
        nextSummary.unsupportedCdcCount += 1;
      }
    });

    return nextSummary;
  }, {
    chartCount: 0,
    readyChartCount: 0,
    alreadyMigratedChartCount: 0,
    unsupportedChartCount: 0,
    cdcCount: 0,
    readyCdcCount: 0,
    alreadyMigratedCdcCount: 0,
    unsupportedCdcCount: 0,
  });
}

module.exports = {
  applyChartVisualizationMigrationReport,
  buildChartVisualizationMigrationReport,
  normalizeVizVersion,
  summarizeVisualizationMigrationReports,
};
