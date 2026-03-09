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
});
