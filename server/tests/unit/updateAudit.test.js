import {
  beforeAll, beforeEach, describe, expect, it,
} from "vitest";
import { createRequire } from "module";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("updateAudit", () => {
  let models;
  let updateAudit;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    models = await getModels();
    updateAudit = require("../../modules/updateAudit.js");
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
  });

  it("sanitizes payloads and persists a completed run with ordered events", async () => {
    const traceContext = await updateAudit.startRun({
      triggerType: "chart_manual",
      entityType: "chart",
      status: "running",
      teamId: 1,
      apiKeyId: "5e951c4f-0c79-4f70-b8fb-5993ea20bc12",
      projectId: 10,
      chartId: 100,
      summary: {
        authorization: "Bearer secret-token",
      },
    });

    expect(traceContext.runId).toBeTruthy();

    const chartLoadedEvent = await updateAudit.startEvent(traceContext, "chart_loaded", {
      chartId: 100,
      headers: {
        Authorization: "Bearer secret-token",
      },
    });

    await updateAudit.finishEvent(traceContext, chartLoadedEvent, "success", {
      chartId: 100,
      responseSnippet: "ok",
    });

    await updateAudit.completeRun(traceContext, {
      status: "success",
      summary: {
        chartId: 100,
        datasetCount: 2,
      },
    });

    const persistedRun = await models.UpdateRun.findByPk(traceContext.runId, {
      include: [{ model: models.UpdateRunEvent, as: "events" }],
      order: [[{ model: models.UpdateRunEvent, as: "events" }, "sequence", "ASC"]],
    });

    expect(persistedRun.status).toBe("success");
    expect(persistedRun.apiKeyId).toBe("5e951c4f-0c79-4f70-b8fb-5993ea20bc12");
    expect(persistedRun.summary).toEqual({
      chartId: 100,
      datasetCount: 2,
    });
    expect(persistedRun.events).toHaveLength(2);
    expect(persistedRun.events[0].sequence).toBe(1);
    expect(persistedRun.events[0].payload.headers.Authorization).toBe("[REDACTED]");
    expect(persistedRun.events[1].stage).toBe("run_finished");
  });

  it("records normalized failure metadata", async () => {
    const traceContext = await updateAudit.startRun({
      triggerType: "chart_auto",
      entityType: "chart",
      status: "running",
      teamId: 1,
      projectId: 11,
      chartId: 101,
    });

    const error = new Error("Database write failed");
    error.code = "SQLITE_BUSY";
    error.auditStage = "persist";

    await updateAudit.failRun(traceContext, error, {
      stage: "persist",
      payload: {
        chartId: 101,
      },
    });

    const persistedRun = await models.UpdateRun.findByPk(traceContext.runId, {
      include: [{ model: models.UpdateRunEvent, as: "events" }],
    });

    expect(persistedRun.status).toBe("failed");
    expect(persistedRun.errorStage).toBe("persist");
    expect(persistedRun.errorCode).toBe("SQLITE_BUSY");
    expect(persistedRun.events).toHaveLength(1);
    expect(persistedRun.events[0].stage).toBe("run_failed");
  });

  it("redacts sensitive snippets", () => {
    expect(updateAudit.sanitizeSnippet("Bearer super-secret-token")).toBe("Bearer [REDACTED]");
    expect(updateAudit.sanitizePayload({
      password: "secret",
      nested: {
        api_key: "123",
      },
    })).toEqual({
      password: "[REDACTED]",
      nested: {
        api_key: "[REDACTED]",
      },
    });
  });

  it("cleans update runs in batches while preserving recent failures", async () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    const oldDate = new Date("2026-05-01T00:00:00.000Z");
    const recentFailedDate = new Date("2026-06-01T00:00:00.000Z");
    const runs = await Promise.all([
      models.UpdateRun.create({
        traceId: "old-success-1",
        rootTraceId: "old-success-1",
        triggerType: "chart_auto",
        entityType: "chart",
        status: "success",
        startedAt: oldDate,
      }),
      models.UpdateRun.create({
        traceId: "old-success-2",
        rootTraceId: "old-success-2",
        triggerType: "chart_auto",
        entityType: "chart",
        status: "success",
        startedAt: oldDate,
      }),
      models.UpdateRun.create({
        traceId: "recent-failed",
        rootTraceId: "recent-failed",
        triggerType: "chart_auto",
        entityType: "chart",
        status: "failed",
        startedAt: recentFailedDate,
      }),
    ]);

    await models.UpdateRunEvent.bulkCreate(runs.map((run, index) => ({
      runId: run.id,
      sequence: 1,
      stage: "run_finished",
      status: "success",
      startedAt: oldDate,
      payload: { index },
    })));

    const report = await updateAudit.cleanupExpiredRuns({
      retentionDays: 30,
      failedRetentionDays: 90,
      batchSize: 1,
      now,
    });

    expect(report.deletedRuns).toBe(2);
    expect(report.deletedEvents).toBe(2);
    expect(report.batches).toBe(2);
    expect(await models.UpdateRun.count()).toBe(1);
    expect((await models.UpdateRun.findOne()).status).toBe("failed");
  });

  it("reports expired update runs without deleting them in dry-run mode", async () => {
    await models.UpdateRun.create({
      traceId: "dry-run",
      rootTraceId: "dry-run",
      triggerType: "chart_auto",
      entityType: "chart",
      status: "success",
      startedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const report = await updateAudit.cleanupExpiredRuns({
      retentionDays: 30,
      failedRetentionDays: 90,
      dryRun: true,
      now: new Date("2026-07-29T00:00:00.000Z"),
    });

    expect(report.matchedRuns).toBe(1);
    expect(report.deletedRuns).toBe(0);
    expect(await models.UpdateRun.count()).toBe(1);
  });
});
