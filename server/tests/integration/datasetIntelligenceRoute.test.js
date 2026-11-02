import {
  beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import request from "supertest";
import { createRequire } from "module";

import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";

const require = createRequire(import.meta.url);
const {
  markDatasetIntelligenceStale,
} = require("../../modules/datasetIntelligence/profileLifecycle.js");
const {
  backfillDatasetIntelligence,
} = require("../../modules/datasetIntelligence/backfillDatasetIntelligence.js");
const {
  profileDataset,
} = require("../../modules/datasetIntelligence/profileDataset.js");
const getDatasetIntelligence = require(
  "../../modules/ai/orchestrator/tools/getDatasetIntelligence.js"
);
const searchDatasets = require("../../modules/ai/orchestrator/tools/searchDatasets.js");

function buildProfile() {
  return {
    version: 1,
    dataset: {
      summary: "Private semantic summary",
      grain: "One row per order",
      confidence: 0.9,
    },
    fields: {
      "root[].amount": {
        type: "number",
        role: "measure",
        semanticType: "currency",
        defaultAggregation: "sum",
        confidence: 0.9,
        evidence: ["number_type"],
      },
      "root[].country": {
        type: "string",
        role: "dimension",
        semanticType: "geography",
        defaultAggregation: "none",
        confidence: 0.9,
        evidence: ["string_type"],
      },
    },
    usage: {
      chartIds: [],
      dashboardIds: [],
      metrics: [],
      dimensions: [],
      filters: [],
      analyses: [],
    },
    quality: {
      rowCountSampled: 2,
      nullRates: {},
      cardinality: {},
      numericRanges: {},
      dateCoverage: {},
      warnings: [],
    },
    monitoring: {
      defaultTimeField: null,
      candidateMetrics: [],
      candidateSegments: [],
      freshnessExpectation: null,
    },
    provenance: {
      sampleGeneratedAt: null,
      llmEnriched: false,
    },
  };
}

async function seedTeam(models, role = "teamOwner") {
  const user = await models.User.create(userFactory.build());
  const team = await models.Team.create(teamFactory.build());
  const project = await models.Project.create(projectFactory.build({
    team_id: team.id,
    ghost: false,
  }));
  await models.TeamRole.create({
    team_id: team.id,
    user_id: user.id,
    role,
    projects: role.startsWith("project") ? [project.id] : [],
  });
  const dataset = await models.Dataset.create({
    team_id: team.id,
    project_ids: [project.id],
    draft: false,
    name: "Completed orders",
    fieldsSchema: {
      "root[].amount": "number",
      "root[].country": "string",
    },
  });
  const intelligence = await models.DatasetIntelligence.create({
    dataset_id: dataset.id,
    team_id: team.id,
    version: 1,
    status: "ready",
    fingerprint: `profile-${dataset.id}`,
    profile: buildProfile(),
    overrides: {},
    generated_at: new Date(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
  });
  const token = generateTestToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    dataset,
    intelligence,
    project,
    team,
    token,
    user,
  };
}

async function createDataset(models, team, project, values = {}) {
  return models.Dataset.create({
    team_id: team.id,
    project_ids: [project.id],
    draft: false,
    name: "Dataset intelligence test",
    fieldsSchema: {
      "root[].amount": "number",
      "root[].country": "string",
    },
    ...values,
  });
}

async function createIntelligence(models, dataset, team, values = {}) {
  return models.DatasetIntelligence.create({
    dataset_id: dataset.id,
    team_id: team.id,
    version: 1,
    status: "ready",
    fingerprint: `profile-${dataset.id}`,
    profile: buildProfile(),
    overrides: {},
    generated_at: new Date(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    ...values,
  });
}

describe("Dataset Intelligence routes and persistence", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    app = await createTestApp();
    const datasetRoute = require("../../api/DatasetRoute.js");
    const chartRoute = require("../../api/ChartRoute.js");
    datasetRoute(app);
    chartRoute(app);
    models = await getModels();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.CB_DATASET_INTELLIGENCE_ENABLED;
    delete process.env.CB_DATASET_INTELLIGENCE_MAX_FIELDS;
  });

  it("returns a bounded profile only to a member of the owning team", async () => {
    const owner = await seedTeam(models);
    const otherOwner = await seedTeam(models);
    process.env.CB_DATASET_INTELLIGENCE_MAX_FIELDS = "1";

    const response = await request(app)
      .get(`/team/${owner.team.id}/datasets/${owner.dataset.id}/intelligence`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(Object.keys(response.body.profile.fields)).toHaveLength(1);
    expect(response.body.profile.truncation).toEqual({
      fields: true,
      fieldCount: 2,
    });
    expect(response.body).not.toHaveProperty("last_error");

    await request(app)
      .get(`/team/${otherOwner.team.id}/datasets/${owner.dataset.id}/intelligence`)
      .set("Authorization", `Bearer ${otherOwner.token}`)
      .expect(404);
  });

  it("searches only datasets in the caller's team", async () => {
    const owner = await seedTeam(models);
    const otherOwner = await seedTeam(models);

    const response = await request(app)
      .get(`/team/${owner.team.id}/datasets/intelligence/search`)
      .query({ query: "completed orders" })
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body.datasets).toHaveLength(1);
    expect(response.body.datasets[0].dataset_id).toBe(owner.dataset.id);
    expect(response.body.datasets[0].connection_ids).toEqual([]);
    expect(response.body.datasets.some((item) => {
      return item.dataset_id === otherOwner.dataset.id;
    })).toBe(false);

    const toolResult = await searchDatasets({
      team_id: owner.team.id,
      query: "completed orders",
    });
    expect(toolResult.datasets.map((item) => item.dataset_id)).toEqual([owner.dataset.id]);

    await expect(getDatasetIntelligence({
      team_id: otherOwner.team.id,
      dataset_id: owner.dataset.id,
    })).rejects.toThrow("Dataset does not belong to the specified team");
  });

  it("allows project viewers to inspect but not refresh profiles", async () => {
    const viewer = await seedTeam(models, "projectViewer");

    await request(app)
      .get(`/team/${viewer.team.id}/datasets/${viewer.dataset.id}/intelligence`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    await request(app)
      .post(`/team/${viewer.team.id}/datasets/${viewer.dataset.id}/intelligence/refresh`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(403);
  });

  it("allows an owner to refresh a current profile", async () => {
    const owner = await seedTeam(models);
    const previousGeneratedAt = new Date("2026-01-01T00:00:00.000Z");
    await owner.intelligence.update({ generated_at: previousGeneratedAt });

    const response = await request(app)
      .post(`/team/${owner.team.id}/datasets/${owner.dataset.id}/intelligence/refresh`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body.status).toBe("ready");
    expect(new Date(response.body.generated_at).getTime()).toBeGreaterThan(
      previousGeneratedAt.getTime()
    );
  });

  it("persists owner overrides and returns the merged profile", async () => {
    const owner = await seedTeam(models);
    const overrides = {
      dataset: {
        summary: "Recognised completed-order revenue",
        grain: "One row per completed order",
      },
      fields: {
        "root[].amount": {
          role: "measure",
          defaultAggregation: "avg",
        },
      },
      monitoring: {},
    };

    const response = await request(app)
      .put(`/team/${owner.team.id}/datasets/${owner.dataset.id}/intelligence/overrides`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send(overrides)
      .expect(200);

    expect(response.body).toMatchObject({
      status: "ready",
      profile: {
        dataset: {
          summary: overrides.dataset.summary,
          grain: overrides.dataset.grain,
        },
        fields: {
          "root[].amount": {
            role: "measure",
            defaultAggregation: "avg",
          },
        },
      },
      overrides,
    });
    const record = await models.DatasetIntelligence.findOne({
      where: { dataset_id: owner.dataset.id },
    });
    expect(record.overrides).toEqual(overrides);
  });

  it("encrypts profile data, enforces uniqueness, and cascades on dataset deletion", async () => {
    const owner = await seedTeam(models);
    const storedProfile = owner.intelligence.getDataValue("profile");

    expect(storedProfile).toEqual(expect.any(String));
    expect(storedProfile).not.toContain("Completed orders");

    await expect(models.DatasetIntelligence.create({
      dataset_id: owner.dataset.id,
      team_id: owner.team.id,
      version: 1,
      status: "ready",
      profile: buildProfile(),
    })).rejects.toThrow();

    await owner.dataset.destroy();
    expect(await models.DatasetIntelligence.count({
      where: { dataset_id: owner.dataset.id },
    })).toBe(0);
  });

  it("generates missing profiles lazily and persists stale transitions", async () => {
    const owner = await seedTeam(models);
    await owner.intelligence.destroy();

    const response = await request(app)
      .get(`/team/${owner.team.id}/datasets/${owner.dataset.id}/intelligence`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body.status).toBe("ready");
    expect(await models.DatasetIntelligence.count({
      where: { dataset_id: owner.dataset.id },
    })).toBe(1);

    await markDatasetIntelligenceStale(owner.dataset.id, owner.team.id);
    const record = await models.DatasetIntelligence.findOne({
      where: { dataset_id: owner.dataset.id },
    });
    expect(record.status).toBe("stale");
  });

  it("retains the previous profile when regeneration fails", async () => {
    const owner = await seedTeam(models);
    vi.spyOn(models.Dataset, "findOne").mockRejectedValueOnce(new Error("Database unavailable"));

    const result = await profileDataset({
      datasetId: owner.dataset.id,
      teamId: owner.team.id,
      force: true,
    });
    const record = await models.DatasetIntelligence.findOne({
      where: { dataset_id: owner.dataset.id },
    });

    expect(result.status).toBe("failed");
    expect(result.profile.dataset.summary).toBe("Private semantic summary");
    expect(record.status).toBe("failed");
    expect(record.profile.dataset.summary).toBe("Private semantic summary");
    expect(record.last_error).not.toContain("SELECT");
  });

  it("returns a stable disabled result without exposing stored metadata", async () => {
    const owner = await seedTeam(models);
    process.env.CB_DATASET_INTELLIGENCE_ENABLED = "false";

    const response = await request(app)
      .get(`/team/${owner.team.id}/datasets/${owner.dataset.id}/intelligence`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body).toEqual({
      dataset_id: owner.dataset.id,
      status: "disabled",
      profile: null,
    });
  });

  it("backfills only eligible datasets in the requested team", async () => {
    const owner = await seedTeam(models);
    const otherOwner = await seedTeam(models);
    const missing = await createDataset(models, owner.team, owner.project, {
      name: "Missing intelligence",
    });
    const stale = await createDataset(models, owner.team, owner.project, {
      name: "Stale intelligence",
    });
    const failed = await createDataset(models, owner.team, owner.project, {
      name: "Failed intelligence",
    });
    const pending = await createDataset(models, owner.team, owner.project, {
      name: "Pending intelligence",
    });
    const expired = await createDataset(models, owner.team, owner.project, {
      name: "Expired intelligence",
    });
    const draft = await createDataset(models, owner.team, owner.project, {
      name: "Draft dataset",
      draft: true,
    });
    const otherTeamMissing = await createDataset(
      models,
      otherOwner.team,
      otherOwner.project,
      { name: "Other team missing intelligence" }
    );
    await createIntelligence(models, stale, owner.team, { status: "stale" });
    await createIntelligence(models, failed, owner.team, { status: "failed" });
    await createIntelligence(models, pending, owner.team, { status: "pending" });
    await createIntelligence(models, expired, owner.team, {
      expires_at: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(backfillDatasetIntelligence({
      teamId: owner.team.id,
      limit: 10,
    })).resolves.toEqual({
      attempted: 5,
      ready: 5,
      disabled: 0,
      failed: 0,
    });

    const eligibleIds = [missing.id, stale.id, failed.id, pending.id, expired.id];
    expect(await models.DatasetIntelligence.count({
      where: {
        dataset_id: eligibleIds,
        status: "ready",
      },
    })).toBe(eligibleIds.length);
    expect(await models.DatasetIntelligence.count({
      where: { dataset_id: [draft.id, otherTeamMissing.id] },
    })).toBe(0);
    await owner.intelligence.reload();
    expect(owner.intelligence.status).toBe("ready");
  });

  it("does not expose intelligence through public chart payloads", async () => {
    const owner = await seedTeam(models);
    await owner.project.update({ public: true });
    const chart = await models.Chart.create({
      project_id: owner.project.id,
      name: "Public revenue",
      type: "line",
      draft: false,
      onReport: true,
      chartData: {
        labels: ["Jan"],
        datasets: [{ label: "Revenue", data: [42] }],
      },
    });
    await models.ChartDatasetConfig.create({
      chart_id: chart.id,
      dataset_id: owner.dataset.id,
      yAxis: "root[].amount",
      yAxisOperation: "sum",
    });

    const response = await request(app)
      .get(`/chart/${chart.id}`)
      .expect(200);
    const payload = JSON.stringify(response.body);

    expect(payload).not.toContain("DatasetIntelligence");
    expect(payload).not.toContain("\"profile\"");
    expect(payload).not.toContain("\"overrides\"");
    expect(payload).not.toContain("Private semantic summary");
  });
});
