import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Sequelize, DataTypes } = require("sequelize");
const execution = require("../../modules/sourceExecution");
const migration = require("../../models/migrations/20261001090000-create-source-execution");
const defineModel = require("../../models/models/sourceexecution");
const { buildExpiredRunWhere, normalizeCleanupOptions } = require("../../modules/updateAudit");
const connection = { id: 12, team_id: 7, type: "api", subType: "stripe" };
const options = { connection, cacheHit: false };
const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
const model = defineModel(sequelize, DataTypes);

describe("source execution records", () => {
  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
  });
  beforeEach(async () => {
    await model.destroy({ where: {} });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await migration.down(sequelize.getQueryInterface());
    await sequelize.close();
  });

  it("records empty and repeated fresh fetches separately with stable source identity", async () => {
    for (let index = 0; index < 2; index += 1) {
      await execution.runSourceExecution(options, async () => [], { model });
    }
    const records = await model.findAll();
    expect(records).toHaveLength(2);
    expect(records[0].id).not.toBe(records[1].id);
    expect(records[0]).toMatchObject({ teamId: 7, sourceId: "stripe", status: "success", cacheHit: false });
    expect(records[0].finishedAt).toBeInstanceOf(Date);
  });

  it("requires a known cache miss and matching team before any source work", async () => {
    const operation = vi.fn();
    for (const cacheHit of [true, undefined, null]) {
      await expect(execution.runSourceExecution({ connection, cacheHit }, operation, { model })).rejects.toThrow("The data request could not start");
    }
    await expect(execution.withSourceExecutionContext({ teamId: 9 }, () => {
      return execution.runSourceExecution(options, operation, { model });
    })).rejects.toThrow("The data request could not start");
    expect(operation).not.toHaveBeenCalled();
    expect(await model.count()).toBe(0);
  });

  it("keeps activity and attribution separate across concurrent nested calls", async () => {
    await Promise.all(["mcp", "ai"].map((activity, index) => {
      return execution.withSourceExecutionContext({ activity, teamId: 7, chartId: index + 1 }, async () => {
        await Promise.resolve();
        return execution.withSourceExecutionContext({ activity: "api" }, () => {
          return execution.runSourceExecution(options, async () => [], { model });
        });
      });
    }));
    const records = await model.findAll({ order: [["chartId", "ASC"]] });
    expect(records.map((record) => [record.activity, record.chartId])).toEqual([["mcp", 1], ["ai", 2]]);
  });

  it("calls policy before I/O and outcome only after persistence", async () => {
    const order = [];
    const beforeSourceExecution = async (record) => {
      expect((await model.findByPk(record.id)).status).toBe("pending");
      order.push("before");
    };
    const afterSourceExecution = async (record) => {
      expect((await model.findByPk(record.id)).status).toBe("success");
      order.push("after");
    };
    await execution.runSourceExecution(options, async () => order.push("fetch"), {
      model, beforeSourceExecution, afterSourceExecution,
    });
    expect(order).toEqual(["before", "fetch", "after"]);
  });

  it("prevents source I/O when policy rejects or the start record cannot be stored", async () => {
    const operation = vi.fn();
    const afterSourceExecution = vi.fn();
    await expect(execution.runSourceExecution(options, operation, {
      model,
      beforeSourceExecution: async () => { throw new Error("Request refused"); },
      afterSourceExecution,
    })).rejects.toThrow("Request refused");
    expect(afterSourceExecution.mock.calls[0][0].status).toBe("failed");
    vi.spyOn(model, "create").mockRejectedValue(new Error("Database unavailable"));
    await expect(execution.runSourceExecution(options, operation, { model })).rejects.toThrow("Try again shortly");
    expect(operation).not.toHaveBeenCalled();
  });

  it("recovers a lost insert acknowledgement without a second source call", async () => {
    const create = model.create.bind(model);
    vi.spyOn(model, "create").mockImplementationOnce(async (record) => {
      await create(record);
      throw Object.assign(new Error("Connection lost"), { code: "ECONNRESET" });
    });
    const operation = vi.fn().mockResolvedValue([]);
    await execution.runSourceExecution(options, operation, { model });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(await model.count({ where: { status: "success" } })).toBe(1);
  });

  it("retries only terminal persistence after a lost acknowledgement", async () => {
    const update = model.update.bind(model);
    vi.spyOn(model, "update").mockImplementationOnce(async (...args) => {
      await update(...args);
      throw Object.assign(new Error("Connection lost"), { code: "ECONNRESET" });
    });
    const operation = vi.fn().mockResolvedValue([1]);
    expect(await execution.runSourceExecution(options, operation, { model })).toEqual([1]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(await model.count({ where: { status: "success" } })).toBe(1);
  });

  it("leaves an unconfirmed outcome pending and returns known source data", async () => {
    vi.spyOn(model, "update").mockRejectedValue(new Error("Database unavailable"));
    const afterSourceExecution = vi.fn();
    expect(await execution.runSourceExecution(options, async () => [1], { model, afterSourceExecution })).toEqual([1]);
    expect((await model.findOne()).status).toBe("pending");
    expect(afterSourceExecution).not.toHaveBeenCalled();
    expect((await execution.reportPendingExecutions({}, model)).count).toBe(1);
  });

  it("preserves success when the outcome callback fails", async () => {
    expect(await execution.runSourceExecution(options, async () => [1], {
      model,
      afterSourceExecution: async () => { throw new Error("Consumer unavailable"); },
    })).toEqual([1]);
    expect((await model.findOne()).status).toBe("success");
  });

  it("does not change a terminal outcome when completion conflicts", async () => {
    const afterSourceExecution = vi.fn();
    await execution.runSourceExecution(options, async () => {
      await model.update({ status: "failed", finishedAt: new Date() }, { where: { status: "pending" } });
      return [];
    }, { model, afterSourceExecution });
    expect((await model.findOne()).status).toBe("failed");
    expect(afterSourceExecution).not.toHaveBeenCalled();
  });

  it("records a fetch that completes after its caller times out", async () => {
    const { withExecutionDeadline } = require("../../modules/dataApiLimits");
    let complete;
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    const pending = execution.runSourceExecution(options, () => new Promise((resolve) => {
      complete = resolve;
      started();
    }), { model });
    await ready;
    await expect(withExecutionDeadline(() => pending, 5)).rejects.toThrow("execution time limit");
    expect((await model.findOne()).status).toBe("pending");
    complete([]);
    await pending;
    expect(await model.count({ where: { status: "success" } })).toBe(1);
  });

  it("counts only a successful attempt after two failures", async () => {
    for (let index = 0; index < 2; index += 1) {
      await expect(execution.runSourceExecution(options, async () => { throw new Error("Source failed"); }, { model })).rejects.toThrow("Source failed");
    }
    await execution.runSourceExecution(options, async () => [], { model });
    expect(await execution.countSuccessfulExecutions({ teamId: 7, from: "2020-01-01", to: "2100-01-01" }, model)).toBe(1);
    expect(await execution.countSuccessfulExecutions({ teamId: 8, from: "2020-01-01", to: "2100-01-01" }, model)).toBe(0);
  });

  it("uses completion time and excludes the end of a time range", async () => {
    await execution.runSourceExecution(options, async () => [], { model });
    const record = await model.findOne();
    await record.update({ finishedAt: new Date("2026-10-01T00:00:00Z") });
    expect(await execution.countSuccessfulExecutions({ teamId: 7, from: "2026-09-01", to: "2026-10-01" }, model)).toBe(0);
    expect(await execution.countSuccessfulExecutions({ teamId: 7, from: "2026-10-01", to: "2026-11-01" }, model)).toBe(1);
  });

  it("retains recent completions, expires old pending records, and supports bounded cleanup", async () => {
    for (let index = 0; index < 3; index += 1) await execution.runSourceExecution(options, async () => [], { model });
    const records = await model.findAll();
    await model.update({ startedAt: new Date("2024-01-01"), finishedAt: new Date("2024-01-02") }, { where: {} });
    await records[0].update({ finishedAt: new Date("2026-01-01") });
    await records[1].update({ status: "pending", finishedAt: null });
    const cleanup = { now: new Date("2026-09-30"), batchSize: 1 };
    const preview = await execution.cleanupSourceExecutions({ ...cleanup, dryRun: true }, model);
    expect(preview.matchedRecords).toBe(2);
    expect(preview.cutoff.toISOString()).toBe("2025-08-30T00:00:00.000Z");
    expect(await model.count()).toBe(3);
    expect((await execution.cleanupSourceExecutions({ ...cleanup, limit: 1 }, model)).deletedRecords).toBe(1);
    expect((await execution.cleanupSourceExecutions(cleanup, model)).deletedRecords).toBe(1);
    expect(await model.count()).toBe(1);
    const leap = await execution.cleanupSourceExecutions({ now: new Date("2025-03-31"), dryRun: true }, model);
    expect(leap.cutoff.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("does not select live audit runs for diagnostic cleanup", () => {
    const where = buildExpiredRunWhere(normalizeCleanupOptions({}));
    const { Op } = require("sequelize");
    const statuses = where[Op.or].flatMap((condition) => condition.status[Op.in]);
    expect(statuses).toContain("partial_failure");
    expect(statuses).not.toContain("running");
    expect(statuses).not.toContain("queued");
  });
});
