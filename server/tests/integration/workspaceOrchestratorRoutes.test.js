import crypto from "node:crypto";
import {
  afterEach, beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";
import request from "supertest";
import { createRequire } from "node:module";

import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";

const require = createRequire(import.meta.url);
const {
  cleanupWorkspaceLearning,
} = require("../../modules/workspaceContext/retention");
const {
  applyDirectMetricInstruction,
} = require("../../controllers/AiController");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const UserController = require("../../controllers/UserController");
const {
  executePendingAction,
  findAppliedResult,
} = require("../../modules/workspaceContext/pendingActionExecutor");
const {
  getWorkspaceAccessEnvelope,
} = require("../../modules/workspaceContext/accessEnvelope");
const {
  readWorkspaceContext,
} = require("../../modules/workspaceContext/workspaceContextService");
const {
  consumePendingAction,
  createPendingAction,
  hashSessionBinding,
} = require("../../modules/workspaceContext/previewStore");
const {
  setPlatformSettingOverrides,
} = require("../../modules/platformSettings/runtime");

async function createUserAccess(models, role = "teamOwner", projects = null) {
  const user = await models.User.create(userFactory.build());
  const team = await models.Team.create(teamFactory.build());
  const project = await models.Project.create(projectFactory.build({
    team_id: team.id,
  }));
  await models.TeamRole.create({
    projects,
    role,
    team_id: team.id,
    user_id: user.id,
  });
  const token = generateTestToken({
    email: user.email,
    id: user.id,
    name: user.name,
  });
  return {
    project, team, token, user,
  };
}

async function createObservation(models, { project, team }) {
  const now = new Date("2026-08-11T00:00:00.000Z");
  return models.Observation.create({
    absolute_delta: 5,
    baseline_value: 10,
    confidence: "high",
    current_value: 15,
    deduplication_key: `route-test:${crypto.randomUUID()}`,
    definition_fingerprint: crypto.randomUUID(),
    direction: "increase",
    evidence: {},
    first_detected_at: now,
    last_detected_at: now,
    project_id: project.id,
    score: 0.9,
    score_version: "route-test-v1",
    severity: "high",
    summary: "A stored metric changed.",
    team_id: team.id,
    title: "Stored metric change",
  });
}

async function createFinalEvaluation(models, {
  metricName = "Stable revenue", passesThreshold = false, project, team, user,
}) {
  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() - (60 * 60 * 1000));
  const currentPeriodStart = new Date(currentPeriodEnd.getTime() - (24 * 60 * 60 * 1000));
  const comparisonPeriodStart = new Date(currentPeriodStart.getTime() - (24 * 60 * 60 * 1000));
  const monitor = await models.MetricMonitor.create({
    baseline_policy: {
      calendarTimezone: "UTC",
      comparison: "previous_period",
      comparisonPeriod: "day",
      periodMode: "completed",
    },
    binding_key: `${metricName}:${crypto.randomUUID()}`,
    created_by: user.id,
    definition_fingerprint: crypto.randomUUID(),
    importance: 3,
    kind: "timeseries",
    metric_spec: {
      desiredDirection: "higher",
      metricBehavior: "flow",
      valueFormat: {
        display: {
          currency: "USD",
          decimals: 0,
          notation: "standard",
          prefix: "",
          scale: 1,
          suffix: "",
        },
        meaning: "currency",
        mode: "override",
      },
    },
    name: metricName,
    project_id: project.id,
    publication_policy: { thresholdType: "relative", thresholdValue: 0.1 },
    status: "ready",
    team_id: team.id,
  });
  const evaluation = await models.MetricEvaluation.create({
    absolute_delta: 2,
    baseline_value: 118,
    calendar_timezone: "UTC",
    comparison_period: "day",
    comparison_period_end: currentPeriodStart,
    comparison_period_start: comparisonPeriodStart,
    completeness: 1,
    current_period_end: currentPeriodEnd,
    current_period_start: currentPeriodStart,
    current_value: 120,
    definition_fingerprint: monitor.definition_fingerprint,
    evaluated_at: now,
    evaluation_key: `day:${currentPeriodEnd.toISOString()}`,
    evidence: {},
    finality: "final",
    finalized_at: now,
    metric_behavior: "flow",
    monitor_id: monitor.id,
    passes_threshold: passesThreshold,
    policy_version: "route-test-v1",
    readiness: "eligible",
    relative_delta: 2 / 118,
    revision: 1,
    source_bucket_count: 1,
    source_checkpoint_count: 1,
    team_id: team.id,
  });
  return { evaluation, monitor };
}

describe("workspace orchestrator routes", () => {
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    setPlatformSettingOverrides({});
    delete process.env.CB_OPENAI_API_KEY_DEV;
  });

  afterEach(() => {
    setPlatformSettingOverrides({});
  });

  it("requires authentication for structured confirmation", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);

    const response = await request(app)
      .post("/ai/respond")
      .send({
        action: {
          actionId: crypto.randomUUID(),
          type: "confirm_pending_action",
        },
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: 1,
      })
      .expect(401);
    expect(response.status).toBe(401);
  });

  it("uses the authenticated AI session for confirmation without an external model call", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        action: {
          actionId: crypto.randomUUID(),
          type: "confirm_pending_action",
        },
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(404);

    expect(response.body.error).toBe("This chat has expired");
  });

  it("handles typed confirmation without an external model call", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message: "Yes",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(404);

    expect(response.body.error).toBe("This chat has expired");
  });

  it("answers a stored workspace summary without an external model key", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message: "What happened in the workspace this week?",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toContain("Recent changes");
    expect(response.body.orchestration.usage.total_tokens).toBe(0);
  });

  it("returns a distinct local fallback for each Activity shortcut", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);
    const ask = async (message) => request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message,
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    const [recent, attention, freshness] = await Promise.all([
      ask("Summarize recent changes"),
      ask("Which metrics need attention?"),
      ask("Check data freshness"),
    ]);
    const messages = [recent, attention, freshness]
      .map((response) => response.body.orchestration.message);

    expect(messages[0]).toContain("Recent changes");
    expect(messages[1]).toContain("Metrics that need attention");
    expect(messages[2]).toContain("Data freshness");
    expect(new Set(messages).size).toBe(3);
  });

  it("reports that Chartbrew AI is turned off without using a fallback", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);
    setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": false });

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message: "Summarize recent changes",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toBe(
      "Chartbrew AI is turned off. A platform administrator can turn it on in Settings."
    );
    expect(response.body.orchestration.usage.total_tokens).toBe(0);
  });

  it("does not run a prepared action when Chartbrew AI is turned off", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);
    setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": false });

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        action: {
          actionId: crypto.randomUUID(),
          type: "confirm_pending_action",
        },
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toContain("Chartbrew AI is turned off");
    expect(response.body.orchestration.pendingAction).toBeNull();
  });

  it("summarizes every owner dashboard by name without asking for scope", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);
    await seeded.project.update({ name: "Revenue overview" });
    const secondProject = await models.Project.create(projectFactory.build({
      name: "Customer health",
      team_id: seeded.team.id,
    }));
    await Promise.all([
      createObservation(models, {
        project: seeded.project,
        team: seeded.team,
      }),
      createObservation(models, {
        project: secondProject,
        team: seeded.team,
      }),
    ]);

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message: "Summarize recent changes",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toContain("### Revenue overview");
    expect(response.body.orchestration.message).toContain("### Customer health");
    expect(response.body.orchestration.message).not.toContain("need the scope");
    expect(response.body.orchestration.message).not.toContain(`Dashboard ${seeded.project.id}`);
    expect(response.body.orchestration.message).not.toContain(`Dashboard ${secondProject.id}`);
  });

  it("uses a stored-data fallback for a workspace follow-up without an external model key", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message: "Tell me more about this workspace",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toContain("Recent changes");
    expect(response.body.orchestration.usage.total_tokens).toBe(0);
  });

  it("invalidates an old preview when the user sends a new message", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);
    const access = {
      allProjects: true,
      canConfigureTeam: true,
      projectIds: [],
      role: "teamOwner",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    const conversation = await models.AiConversation.create({
      message_count: 0,
      status: "active",
      team_id: seeded.team.id,
      title: "Preview test",
      user_id: seeded.user.id,
    });
    const sessionId = `conversation:${conversation.id}`;
    const envelope = await getWorkspaceAccessEnvelope(access);
    const pending = await createPendingAction({
      access,
      accessVersion: envelope.accessVersion,
      actionType: "kpi_review.create",
      proposal: {
        changedValues: { cadence: "weekly" },
        data: { cadence: "weekly" },
        mode: "create",
      },
      sessionId,
    });

    await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        aiConversationId: conversation.id,
        message: "Tell me more about this workspace",
        persistence: "persistent",
        teamId: seeded.team.id,
      })
      .expect(200);

    await expect(consumePendingAction({
      access,
      accessVersion: envelope.accessVersion,
      actionId: pending.actionId,
      sessionId,
    })).rejects.toMatchObject({ code: "PENDING_ACTION_EXPIRED" });
  });

  it("omits a stable final evaluation without running data", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createUserAccess(models);
    const { evaluation } = await createFinalEvaluation(models, seeded);
    const revised = await models.MetricEvaluation.create({
      ...evaluation.get({ plain: true }),
      absolute_delta: 7,
      corrected_at: new Date(),
      current_value: 125,
      finality: "revised",
      id: undefined,
      relative_delta: 7 / 118,
      revision: 2,
    });
    const chartRefresh = vi.spyOn(ChartController.prototype, "updateChartData");
    const datasetRun = vi.spyOn(DatasetController.prototype, "runRequest");

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        message: "What has been happening in the workspace?",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: seeded.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).not.toContain("Stable revenue");
    expect(response.body.orchestration.message).not.toContain("$125");
    expect(response.body.orchestration.message).not.toContain("$120");
    expect(response.body.orchestration.message).toContain(
      "There are no important metric changes"
    );
    expect(chartRefresh).not.toHaveBeenCalled();
    expect(datasetRun).not.toHaveBeenCalled();
    await expect(models.Observation.count({
      where: { metric_evaluation_id: [evaluation.id, revised.id] },
    })).resolves.toBe(0);
  });

  it("limits a viewer summary to assigned dashboards", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const owner = await createUserAccess(models);
    const hiddenProject = await models.Project.create(projectFactory.build({
      team_id: owner.team.id,
    }));
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const viewerToken = generateTestToken({
      email: viewer.email,
      id: viewer.id,
      name: viewer.name,
    });
    await createFinalEvaluation(models, {
      metricName: "Visible pipeline",
      passesThreshold: true,
      project: owner.project,
      team: owner.team,
      user: viewer,
    });
    await createFinalEvaluation(models, {
      metricName: "Hidden margin",
      passesThreshold: true,
      project: hiddenProject,
      team: owner.team,
      user: owner.user,
    });

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        message: "What happened in the workspace this week?",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: owner.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toContain("Visible pipeline");
    expect(response.body.orchestration.message).not.toContain("Hidden margin");
    expect(response.body.orchestration.message)
      .toContain("Only dashboards you can access are included.");
  });

  it("refuses viewer source queries and chart creation before data execution", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const owner = await createUserAccess(models);
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const viewerToken = generateTestToken({
      email: viewer.email,
      id: viewer.id,
      name: viewer.name,
    });
    const datasetRun = vi.spyOn(DatasetController.prototype, "runRequest");
    const chartCountBefore = await models.Chart.count({
      where: { project_id: owner.project.id },
    });

    const response = await request(app)
      .post("/ai/respond")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        message: "Run the sales dataset and create a chart from the result",
        persistence: "ephemeral",
        sessionId: crypto.randomUUID(),
        teamId: owner.team.id,
      })
      .expect(200);

    expect(response.body.orchestration.message).toContain("I cannot query data sources");
    expect(response.body.orchestration.message)
      .toContain("Ask a workspace editor or administrator");
    expect(response.body.orchestration.usage.total_tokens).toBe(0);
    expect(datasetRun).not.toHaveBeenCalled();
    await expect(models.Chart.count({
      where: { project_id: owner.project.id },
    })).resolves.toBe(chartCountBefore);
  });

  it("limits complete workspace context to visible projects and personal KPI reviews", async () => {
    const owner = await createUserAccess(models);
    const hiddenProject = await models.Project.create(projectFactory.build({
      team_id: owner.team.id,
    }));
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const visibleDataset = await models.Dataset.create({
      draft: false,
      name: "Visible dataset",
      project_ids: [owner.project.id],
      team_id: owner.team.id,
    });
    await models.Dataset.create({
      draft: false,
      name: "Hidden dataset",
      project_ids: [hiddenProject.id],
      team_id: owner.team.id,
    });
    const { monitor: visibleMonitor } = await createFinalEvaluation(models, {
      metricName: "Visible metric",
      project: owner.project,
      team: owner.team,
      user: viewer,
    });
    await createFinalEvaluation(models, {
      metricName: "Hidden metric",
      project: hiddenProject,
      team: owner.team,
      user: owner.user,
    });
    const viewerReview = await models.ObservationDigestSubscription.create({
      cadence: "weekly",
      day_of_week: 1,
      local_delivery_time: "09:00",
      project_id: owner.project.id,
      team_id: owner.team.id,
      timezone: "UTC",
      user_id: viewer.id,
    });
    await models.ObservationDigestSubscription.create({
      cadence: "weekly",
      day_of_week: 2,
      local_delivery_time: "10:00",
      project_id: hiddenProject.id,
      team_id: owner.team.id,
      timezone: "UTC",
      user_id: viewer.id,
    });
    await models.ObservationDigestSubscription.create({
      cadence: "monthly",
      day_of_month: 1,
      local_delivery_time: "11:00",
      project_id: owner.project.id,
      team_id: owner.team.id,
      timezone: "UTC",
      user_id: owner.user.id,
    });
    const access = {
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [owner.project.id],
      role: "projectViewer",
      teamId: owner.team.id,
      userId: viewer.id,
    };
    const envelope = await getWorkspaceAccessEnvelope(access);

    const context = await readWorkspaceContext(access, envelope, {
      sections: ["account", "dashboards", "datasets", "kpiReviews", "watches"],
    });

    expect(context.account).toEqual(expect.objectContaining({
      canConfigureConnections: false,
      canEditWatchedMetrics: false,
      canSchedulePersonalReview: false,
    }));
    expect(context.dashboards.map((dashboard) => dashboard.id)).toEqual([owner.project.id]);
    expect(context.datasets).toEqual([
      expect.objectContaining({ id: visibleDataset.id, name: "Visible dataset" }),
    ]);
    expect(context.kpiReviews).toEqual([
      expect.objectContaining({ id: viewerReview.id }),
    ]);
    expect(context.watches).toEqual([
      expect.objectContaining({
        canEdit: false,
        id: visibleMonitor.id,
        name: "Visible metric",
      }),
    ]);
    expect(JSON.stringify(context)).not.toContain("Hidden");
  });

  it("records bounded corrections from normal watch and KPI review updates", async () => {
    const app = await createTestApp();
    require("../../api/ObservationRoute.js")(app);
    const seeded = await createUserAccess(models);
    const { monitor } = await createFinalEvaluation(models, seeded);
    const review = await models.ObservationDigestSubscription.create({
      cadence: "weekly",
      day_of_week: 1,
      local_delivery_time: "09:00",
      project_id: seeded.project.id,
      team_id: seeded.team.id,
      timezone: "UTC",
      user_id: seeded.user.id,
    });

    await request(app)
      .put(`/team/${seeded.team.id}/monitors/${monitor.id}`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({ importance: 2, name: "UI revenue" })
      .expect(200);
    await request(app)
      .put(`/team/${seeded.team.id}/observation-digests/${review.id}`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({ cadence: "monthly", dayOfMonth: 10 })
      .expect(200);

    const audits = await models.OrchestratorActionAudit.findAll({
      order: [["action_type", "ASC"]],
      where: {
        actor_user_id: seeded.user.id,
        source: "ui",
        team_id: seeded.team.id,
      },
    });
    expect(audits).toHaveLength(2);
    expect(audits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: "metric_monitor.update",
        after_values: expect.objectContaining({ importance: 2, name: "UI revenue" }),
        authority_type: "direct_ui",
        before_values: expect.objectContaining({ name: "Stable revenue" }),
      }),
      expect.objectContaining({
        action_type: "kpi_review.update",
        after_values: expect.objectContaining({ cadence: "monthly", dayOfMonth: 10 }),
        authority_type: "direct_ui",
        before_values: expect.objectContaining({ cadence: "weekly" }),
      }),
    ]));
  });

  it("does not expose a pending-action redemption route", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);

    const response = await request(app)
      .post(`/ai/pending-actions/${crypto.randomUUID()}/confirm`)
      .send({})
      .expect(404);
    expect(response.status).toBe(404);
  });

  it("commits one confirmed KPI review with its audit and reuses the result on retry", async () => {
    const seeded = await createUserAccess(models);
    const access = {
      allProjects: true,
      canConfigureTeam: true,
      projectIds: [],
      role: "teamOwner",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    const sessionId = `session:${crypto.randomUUID()}`;
    process.env.CB_WORKSPACE_KPI_REVIEW_WRITES_ENABLED = "true";
    try {
      const envelope = await getWorkspaceAccessEnvelope(access);
      const data = {
        cadence: "weekly",
        contentMode: "kpi_review",
        dayOfWeek: 1,
        enabled: true,
        evaluationWaitMinutes: 120,
        localDeliveryTime: "09:00",
        timezone: "UTC",
      };
      const pending = await createPendingAction({
        access,
        accessVersion: envelope.accessVersion,
        actionType: "kpi_review.create",
        proposal: {
          changedValues: data,
          data,
          mode: "create",
        },
        sessionId,
      });

      const first = await executePendingAction({
        access,
        actionId: pending.actionId,
        sessionId,
      });
      const retry = await executePendingAction({
        access,
        actionId: pending.actionId,
        sessionId,
      });

      expect(first.status).toBe("applied");
      expect(retry).toEqual(first);
      await expect(models.ObservationDigestSubscription.count({
        where: { team_id: seeded.team.id, user_id: seeded.user.id },
      })).resolves.toBe(1);
      await expect(models.OrchestratorActionAudit.count({
        where: { action_id: pending.actionId, status: "applied" },
      })).resolves.toBe(1);
    } finally {
      delete process.env.CB_WORKSPACE_KPI_REVIEW_WRITES_ENABLED;
    }
  });

  it("does not use a direct instruction as KPI review confirmation", async () => {
    const seeded = await createUserAccess(models);
    const access = {
      allProjects: true,
      canConfigureTeam: true,
      projectIds: [],
      role: "teamOwner",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    const sessionId = `session:${crypto.randomUUID()}`;
    const envelope = await getWorkspaceAccessEnvelope(access);
    const data = {
      cadence: "weekly",
      contentMode: "kpi_review",
      dayOfWeek: 1,
      enabled: true,
      evaluationWaitMinutes: 120,
      localDeliveryTime: "09:00",
      timezone: "UTC",
    };
    const pending = await createPendingAction({
      access,
      accessVersion: envelope.accessVersion,
      actionType: "kpi_review.create",
      proposal: { changedValues: data, data, mode: "create" },
      sessionId,
    });

    await expect(executePendingAction({
      access,
      actionId: pending.actionId,
      authorityType: "clear_instruction",
      sessionId,
    })).rejects.toMatchObject({
      code: "ACTION_CONFIRMATION_REQUIRED",
      statusCode: 409,
    });
    await expect(models.ObservationDigestSubscription.count({
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    })).resolves.toBe(0);
  });

  it("applies a direct watched-metric update from the exact proposal and records one audit", async () => {
    const seeded = await createUserAccess(models);
    const { monitor } = await createFinalEvaluation(models, seeded);
    await monitor.reload();
    const access = {
      allProjects: true,
      canConfigureTeam: true,
      projectIds: [],
      role: "teamOwner",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    const sessionId = `session:${crypto.randomUUID()}`;
    process.env.CB_WORKSPACE_METRIC_MONITOR_WRITES_ENABLED = "true";
    try {
      const envelope = await getWorkspaceAccessEnvelope(access);
      const data = {
        importance: 2,
        name: "Reviewed revenue",
      };
      const pending = await createPendingAction({
        access,
        accessVersion: envelope.accessVersion,
        actionType: "metric_monitor.update",
        projectId: seeded.project.id,
        proposal: {
          changedValues: data,
          data,
          mode: "update",
          monitorId: monitor.id,
        },
        resourceId: monitor.id,
        resourceVersion: monitor.updatedAt.toISOString(),
        sessionId,
      });

      const orchestration = await applyDirectMetricInstruction({
        access,
        metricMonitorWritesEnabled: true,
        orchestration: {
          conversationHistory: [{
            content: "Change Revenue to Reviewed revenue",
            role: "user",
          }, {
            content: "Confirm this change.",
            role: "assistant",
          }],
          message: "Confirm this change.",
          pendingAction: {
            actionId: pending.actionId,
            actionType: "metric_monitor.update",
          },
        },
        question: "Change Revenue to Reviewed revenue",
        sessionId,
      });
      const result = orchestration.actionResult;
      const updated = await models.MetricMonitor.findByPk(monitor.id);
      const retryPending = await createPendingAction({
        access,
        accessVersion: envelope.accessVersion,
        actionType: "metric_monitor.update",
        projectId: seeded.project.id,
        proposal: {
          changedValues: data,
          data,
          mode: "update",
          monitorId: monitor.id,
        },
        resourceId: monitor.id,
        resourceVersion: updated.updatedAt.toISOString(),
        sessionId,
      });
      const retry = await applyDirectMetricInstruction({
        access,
        metricMonitorWritesEnabled: true,
        orchestration: {
          conversationHistory: [],
          message: "Confirm this change.",
          pendingAction: {
            actionId: retryPending.actionId,
            actionType: "metric_monitor.update",
          },
        },
        question: "Change Revenue to Reviewed revenue",
        sessionId,
      });
      const audits = await models.OrchestratorActionAudit.findAll({
        where: {
          action_type: "metric_monitor.update",
          actor_user_id: seeded.user.id,
          resource_id: monitor.id,
        },
      });

      expect(result).toEqual(expect.objectContaining({
        actionId: pending.actionId,
        actionType: "metric_monitor.update",
        applied: expect.objectContaining({
          importance: 2,
          name: "Reviewed revenue",
        }),
        status: "applied",
      }));
      expect(orchestration.message).toContain("was updated");
      expect(orchestration.pendingAction).toBeNull();
      expect(orchestration.conversationHistory.at(-1).content).toBe(orchestration.message);
      expect(retry.actionResult).toEqual(result);
      expect(updated).toEqual(expect.objectContaining({
        importance: 2,
        name: "Reviewed revenue",
      }));
      expect(audits).toHaveLength(1);
      expect(audits[0]).toEqual(expect.objectContaining({
        action_type: "metric_monitor.update",
        authority_type: "clear_instruction",
        before_values: expect.objectContaining({ name: "Stable revenue" }),
        status: "applied",
      }));
    } finally {
      delete process.env.CB_WORKSPACE_METRIC_MONITOR_WRITES_ENABLED;
    }
  });

  it("updates only the current user's KPI review and records the exact result", async () => {
    const seeded = await createUserAccess(models);
    const access = {
      allProjects: true,
      canConfigureTeam: true,
      projectIds: [],
      role: "teamOwner",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    const sessionId = `session:${crypto.randomUUID()}`;
    process.env.CB_WORKSPACE_KPI_REVIEW_WRITES_ENABLED = "true";
    try {
      const envelope = await getWorkspaceAccessEnvelope(access);
      const createData = {
        cadence: "weekly",
        contentMode: "kpi_review",
        dayOfWeek: 1,
        enabled: true,
        evaluationWaitMinutes: 120,
        localDeliveryTime: "09:00",
        timezone: "UTC",
      };
      const createPending = await createPendingAction({
        access,
        accessVersion: envelope.accessVersion,
        actionType: "kpi_review.create",
        proposal: {
          changedValues: createData,
          data: createData,
          mode: "create",
        },
        sessionId,
      });
      const created = await executePendingAction({
        access,
        actionId: createPending.actionId,
        sessionId,
      });
      const review = await models.ObservationDigestSubscription.findByPk(created.resource.id);
      const updateData = {
        cadence: "monthly",
        dayOfMonth: 15,
        localDeliveryTime: "10:30",
      };
      const updatePending = await createPendingAction({
        access,
        accessVersion: envelope.accessVersion,
        actionType: "kpi_review.update",
        proposal: {
          changedValues: updateData,
          data: updateData,
          mode: "update",
          subscriptionId: review.id,
        },
        resourceId: review.id,
        resourceVersion: review.updatedAt.toISOString(),
        sessionId,
      });

      const result = await executePendingAction({
        access,
        actionId: updatePending.actionId,
        sessionId,
      });
      const updated = await models.ObservationDigestSubscription.findByPk(review.id);
      const audits = await models.OrchestratorActionAudit.findAll({
        where: { action_id: updatePending.actionId },
      });

      expect(result).toEqual(expect.objectContaining({
        actionId: updatePending.actionId,
        actionType: "kpi_review.update",
        applied: expect.objectContaining({
          cadence: "monthly",
          dayOfMonth: 15,
          localDeliveryTime: "10:30",
        }),
        resource: expect.objectContaining({ id: review.id }),
        status: "applied",
      }));
      expect(updated).toEqual(expect.objectContaining({
        cadence: "monthly",
        day_of_month: 15,
        local_delivery_time: "10:30",
        user_id: seeded.user.id,
      }));
      expect(audits).toHaveLength(1);
      expect(audits[0]).toEqual(expect.objectContaining({
        action_type: "kpi_review.update",
        before_values: expect.objectContaining({ cadence: "weekly" }),
        status: "applied",
      }));
    } finally {
      delete process.env.CB_WORKSPACE_KPI_REVIEW_WRITES_ENABLED;
    }
  });

  it("does not recover an applied dashboard action after access is removed", async () => {
    const seeded = await createUserAccess(models);
    const visibleProject = await models.Project.create(projectFactory.build({
      team_id: seeded.team.id,
    }));
    const sessionId = `session:${crypto.randomUUID()}`;
    const actionId = crypto.randomUUID();
    await models.OrchestratorActionAudit.create({
      action_id: actionId,
      action_type: "metric_monitor.update",
      actor_user_id: seeded.user.id,
      after_values: { name: "Hidden metric" },
      authority_type: "confirmed_preview",
      changed_fields: ["name"],
      completed_at: new Date(),
      project_id: seeded.project.id,
      resource_id: crypto.randomUUID(),
      resource_type: "metric_monitor",
      session_binding_hash: hashSessionBinding(sessionId),
      source: "orchestrator",
      status: "applied",
      team_id: seeded.team.id,
    });
    await models.TeamRole.update({
      projects: [visibleProject.id],
      role: "projectViewer",
    }, {
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    });

    await expect(findAppliedResult({
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [visibleProject.id],
      role: "projectViewer",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    }, actionId, sessionId)).resolves.toBeNull();
  });

  it("records an access conflict and applies no KPI review after a role change", async () => {
    const seeded = await createUserAccess(models);
    const ownerAccess = {
      allProjects: true,
      canConfigureTeam: true,
      projectIds: [],
      role: "teamOwner",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    const sessionId = `session:${crypto.randomUUID()}`;
    const envelope = await getWorkspaceAccessEnvelope(ownerAccess);
    const data = {
      cadence: "weekly",
      contentMode: "kpi_review",
      dayOfWeek: 1,
      enabled: true,
      evaluationWaitMinutes: 120,
      localDeliveryTime: "09:00",
      timezone: "UTC",
    };
    const pending = await createPendingAction({
      access: ownerAccess,
      accessVersion: envelope.accessVersion,
      actionType: "kpi_review.create",
      proposal: { changedValues: data, data, mode: "create" },
      sessionId,
    });
    await models.TeamRole.update({
      projects: [seeded.project.id],
      role: "projectViewer",
    }, {
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    });

    await expect(executePendingAction({
      access: {
        allProjects: false,
        canConfigureTeam: false,
        projectIds: [seeded.project.id],
        role: "projectViewer",
        teamId: seeded.team.id,
        userId: seeded.user.id,
      },
      actionId: pending.actionId,
      sessionId,
    })).rejects.toMatchObject({ code: "PENDING_ACTION_ACCESS_CHANGED", statusCode: 409 });
    await expect(models.ObservationDigestSubscription.count({
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    })).resolves.toBe(0);
    await expect(models.OrchestratorActionAudit.findOne({
      where: { action_id: pending.actionId },
    })).resolves.toEqual(expect.objectContaining({
      failure_code: "PENDING_ACTION_ACCESS_CHANGED",
      status: "conflicted",
    }));
  });

  it("rejects a viewer KPI review action even if a pending action exists", async () => {
    const seeded = await createUserAccess(models, "projectViewer", []);
    const viewerAccess = {
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [seeded.project.id],
      role: "projectViewer",
      teamId: seeded.team.id,
      userId: seeded.user.id,
    };
    await models.TeamRole.update({ projects: [seeded.project.id] }, {
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    });
    const envelope = await getWorkspaceAccessEnvelope(viewerAccess);
    const sessionId = `session:${crypto.randomUUID()}`;
    const data = {
      cadence: "weekly",
      contentMode: "kpi_review",
      dayOfWeek: 1,
      enabled: true,
      evaluationWaitMinutes: 120,
      localDeliveryTime: "09:00",
      timezone: "UTC",
    };
    const pending = await createPendingAction({
      access: viewerAccess,
      accessVersion: envelope.accessVersion,
      actionType: "kpi_review.create",
      proposal: { changedValues: data, data, mode: "create" },
      sessionId,
    });

    await expect(executePendingAction({
      access: viewerAccess,
      actionId: pending.actionId,
      sessionId,
    })).rejects.toMatchObject({
      code: "KPI_REVIEW_WRITE_FORBIDDEN",
      statusCode: 403,
    });
    await expect(models.ObservationDigestSubscription.count({
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    })).resolves.toBe(0);
  });

  it("keeps action and egress audit routes behind workspace administration access", async () => {
    const app = await createTestApp();
    require("../../api/ObservationRoute.js")(app);
    const owner = await createUserAccess(models);
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const viewerToken = generateTestToken({
      email: viewer.email,
      id: viewer.id,
      name: viewer.name,
    });

    const ownerActionResponse = await request(app)
      .get(`/team/${owner.team.id}/orchestrator-audit`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    await request(app)
      .get(`/team/${owner.team.id}/orchestrator-egress-audit`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    await request(app)
      .get(`/team/${owner.team.id}/orchestrator-audit`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403);
    const viewerEgressResponse = await request(app)
      .get(`/team/${owner.team.id}/orchestrator-egress-audit`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403);
    expect(ownerActionResponse.body).toEqual({ items: [], truncated: false });
    expect(viewerEgressResponse.body.error).toBe("Access denied");
  });

  it("exports workspace audit data only to administrators and personal learning to users", async () => {
    const app = await createTestApp();
    require("../../api/ObservationRoute.js")(app);
    const owner = await createUserAccess(models);
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const viewerToken = generateTestToken({
      email: viewer.email,
      id: viewer.id,
      name: viewer.name,
    });
    const observation = await createObservation(models, owner);
    await models.ObservationFeedback.bulkCreate([{
      observation_id: observation.id,
      reason_code: "expected_change",
      user_id: owner.user.id,
      verdict: "relevant",
    }, {
      observation_id: observation.id,
      reason_code: "not_actionable",
      user_id: viewer.id,
      verdict: "irrelevant",
    }]);
    const viewerReview = await models.ObservationDigestSubscription.create({
      cadence: "weekly",
      local_delivery_time: "09:00",
      project_id: owner.project.id,
      team_id: owner.team.id,
      timezone: "UTC",
      user_id: viewer.id,
    });
    await models.ObservationDigestSubscription.create({
      cadence: "monthly",
      local_delivery_time: "10:00",
      project_id: owner.project.id,
      team_id: owner.team.id,
      timezone: "UTC",
      user_id: owner.user.id,
    });
    const actionAudit = await models.OrchestratorActionAudit.create({
      action_id: crypto.randomUUID(),
      action_type: "metric_monitor.update",
      actor_user_id: owner.user.id,
      after_values: { comparisonPeriod: "week" },
      authority_type: "confirmed_preview",
      before_values: { comparisonPeriod: "day" },
      changed_fields: ["comparisonPeriod"],
      completed_at: new Date(),
      project_id: owner.project.id,
      resource_id: crypto.randomUUID(),
      resource_type: "metric_monitor",
      source: "orchestrator",
      status: "applied",
      team_id: owner.team.id,
    });
    const usage = await models.AiUsage.create({
      context_manifest: {
        contractVersion: 1,
        factCounts: { observations: 2 },
        resultStatus: "validated",
      },
      model: "external-test",
      purpose: "workspace_summary",
      team_id: owner.team.id,
    });

    const personal = await request(app)
      .get(`/team/${owner.team.id}/workspace-learning/export`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);
    const workspace = await request(app)
      .get(`/team/${owner.team.id}/workspace-learning/export`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(personal.body).toEqual(expect.objectContaining({
      actionAudits: [],
      aiContextManifests: [],
      kpiReviews: [expect.objectContaining({ id: viewerReview.id, userId: viewer.id })],
      observationFeedback: [expect.objectContaining({ userId: viewer.id })],
      scope: "personal",
    }));
    expect(personal.body.observationFeedback.every((item) => item.userId === viewer.id)).toBe(true);
    expect(personal.body.kpiReviews.every((item) => item.userId === viewer.id)).toBe(true);
    expect(workspace.body).toEqual(expect.objectContaining({
      actionAudits: [expect.objectContaining({ actionId: actionAudit.action_id })],
      aiContextManifests: [expect.objectContaining({ id: usage.id })],
      observationFeedback: expect.arrayContaining([
        expect.objectContaining({ userId: owner.user.id }),
        expect.objectContaining({ userId: viewer.id }),
      ]),
      scope: "workspace",
    }));
  });

  it("deletes only the current user's feedback", async () => {
    const app = await createTestApp();
    require("../../api/ObservationRoute.js")(app);
    const owner = await createUserAccess(models);
    const otherUser = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: otherUser.id,
    });
    const otherToken = generateTestToken({
      email: otherUser.email,
      id: otherUser.id,
      name: otherUser.name,
    });
    const observation = await createObservation(models, owner);
    await models.ObservationFeedback.create({
      observation_id: observation.id,
      user_id: owner.user.id,
      verdict: "relevant",
    });

    const otherResponse = await request(app)
      .delete(`/team/${owner.team.id}/observations/${observation.id}/feedback`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    expect(otherResponse.body).toEqual({ removed: false });
    await expect(models.ObservationFeedback.count({
      where: { observation_id: observation.id, user_id: owner.user.id },
    })).resolves.toBe(1);

    const ownerResponse = await request(app)
      .delete(`/team/${owner.team.id}/observations/${observation.id}/feedback`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(ownerResponse.body).toEqual({ removed: true });
  });

  it("clears every editor's pending change when a watched metric is deleted", async () => {
    const app = await createTestApp();
    require("../../api/ObservationRoute.js")(app);
    const owner = await createUserAccess(models);
    const editor = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectEditor",
      team_id: owner.team.id,
      user_id: editor.id,
    });
    const { monitor } = await createFinalEvaluation(models, {
      project: owner.project,
      team: owner.team,
      user: owner.user,
    });
    const editorAccess = {
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [owner.project.id],
      role: "projectEditor",
      teamId: owner.team.id,
      userId: editor.id,
    };
    const envelope = await getWorkspaceAccessEnvelope(editorAccess);
    const sessionId = `session:${crypto.randomUUID()}`;
    const pending = await createPendingAction({
      access: editorAccess,
      accessVersion: envelope.accessVersion,
      actionType: "metric_monitor.update",
      projectId: owner.project.id,
      proposal: {
        changedValues: { name: "Pending name" },
        data: { name: "Pending name" },
        mode: "update",
        monitorId: monitor.id,
      },
      resourceId: monitor.id,
      resourceVersion: monitor.updatedAt.toISOString(),
      sessionId,
    });

    await request(app)
      .delete(`/team/${owner.team.id}/monitors/${monitor.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    await expect(consumePendingAction({
      access: editorAccess,
      accessVersion: envelope.accessVersion,
      actionId: pending.actionId,
      sessionId,
    })).rejects.toMatchObject({ code: "PENDING_ACTION_EXPIRED" });
  });

  it("removes personal learning and previews when a non-owner user is deleted", async () => {
    const owner = await createUserAccess(models);
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [owner.project.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const observation = await createObservation(models, owner);
    await models.ObservationFeedback.create({
      observation_id: observation.id,
      user_id: viewer.id,
      verdict: "relevant",
    });
    await models.ObservationPreference.create({
      observation_id: observation.id,
      read_at: new Date(),
      user_id: viewer.id,
    });
    await models.ObservationDigestSubscription.create({
      cadence: "weekly",
      local_delivery_time: "09:00",
      project_id: owner.project.id,
      team_id: owner.team.id,
      timezone: "UTC",
      user_id: viewer.id,
    });
    const audit = await models.OrchestratorActionAudit.create({
      action_id: crypto.randomUUID(),
      action_type: "metric_monitor.update",
      actor_user_id: viewer.id,
      authority_type: "direct_ui",
      changed_fields: ["name"],
      completed_at: new Date(),
      project_id: owner.project.id,
      resource_id: crypto.randomUUID(),
      resource_type: "metric_monitor",
      source: "ui",
      status: "applied",
      team_id: owner.team.id,
    });
    const viewerAccess = {
      allProjects: false,
      canConfigureTeam: false,
      projectIds: [owner.project.id],
      role: "projectViewer",
      teamId: owner.team.id,
      userId: viewer.id,
    };
    const envelope = await getWorkspaceAccessEnvelope(viewerAccess);
    const sessionId = `session:${crypto.randomUUID()}`;
    const pending = await createPendingAction({
      access: viewerAccess,
      accessVersion: envelope.accessVersion,
      actionType: "kpi_review.create",
      proposal: {
        changedValues: { cadence: "weekly" },
        data: { cadence: "weekly" },
        mode: "create",
      },
      sessionId,
    });

    await new UserController().deleteUser(viewer.id);

    await expect(models.ObservationFeedback.count({
      where: { user_id: viewer.id },
    })).resolves.toBe(0);
    await expect(models.ObservationPreference.count({
      where: { user_id: viewer.id },
    })).resolves.toBe(0);
    await expect(models.ObservationDigestSubscription.count({
      where: { user_id: viewer.id },
    })).resolves.toBe(0);
    await expect(models.OrchestratorActionAudit.findByPk(audit.id)).resolves.toEqual(
      expect.objectContaining({ actor_user_id: null })
    );
    await expect(consumePendingAction({
      access: viewerAccess,
      accessVersion: envelope.accessVersion,
      actionId: pending.actionId,
      sessionId,
    })).rejects.toMatchObject({ code: "PENDING_ACTION_EXPIRED" });
    await expect(models.Team.findByPk(owner.team.id)).resolves.not.toBeNull();
  });

  it("dry-runs and applies bounded action-audit retention", async () => {
    const seeded = await createUserAccess(models);
    const now = new Date("2026-08-11T12:00:00.000Z");
    const oldAudit = await models.OrchestratorActionAudit.create({
      action_id: crypto.randomUUID(),
      action_type: "metric_monitor.update",
      actor_user_id: seeded.user.id,
      authority_type: "confirmed_preview",
      changed_fields: [],
      completed_at: new Date("2025-08-01T00:00:00.000Z"),
      createdAt: new Date("2025-08-01T00:00:00.000Z"),
      project_id: seeded.project.id,
      resource_type: "metric_monitor",
      source: "orchestrator",
      status: "applied",
      team_id: seeded.team.id,
      updatedAt: new Date("2025-08-01T00:00:00.000Z"),
    });
    const currentAudit = await models.OrchestratorActionAudit.create({
      action_id: crypto.randomUUID(),
      action_type: "kpi_review.create",
      actor_user_id: seeded.user.id,
      authority_type: "confirmed_preview",
      changed_fields: [],
      completed_at: now,
      createdAt: now,
      resource_type: "kpi_review",
      source: "orchestrator",
      status: "applied",
      team_id: seeded.team.id,
      updatedAt: now,
    });

    const dryRun = await cleanupWorkspaceLearning({
      actionAuditDays: 365,
      batchSize: 1,
      dryRun: true,
      now,
    });
    expect(dryRun).toEqual(expect.objectContaining({
      actionAudits: expect.objectContaining({ matched: 1 }),
      dryRun: true,
    }));
    await expect(models.OrchestratorActionAudit.findByPk(oldAudit.id)).resolves.not.toBeNull();

    const applied = await cleanupWorkspaceLearning({
      actionAuditDays: 365,
      batchSize: 1,
      now,
    });
    expect(applied.actionAudits.deleted).toBe(1);
    await expect(models.OrchestratorActionAudit.findByPk(oldAudit.id)).resolves.toBeNull();
    await expect(models.OrchestratorActionAudit.findByPk(currentAudit.id)).resolves.not.toBeNull();
  });

  it("removes project-scoped action learning when its project is deleted", async () => {
    const seeded = await createUserAccess(models);
    const audit = await models.OrchestratorActionAudit.create({
      action_id: crypto.randomUUID(),
      action_type: "metric_monitor.create",
      actor_user_id: seeded.user.id,
      authority_type: "confirmed_preview",
      changed_fields: [],
      completed_at: new Date(),
      project_id: seeded.project.id,
      resource_type: "metric_monitor",
      source: "orchestrator",
      status: "applied",
      team_id: seeded.team.id,
    });

    await seeded.project.destroy();

    await expect(models.OrchestratorActionAudit.findByPk(audit.id)).resolves.toBeNull();
  });
});
