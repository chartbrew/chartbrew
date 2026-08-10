import {
  describe, expect, it, vi,
} from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DataTypes } = require("sequelize");
const createMetricEvaluation = require("../../models/models/metricevaluation");
const createMetricMonitor = require("../../models/models/metricmonitor");
const createMetricSnapshot = require("../../models/models/metricsnapshot");
const migration = require(
  "../../models/migrations/20260809100000-add-period-aware-observation-foundation"
);

function captureModel(factory) {
  const sequelize = {
    define: vi.fn((name, attributes, options) => ({
      name,
      options,
      rawAttributes: attributes,
    })),
  };
  return factory(sequelize, DataTypes);
}

function createMigrationInterface() {
  const tables = ["MetricMonitor", "MetricSnapshot"];
  const columns = {
    MetricMonitor: {},
    MetricSnapshot: {},
  };
  const indexes = {};

  return {
    addColumn: vi.fn(async (tableName, columnName, definition) => {
      columns[tableName][columnName] = definition;
    }),
    addIndex: vi.fn(async (tableName, fields, options) => {
      indexes[tableName] ||= [];
      indexes[tableName].push({ fields, name: options.name });
    }),
    columns,
    createTable: vi.fn(async (tableName, attributes) => {
      tables.push(tableName);
      columns[tableName] = attributes;
    }),
    describeTable: vi.fn(async (tableName) => columns[tableName]),
    showAllTables: vi.fn(async () => tables),
    showIndex: vi.fn(async (tableName) => indexes[tableName] || []),
  };
}

describe("period observation persistence", () => {
  it("defines period policy, snapshot evidence, and evaluation result fields", () => {
    const monitor = captureModel(createMetricMonitor);
    const snapshot = captureModel(createMetricSnapshot);
    const evaluation = captureModel(createMetricEvaluation);

    expect(monitor.rawAttributes).toHaveProperty("publication_policy");
    expect(monitor.rawAttributes).toHaveProperty("last_evaluated_period_end");
    expect(monitor.rawAttributes).toHaveProperty("next_evaluation_at");
    expect(snapshot.rawAttributes.coverage.defaultValue).toBe("unknown");
    expect(snapshot.rawAttributes).toHaveProperty("result_as_of");
    expect(evaluation.rawAttributes).toEqual(expect.objectContaining({
      calendar_timezone: expect.any(Object),
      comparison_period: expect.any(Object),
      evidence: expect.any(Object),
      evaluation_key: expect.any(Object),
      finality: expect.any(Object),
      passes_threshold: expect.any(Object),
      readiness: expect.any(Object),
      revision: expect.any(Object),
    }));
    expect(evaluation.options.indexes).toContainEqual({
      fields: ["monitor_id", "evaluation_key", "revision"],
      unique: true,
    });
  });

  it("adds the period schema once when the migration runs more than once", async () => {
    const queryInterface = createMigrationInterface();

    await migration.up(queryInterface);
    await migration.up(queryInterface);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "MetricEvaluation",
      expect.objectContaining({
        evidence: expect.any(Object),
        evaluation_key: expect.any(Object),
        revision: expect.any(Object),
      })
    );
    expect(queryInterface.addColumn).toHaveBeenCalledTimes(5);
    expect(queryInterface.addIndex).toHaveBeenCalledTimes(4);
    expect(queryInterface.columns.MetricMonitor).toEqual(expect.objectContaining({
      last_evaluated_period_end: expect.any(Object),
      next_evaluation_at: expect.any(Object),
      publication_policy: expect.any(Object),
    }));
    expect(queryInterface.columns.MetricSnapshot.coverage.defaultValue).toBe("unknown");
  });
});
