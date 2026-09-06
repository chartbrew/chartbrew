import {
  afterEach, describe, expect, it, vi
} from "vitest";

process.env.CB_ENCRYPTION_KEY_DEV = "00".repeat(32);

const { DataTypes, Sequelize } = require("sequelize");
const db = require("../../models/models");
const datasetIntelligenceModel = require("../../models/models/datasetintelligence");
const {
  DEFAULT_DATASET_INTELLIGENCE_POLICY,
  getEnvIntelligencePolicy,
} = require("../../modules/intelligence/envPolicyProvider");
const {
  getIntelligencePolicy,
  registerIntelligencePolicyProvider,
  resetIntelligencePolicyProvider,
} = require("../../modules/intelligence/policy");
const {
  buildDatasetProfile,
  collectDatasetUsage,
} = require("../../modules/datasetIntelligence/buildProfileEvidence");
const {
  backfillDatasetIntelligence,
} = require("../../modules/datasetIntelligence/backfillDatasetIntelligence");
const {
  inferFieldSemantics,
  summarizeProfileData,
  summarizeSampleData,
} = require("../../modules/datasetIntelligence/inferFieldSemantics");
const {
  mergeOverrides,
  sanitizeOverrides,
} = require("../../modules/datasetIntelligence/mergeOverrides");
const {
  buildProfileFingerprints,
  createFingerprint,
} = require("../../modules/datasetIntelligence/profileFingerprint");
const {
  serializeProfile,
  validateProfile,
} = require("../../modules/datasetIntelligence/profileSchema");
const {
  scoreDataset,
} = require("../../modules/datasetIntelligence/searchDatasetProfiles");
const {
  getProfileResponse,
  isExpired,
  pendingProfileRuns,
  profileDataset,
} = require("../../modules/datasetIntelligence/profileDataset");
const {
  markChartDatasetIntelligenceStale,
  markDatasetIntelligenceStale,
} = require("../../modules/datasetIntelligence/profileLifecycle");
const {
  sanitizeEventPayload,
} = require("../../modules/datasetIntelligence/observability");
const {
  buildProfileJob,
} = require("../../modules/datasetIntelligence/profileQueue");
const profileDatasetWorker = require("../../crons/workers/profileDataset");
const {
  scheduleDataRequestProfile,
  scheduleDatasetProfile,
} = require("../../modules/datasetIntelligence/profileScheduler");

const policy = {
  ...DEFAULT_DATASET_INTELLIGENCE_POLICY,
  maxSampleRows: 10,
  maxFields: 20,
};

function buildDataset() {
  return {
    id: 42,
    name: "Completed orders",
    fieldsSchema: {
      "root[].order_id": "string",
      "root[].completed_at": "date",
      "root[].amount": "number",
      "root[].country": "string",
      "root[].conversion_rate": "number",
    },
    joinSettings: {},
    main_dr_id: 9,
    DataRequests: [{
      id: 9,
      connection_id: 2,
      query: "select * from orders",
      configuration: {},
      conditions: [],
      transform: {},
      variables: { startDate: "2026-01-01" },
    }],
    ChartDatasetConfigs: [{
      id: "cdc-1",
      conditions: [{ field: "root[].country" }],
      Alerts: [{ type: "anomaly" }],
      Chart: {
        id: 8,
        name: "Revenue by country",
        type: "bar",
        autoUpdate: 3600,
        visualization: {
          version: 2,
          layers: [{
            bindingId: "cdc-1",
            encoding: {
              category: { field: "root[].country" },
              value: { field: "root[].amount", aggregate: "sum" },
              time: { field: "root[].completed_at" },
            },
          }],
        },
        Project: {
          id: 3,
          name: "Sales",
          ghost: false,
        },
      },
    }],
  };
}

const sampleRows = [{
  order_id: "ord_1",
  completed_at: "2026-07-20T00:00:00.000Z",
  amount: 120,
  country: "TH",
  conversion_rate: 0.22,
}, {
  order_id: "ord_2",
  completed_at: "2026-07-21T00:00:00.000Z",
  amount: 80,
  country: "GB",
  conversion_rate: 0.18,
}];

afterEach(() => {
  resetIntelligencePolicyProvider();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("intelligence policy", () => {
  it("reads valid env values and falls back for invalid values", () => {
    const result = getEnvIntelligencePolicy({
      CB_DATASET_INTELLIGENCE_ENABLED: "false",
      CB_DATASET_INTELLIGENCE_AUTO_PROFILE: "yes",
      CB_DATASET_INTELLIGENCE_PROFILE_TTL_HOURS: "24",
      CB_DATASET_INTELLIGENCE_MAX_SAMPLE_ROWS: "invalid",
      CB_DATASET_INTELLIGENCE_MAX_FIELDS: "75",
      CB_DATASET_INTELLIGENCE_LLM_ENRICHMENT: "1",
      CB_DATASET_INTELLIGENCE_BACKFILL_BATCH_SIZE: "10",
    }).datasetIntelligence;

    expect(result).toMatchObject({
      enabled: false,
      autoProfile: true,
      profileTtlHours: 24,
      maxSampleRows: DEFAULT_DATASET_INTELLIGENCE_POLICY.maxSampleRows,
      maxFields: 75,
      llmEnrichment: true,
      backfillBatchSize: 10,
    });
  });

  it("allows a team provider within instance ceilings", async () => {
    registerIntelligencePolicyProvider(async () => ({
      datasetIntelligence: {
        maxSampleRows: 50,
        maxFields: 80,
        profileTtlHours: 336,
        llmEnrichment: true,
      },
    }));

    const result = await getIntelligencePolicy({ teamId: 7 });
    expect(result.datasetIntelligence.maxSampleRows).toBeLessThanOrEqual(
      DEFAULT_DATASET_INTELLIGENCE_POLICY.maxSampleRows
    );
    expect(result.datasetIntelligence.maxFields).toBeLessThanOrEqual(
      DEFAULT_DATASET_INTELLIGENCE_POLICY.maxFields
    );
    expect(result.datasetIntelligence.profileTtlHours).toBe(336);
    expect(result.datasetIntelligence.llmEnrichment).toBe(false);
  });
});

describe("dataset intelligence inference", () => {
  it("reduces samples to bounded statistics without retaining rows or string values", () => {
    const result = summarizeSampleData(sampleRows, 10, 20);

    expect(result).toMatchObject({
      rowCountSampled: 2,
      fields: {
        "root[].amount": {
          min: 80,
          max: 120,
        },
        "root[].country": {
          cardinality: 2,
        },
      },
    });
    expect(result.rows).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("ord_1");
    expect(JSON.stringify(result)).not.toContain("\"TH\"");

    const inferred = inferFieldSemantics({
      fieldsSchema: buildDataset().fieldsSchema,
      sampleSummary: result,
      usageByField: {},
      maxFields: 20,
    });
    expect(inferred.quality.rowCountSampled).toBe(2);
    expect(inferred.quality.cardinality["root[].country"]).toBe(2);
  });

  it("reconstructs safe sample statistics from an existing profile", () => {
    const profile = buildDatasetProfile({
      dataset: buildDataset(),
      sampleData: sampleRows,
      policy,
    }).profile;
    const result = summarizeProfileData(profile, 20);

    expect(result).toMatchObject({
      rowCountSampled: 2,
      schema: {
        "root[].amount": "number",
        "root[].country": "string",
      },
      fields: {
        "root[].amount": {
          min: 80,
          max: 120,
        },
        "root[].country": {
          cardinality: 2,
        },
      },
    });
    expect(result).not.toHaveProperty("rows");
  });

  it("infers semantic roles, statistics, and aggregations", () => {
    const result = inferFieldSemantics({
      fieldsSchema: buildDataset().fieldsSchema,
      sampleData: sampleRows,
      usageByField: {
        "root[].amount": { role: "measure", aggregation: "sum" },
      },
      maxSampleRows: 10,
      maxFields: 20,
    });

    expect(result.fields["root[].order_id"].role).toBe("identifier");
    expect(result.fields["root[].completed_at"].role).toBe("time");
    expect(result.fields["root[].amount"]).toMatchObject({
      role: "measure",
      semanticType: "currency",
      defaultAggregation: "sum",
    });
    expect(result.fields["root[].conversion_rate"]).toMatchObject({
      role: "measure",
      semanticType: "percentage",
      defaultAggregation: "avg",
    });
    expect(result.quality.cardinality["root[].country"]).toBe(2);
    expect(result.quality.numericRanges["root[].amount"]).toEqual({
      min: 80,
      max: 120,
    });
    expect(result.rows).toBeUndefined();
  });

  it("uses canonical visualization bindings as high-confidence evidence", () => {
    const dataset = buildDataset();
    const usage = collectDatasetUsage(dataset);
    const result = buildDatasetProfile({
      dataset,
      sampleData: sampleRows,
      policy,
    }).profile;

    expect(usage.usageByField["root[].amount"]).toMatchObject({
      role: "measure",
      aggregation: "sum",
    });
    expect(result.dataset.grain).toBe("One row per order id");
    expect(result.monitoring.defaultTimeField).toBe("root[].completed_at");
    expect(result.monitoring.candidateMetrics[0]).toMatchObject({
      field: "root[].amount",
      usedByCharts: true,
    });
    expect(result.usage.filters).toEqual([{
      field: "root[].country",
      chartId: 8,
      chartName: "Revenue by country",
    }]);
  });

  it("ignores visualization layers bound to another dataset", () => {
    const dataset = buildDataset();
    dataset.ChartDatasetConfigs[0].Chart.visualization.layers.push({
      bindingId: "another-cdc",
      encoding: {
        value: { field: "root[].secret_total", aggregate: "sum" },
      },
    });

    const usage = collectDatasetUsage(dataset);
    expect(usage.usageByField["root[].secret_total"]).toBeUndefined();
    expect(usage.usage.metrics.some((metric) => {
      return metric.field === "root[].secret_total";
    })).toBe(false);
  });
});

describe("dataset intelligence persistence contracts", () => {
  it("keeps fingerprints stable and detects definition changes", () => {
    const dataset = buildDataset();
    const first = buildProfileFingerprints({
      dataset,
      dataRequests: dataset.DataRequests,
      usages: [{ chartId: 8 }],
    });
    const second = buildProfileFingerprints({
      dataset,
      dataRequests: dataset.DataRequests,
      usages: [{ chartId: 8 }],
    });
    const changed = buildProfileFingerprints({
      dataset,
      dataRequests: [{ ...dataset.DataRequests[0], query: "select amount from orders" }],
      usages: [{ chartId: 8 }],
    });

    expect(first).toEqual(second);
    expect(changed.definitionFingerprint).not.toBe(first.definitionFingerprint);
    expect(createFingerprint({ b: 2, a: 1 })).toBe(createFingerprint({ a: 1, b: 2 }));
  });

  it("applies valid overrides and reports removed fields", () => {
    const profile = buildDatasetProfile({
      dataset: buildDataset(),
      sampleData: sampleRows,
      policy,
    }).profile;
    const overrides = sanitizeOverrides({
      dataset: {
        summary: "Recognised revenue",
      },
      fields: {
        "root[].amount": {
          role: "measure",
          defaultAggregation: "avg",
        },
        "root[].removed": {
          role: "dimension",
        },
      },
      monitoring: {
        defaultTimeField: "root[].completed_at",
      },
    });
    const merged = mergeOverrides(profile, overrides);

    expect(merged.profile.dataset.summary).toBe("Recognised revenue");
    expect(merged.profile.fields["root[].amount"]).toMatchObject({
      defaultAggregation: "avg",
      overridden: true,
    });
    expect(merged.orphanedFields).toEqual(["root[].removed"]);
  });

  it("validates and caps serialized profiles", () => {
    const profile = buildDatasetProfile({
      dataset: buildDataset(),
      sampleData: sampleRows,
      policy,
    }).profile;
    expect(validateProfile(profile)).toBe(profile);
    const serialized = serializeProfile(profile, {
      maxFields: 2,
      maxUsageReferences: 1,
    });

    expect(Object.keys(serialized.fields)).toHaveLength(2);
    expect(serialized.truncation).toEqual({
      fields: true,
      fieldCount: 5,
    });
    expect(() => validateProfile({ ...profile, version: 2 })).toThrow(
      "Invalid dataset intelligence profile version"
    );
  });

  it("encrypts profile and override JSON at rest", async () => {
    const sequelize = new Sequelize(
      "postgres://chartbrew:chartbrew@localhost:5432/chartbrew_test",
      { logging: false }
    );
    const DatasetIntelligence = datasetIntelligenceModel(sequelize, DataTypes);
    const profile = buildDatasetProfile({
      dataset: buildDataset(),
      sampleData: sampleRows,
      policy,
    }).profile;
    const record = DatasetIntelligence.build({
      dataset_id: 42,
      team_id: 7,
      profile,
      overrides: {
        dataset: { summary: "Recognised revenue" },
      },
    });

    expect(record.getDataValue("profile")).not.toContain("Completed orders");
    expect(record.profile).toEqual(profile);
    expect(record.getDataValue("overrides")).not.toContain("Recognised revenue");
    expect(record.overrides.dataset.summary).toBe("Recognised revenue");
    await sequelize.close();
  });

  it("caps overrides and derives stale status from expiry", () => {
    const overrides = sanitizeOverrides({
      fields: {
        a: { role: "measure" },
        b: { role: "dimension" },
      },
    }, { maxFields: 1 });
    expect(Object.keys(overrides.fields)).toHaveLength(1);

    const record = {
      dataset_id: 42,
      status: "ready",
      version: 1,
      generated_at: new Date("2026-07-01T00:00:00.000Z"),
      expires_at: new Date("2026-07-02T00:00:00.000Z"),
      profile: buildDatasetProfile({
        dataset: buildDataset(),
        sampleData: sampleRows,
        policy,
      }).profile,
      overrides: {},
    };
    expect(isExpired(record)).toBe(true);
    expect(getProfileResponse(record, policy).status).toBe("stale");
  });

  it("deduplicates concurrent profile generation", async () => {
    let releaseEvidence;
    const evidenceGate = new Promise((resolve) => {
      releaseEvidence = resolve;
    });
    vi.spyOn(db.DatasetIntelligence, "findOne").mockResolvedValue(null);
    vi.spyOn(db.Dataset, "findOne").mockImplementation(async () => {
      await evidenceGate;
      return buildDataset();
    });
    vi.spyOn(db.DatasetIntelligence, "create").mockImplementation(async (values) => values);

    const options = {
      datasetId: 42,
      teamId: 7,
      sampleData: sampleRows,
      policy: { datasetIntelligence: policy },
    };
    const first = profileDataset(options);
    const second = profileDataset(options);

    expect(second).toBe(first);
    releaseEvidence();
    await expect(first).resolves.toMatchObject({ status: "ready" });
    expect(db.Dataset.findOne).toHaveBeenCalledTimes(1);
    expect(pendingProfileRuns.size).toBe(0);
  });

  it("adds SQL result fields to an early empty profile and preserves them on refresh", async () => {
    const dataset = {
      ...buildDataset(),
      fieldsSchema: {},
      ChartDatasetConfigs: [],
    };
    const emptyProfile = buildDatasetProfile({
      dataset,
      policy,
    }).profile;
    const fingerprints = buildProfileFingerprints({
      dataset,
      dataRequests: dataset.DataRequests,
      usages: [],
    });
    const existing = {
      dataset_id: dataset.id,
      team_id: 7,
      version: 1,
      status: "ready",
      fingerprint: fingerprints.fingerprint,
      profile: emptyProfile,
      overrides: {},
      generated_at: new Date(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      update: vi.fn(async (values) => {
        Object.assign(existing, values);
        return existing;
      }),
    };
    vi.spyOn(db.DatasetIntelligence, "findOne").mockResolvedValue(existing);
    vi.spyOn(db.Dataset, "findOne").mockResolvedValue(dataset);

    const sampled = await profileDataset({
      datasetId: dataset.id,
      teamId: 7,
      sampleData: {
        data: [
          { chart_type: "kpi", charts: 506 },
          { chart_type: "line", charts: 382 },
        ],
      },
      policy: { datasetIntelligence: policy },
    });

    expect(sampled.profile.fields).toMatchObject({
      "root[].chart_type": {
        type: "string",
        role: "dimension",
      },
      "root[].charts": {
        type: "number",
        role: "measure",
      },
    });
    const sampleGeneratedAt = sampled.profile.provenance.sampleGeneratedAt;

    const refreshed = await profileDataset({
      datasetId: dataset.id,
      teamId: 7,
      force: true,
      policy: { datasetIntelligence: policy },
    });

    expect(Object.keys(refreshed.profile.fields).sort()).toEqual(
      ["root[].charts", "root[].chart_type"].sort()
    );
    expect(refreshed.profile.quality.rowCountSampled).toBe(2);
    expect(refreshed.profile.provenance.sampleGeneratedAt).toBe(sampleGeneratedAt);
  });

  it("keeps lifecycle invalidation best-effort", async () => {
    vi.spyOn(db.DatasetIntelligence, "update").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(db.ChartDatasetConfig, "findAll").mockRejectedValue(new Error("unavailable"));

    await expect(markDatasetIntelligenceStale(42, 7)).resolves.toBe(0);
    await expect(markChartDatasetIntelligenceStale(8)).resolves.toBe(0);
  });
});

describe("dataset intelligence search", () => {
  it("ranks matches with inspectable reasons", () => {
    const dataset = buildDataset();
    const profile = buildDatasetProfile({
      dataset,
      sampleData: sampleRows,
      policy,
    }).profile;
    const result = scoreDataset(dataset, profile, "revenue country");

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain("existing_chart");
    expect(result.reasons).toContain("field");
  });

  it("does not use a path-scoped dataset for a site-wide request", () => {
    const dataset = { ...buildDataset(), name: "Top Countries Visiting /tools" };
    const profile = buildDatasetProfile({
      dataset,
      sampleData: sampleRows,
      policy,
    }).profile;

    expect(scoreDataset(dataset, profile, "top countries visiting my site"))
      .toEqual({ score: 0, reasons: ["scope_mismatch"] });
    const scopedResult = scoreDataset(dataset, profile, "top countries visiting /tools");
    expect(scopedResult.score).toBeGreaterThan(0);
  });

  it("matches nested paths with hyphens and does not treat ratios as paths", () => {
    expect(scoreDataset({ name: "Visitors to /tools/plan-builder" }, null,
      "visitors to /tools/plan-builder").score).toBeGreaterThan(0);
    expect(scoreDataset({ name: "Visitors to /tools/plan-builder" }, null,
      "visitors to /tools").reasons).toContain("scope_mismatch");
    expect(scoreDataset({ name: "Revenue/Cost" }, null, "revenue").score).toBeGreaterThan(0);
  });
});

describe("dataset intelligence backfill", () => {
  it("rejects an invalid team id instead of widening the backfill scope", async () => {
    const findAll = vi.spyOn(db.Dataset, "findAll");

    await expect(backfillDatasetIntelligence({
      teamId: "not-a-team",
    })).rejects.toThrow("teamId must be a positive integer");
    expect(findAll).not.toHaveBeenCalled();
  });

  it("scopes the query and caps the requested batch size", async () => {
    vi.stubEnv("CB_DATASET_INTELLIGENCE_BACKFILL_BATCH_SIZE", "2");
    const findAll = vi.spyOn(db.Dataset, "findAll").mockResolvedValue([]);

    await expect(backfillDatasetIntelligence({
      teamId: "7",
      limit: "100",
    })).resolves.toEqual({
      attempted: 0,
      ready: 0,
      disabled: 0,
      failed: 0,
    });
    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        draft: false,
        team_id: 7,
      }),
      limit: 2,
      order: [["updatedAt", "DESC"]],
    }));
  });

  it("continues after failures and reports every backfill outcome", async () => {
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([
      { id: 1, team_id: 7 },
      { id: 2, team_id: 7 },
      { id: 3, team_id: 7 },
      { id: 4, team_id: 7 },
    ]);
    const runProfileDataset = vi.fn()
      .mockResolvedValueOnce({ status: "ready" })
      .mockResolvedValueOnce({ status: "disabled" })
      .mockResolvedValueOnce({ status: "failed" })
      .mockRejectedValueOnce(new Error("profile unavailable"));

    await expect(backfillDatasetIntelligence({
      teamId: 7,
      limit: 4,
    }, runProfileDataset)).resolves.toEqual({
      attempted: 4,
      ready: 1,
      disabled: 1,
      failed: 2,
    });
    expect(runProfileDataset).toHaveBeenCalledTimes(4);
    expect(runProfileDataset).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 7,
      generationReason: "backfill",
    }));
  });
});

describe("dataset intelligence observability", () => {
  it("drops profile contents and field names from operational events", () => {
    expect(sanitizeEventPayload({
      datasetId: 42,
      durationMs: 12,
      fieldCount: 5,
      fields: ["root[].amount"],
      profile: { dataset: { summary: "Sensitive" } },
      query: "revenue by customer",
    })).toEqual({
      datasetId: 42,
      durationMs: 12,
      fieldCount: 5,
    });
  });
});

describe("dataset intelligence queue", () => {
  it("uses a stable deduplication key and carries only bounded sample statistics", async () => {
    const sampleSummary = summarizeSampleData(sampleRows, 10, 20);
    const job = buildProfileJob({
      datasetId: 42,
      teamId: 7,
      sampleSummary,
    });

    expect(job.options).toMatchObject({
      jobId: "dataset-intelligence-7-42",
      delay: 1000,
      removeOnComplete: true,
    });
    expect(JSON.stringify(job.data)).not.toContain("ord_1");
    expect(JSON.stringify(job.data)).not.toContain("\"TH\"");
  });

  it("runs queued profiles with retryable failure behavior", async () => {
    const runProfileDataset = vi.fn().mockResolvedValue({ status: "ready" });
    const result = await profileDatasetWorker({
      data: {
        datasetId: 42,
        teamId: 7,
        sampleSummary: { rowCountSampled: 2, schema: {}, fields: {} },
        generationReason: "dataset_execution",
      },
    }, runProfileDataset);

    expect(result).toEqual({ status: "ready" });
    expect(runProfileDataset).toHaveBeenCalledWith(expect.objectContaining({
      datasetId: 42,
      teamId: 7,
      generationReason: "dataset_execution",
      throwOnFailure: true,
    }));
  });

  it("keeps dataset execution successful when queueing fails", async () => {
    const enqueueProfile = vi.fn().mockRejectedValue(new Error("Redis unavailable"));

    await expect(scheduleDatasetProfile({
      datasetId: 42,
      teamId: 7,
      sampleData: sampleRows,
    }, enqueueProfile)).resolves.toBeNull();
    expect(enqueueProfile).toHaveBeenCalledOnce();
  });

  it("profiles a main data request when the dataset has no joins", async () => {
    const scheduleProfile = vi.fn().mockResolvedValue({ id: "profile-job" });
    const sampleData = [{ chart_type: "kpi", charts: 506 }];

    await scheduleDataRequestProfile({
      dataset: {
        id: 4113,
        team_id: 60,
        main_dr_id: 3876,
        joinSettings: null,
      },
      dataRequestId: 3876,
      sampleData,
    }, scheduleProfile);

    expect(scheduleProfile).toHaveBeenCalledWith({
      datasetId: 4113,
      teamId: 60,
      sampleData,
    });
  });

  it("does not profile an individual request from a joined dataset", async () => {
    const scheduleProfile = vi.fn();

    await scheduleDataRequestProfile({
      dataset: {
        id: 4113,
        team_id: 60,
        main_dr_id: 3876,
        joinSettings: {
          joins: [{ dr_id: 3876, join_id: 3877 }],
        },
      },
      dataRequestId: 3876,
      sampleData: [{ chart_type: "kpi", charts: 506 }],
    }, scheduleProfile);

    expect(scheduleProfile).not.toHaveBeenCalled();
  });
});
