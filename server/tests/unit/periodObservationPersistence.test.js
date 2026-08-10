import {
  describe, expect, it, vi,
} from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DataTypes, Op } = require("sequelize");
const createMetricEvaluation = require("../../models/models/metricevaluation");
const createMetricMonitor = require("../../models/models/metricmonitor");
const createMetricSnapshot = require("../../models/models/metricsnapshot");
const createObservation = require("../../models/models/observation");
const createDigestSubscription = require("../../models/models/observationdigestsubscription");
const createDigestDeliveryItem = require("../../models/models/observationdigestdeliveryitem");
const migration = require(
  "../../models/migrations/20260809100000-add-period-aware-observation-foundation"
);
const publicationMigration = require(
  "../../models/migrations/20260810100000-add-period-publication-and-kpi-review"
);
const resetMigration = require(
  "../../models/migrations/20260810101000-reset-legacy-observation-monitors"
);
const evaluationThresholdMigration = require(
  "../../models/migrations/20260810102000-add-evaluation-threshold-result"
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

function createPublicationMigrationInterface() {
  const tables = [
    "MetricEvaluation",
    "Observation",
    "ObservationDigestSubscription",
  ];
  const columns = {
    MetricEvaluation: {},
    Observation: {},
    ObservationDigestSubscription: {},
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

  it("defines evaluation-backed observations and KPI review delivery records", () => {
    const observation = captureModel(createObservation);
    const subscription = captureModel(createDigestSubscription);
    const deliveryItem = captureModel(createDigestDeliveryItem);

    expect(observation.rawAttributes).toHaveProperty("metric_evaluation_id");
    expect(subscription.rawAttributes.content_mode.defaultValue).toBe("kpi_review");
    expect(subscription.rawAttributes.day_of_month.defaultValue).toBe(1);
    expect(subscription.rawAttributes.evaluation_wait_minutes.defaultValue).toBe(120);
    expect(deliveryItem.rawAttributes).toEqual(expect.objectContaining({
      evaluation_revision: expect.any(Object),
      metric_evaluation_id: expect.any(Object),
      subscription_id: expect.any(Object),
    }));
    expect(deliveryItem.options.indexes).toContainEqual({
      fields: ["subscription_id", "metric_evaluation_id", "evaluation_revision"],
      name: "observation_digest_evaluation_revision_unique",
      unique: true,
    });
  });

  it("adds the publication and KPI review schema idempotently", async () => {
    const queryInterface = createPublicationMigrationInterface();

    await publicationMigration.up(queryInterface);
    await publicationMigration.up(queryInterface);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "ObservationDigestDeliveryItem",
      expect.objectContaining({
        evaluation_revision: expect.any(Object),
        metric_evaluation_id: expect.objectContaining({ onDelete: "CASCADE" }),
        subscription_id: expect.objectContaining({ onDelete: "CASCADE" }),
      })
    );
    expect(queryInterface.addColumn).toHaveBeenCalledTimes(4);
    expect(queryInterface.addIndex).toHaveBeenCalledTimes(4);
  });

  it("adds the threshold result to an already-upgraded evaluation table", async () => {
    const columns = {};
    const queryInterface = {
      addColumn: vi.fn(async (tableName, columnName, definition) => {
        columns[columnName] = definition;
      }),
      describeTable: vi.fn(async () => columns),
    };

    await evaluationThresholdMigration.up(queryInterface);
    await evaluationThresholdMigration.up(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledTimes(1);
    expect(columns.passes_threshold).toEqual(expect.objectContaining({
      allowNull: false,
      defaultValue: false,
    }));
  });

  it("removes legacy monitor content in foreign-key-safe order", async () => {
    const queryInterface = {
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    };

    await resetMigration.up(queryInterface);

    expect(queryInterface.bulkDelete.mock.calls.map(([table]) => table)).toEqual([
      "Observation",
      "MetricMonitor",
    ]);
    expect(queryInterface.bulkDelete.mock.calls[0][1]).toEqual({
      monitor_id: { [Op.ne]: null },
    });
    expect(queryInterface.bulkDelete.mock.calls[1][1]).toEqual({});
  });
});
