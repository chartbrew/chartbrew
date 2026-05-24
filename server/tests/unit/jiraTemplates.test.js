import {
  describe,
  expect,
  it,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { loadTemplate } = require("../../sources/shared/templates/chartTemplateLoader");
const { chartColors, Colors } = require("../../charts/colors");

const TEMPLATE_SLUGS = [
  "project-overview",
  "sprint-health",
  "bug-tracking",
  "team-workload",
];

const JIRA_ALLOWED_DATASET_COLORS = new Set([
  chartColors.blue.rgb,
  chartColors.amber.rgb,
  chartColors.teal.rgb,
  Colors.positive,
  Colors.negative,
  "rgba(255, 255, 255, 1)",
]);

function getChartDatasetConfigs(chart) {
  return chart.cdcs || [chart.cdc];
}

describe("Jira chart templates", () => {
  it("loads every Jira template bundle with datasets and charts", () => {
    TEMPLATE_SLUGS.forEach((slug) => {
      const template = loadTemplate("jira", slug);

      expect(template.source).toBe("jira");
      expect(template.slug).toBe(slug);
      expect(template.requiredConnection).toEqual({ type: "jira", subType: "jira" });
      expect(template.datasets.length).toBeGreaterThan(0);
      expect(template.charts.length).toBeGreaterThan(0);
    });
  });

  it("uses layoutIntent and valid dataset references for every Jira chart", () => {
    TEMPLATE_SLUGS.forEach((slug) => {
      const template = loadTemplate("jira", slug);
      const datasetIds = template.datasets.map((dataset) => dataset.id);

      template.charts.forEach((chart) => {
        expect(chart.layoutIntent).toEqual(expect.objectContaining({
          kind: expect.any(String),
          priority: expect.any(Number),
        }));
        chart.requiredDatasetIds.forEach((datasetId) => {
          expect(datasetIds).toContain(datasetId);
        });
        const cdcs = chart.cdcs || [chart.cdc];
        cdcs.forEach((cdc) => {
          expect(datasetIds).toContain(cdc.datasetTemplateId);
        });
      });
    });
  });

  it("sets complete chart dataset config fields for the editor", () => {
    TEMPLATE_SLUGS.forEach((slug) => {
      const template = loadTemplate("jira", slug);
      const datasetsById = new Map(template.datasets.map((dataset) => [dataset.id, dataset]));

      template.charts.forEach((chart) => {
        getChartDatasetConfigs(chart).forEach((cdc) => {
          const dataset = datasetsById.get(cdc.datasetTemplateId);
          const fields = dataset?.fieldsSchema || {};

          expect(cdc.xAxis, `${slug}:${chart.id} is missing xAxis`).toEqual(expect.any(String));
          expect(cdc.yAxis, `${slug}:${chart.id} is missing yAxis`).toEqual(expect.any(String));
          expect(cdc.yAxisOperation, `${slug}:${chart.id} is missing yAxisOperation`).toEqual(expect.any(String));

          if (cdc.xAxis !== "root[]") {
            expect(fields[cdc.xAxis], `${slug}:${chart.id} xAxis is not in dataset fieldsSchema`).toBeTruthy();
          }
          expect(fields[cdc.yAxis], `${slug}:${chart.id} yAxis is not in dataset fieldsSchema`).toBeTruthy();
        });
      });
    });
  });

  it("sets dateField and sum operation for Jira trend count chart configs", () => {
    TEMPLATE_SLUGS.forEach((slug) => {
      const template = loadTemplate("jira", slug);
      const datasetsById = new Map(template.datasets.map((dataset) => [dataset.id, dataset]));

      template.charts.forEach((chart) => {
        getChartDatasetConfigs(chart).forEach((cdc) => {
          const dataset = datasetsById.get(cdc.datasetTemplateId);
          const fields = dataset?.fieldsSchema || {};

          if (fields[cdc.xAxis] !== "date") return;
          if (!["root[].created", "root[].resolved"].includes(cdc.yAxis)) return;

          expect(cdc.dateField, `${slug}:${chart.id} is missing dateField`).toBe(cdc.xAxis);
          expect(cdc.yAxisOperation, `${slug}:${chart.id} should sum coarser date buckets`).toBe("sum");
        });
      });
    });
  });

  it("uses a yearly default range for Jira trend datasets", () => {
    TEMPLATE_SLUGS.forEach((slug) => {
      const template = loadTemplate("jira", slug);

      template.datasets
        .filter((dataset) => dataset.dataRequest?.configuration?.transform?.type === "created_resolved_trend")
        .forEach((dataset) => {
          expect(dataset.dataRequest.variableBindings).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: "start_date", default_value: "-365d" }),
            expect.objectContaining({ name: "end_date", default_value: "now()" }),
          ]));
        });
    });
  });

  it("includes variable bindings on Jira template data requests", () => {
    const template = loadTemplate("jira", "project-overview");
    const dataRequest = template.datasets[0].dataRequest;

    expect(dataRequest.variableBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "projects", type: "string", required: true }),
      expect.objectContaining({ name: "start_date", type: "date" }),
      expect.objectContaining({ name: "end_date", type: "date" }),
    ]));
  });

  it("requires board and sprint variables for Jira sprint issue datasets", () => {
    const template = loadTemplate("jira", "sprint-health");

    template.datasets
      .filter((dataset) => dataset.dataRequest?.configuration?.resource === "sprint_issues")
      .forEach((dataset) => {
        expect(dataset.dataRequest.configuration.sprintId).toBe("{{sprint_id}}");
        expect(dataset.dataRequest.configuration.boardId).toBe("{{board_id}}");
        expect(dataset.dataRequest.variableBindings).toEqual(expect.arrayContaining([
          expect.objectContaining({ name: "sprint_id", type: "number", required: true }),
          expect.objectContaining({ name: "board_id", type: "number", required: true }),
        ]));
      });
  });

  it("uses the shared restrained chart palette for Jira chart datasets", () => {
    TEMPLATE_SLUGS.forEach((slug) => {
      const template = loadTemplate("jira", slug);

      template.charts.flatMap(getChartDatasetConfigs).forEach((cdc) => {
        expect(cdc.datasetColor).toEqual(expect.any(String));
        expect(
          JIRA_ALLOWED_DATASET_COLORS.has(cdc.datasetColor),
          `${cdc.legend || cdc.datasetTemplateId} uses non-shared color ${cdc.datasetColor}`
        ).toBe(true);

        if (Array.isArray(cdc.fillColor)) {
          cdc.fillColor.forEach((color) => {
            expect(
              JIRA_ALLOWED_DATASET_COLORS.has(color),
              `${cdc.legend || cdc.datasetTemplateId} uses non-shared fill color ${color}`
            ).toBe(true);
          });
          expect(cdc.multiFill).toBe(true);
        } else if (cdc.fillColor) {
          expect(cdc.fill).toBe(true);
        }
      });
    });
  });
});
