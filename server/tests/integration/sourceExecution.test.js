import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

import { userFactory } from "../factories/userFactory.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);
const execution = require("../../modules/sourceExecution");
const migration = require("../../models/migrations/20261001090000-create-source-execution");
const dateIndexMigration = require("../../models/migrations/20261001100000-index-source-execution-finished");
const { Sequelize } = require("sequelize");
const connection = { id: 123, team_id: 7, type: "api" };
const options = { connection, cacheHit: false };
let db;

describe("source execution storage", () => {
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => vi.restoreAllMocks());

  it("recovers a committed insert with millisecond timestamps after a lost acknowledgement", async () => {
    const create = db.SourceExecution.create.bind(db.SourceExecution);
    vi.spyOn(db.SourceExecution, "create").mockImplementationOnce(async (record) => {
      await create(record);
      throw Object.assign(new Error("Acknowledgement lost"), { code: "ECONNRESET" });
    });
    const source = vi.fn().mockResolvedValue([]);
    await execution.runSourceExecution(options, source);
    expect(source).toHaveBeenCalledTimes(1);
    expect(await execution.countSuccessfulExecutions({ teamId: 7, from: "2020-01-01", to: "2100-01-01" })).toBe(1);
    expect(await execution.countSuccessfulExecutions({ teamId: 8, from: "2020-01-01", to: "2100-01-01" })).toBe(0);
  });

  it("stores historical references without foreign keys and supports bounded retention", async () => {
    await execution.withSourceExecutionContext({ projectId: 21, chartId: 22, datasetId: 23, dataRequestId: 24, runId: 25 }, () => {
      return execution.runSourceExecution(options, async () => []);
    });
    const query = db.sequelize.getQueryInterface();
    expect(await query.getForeignKeyReferencesForTable("SourceExecution")).toEqual([]);
    const indexes = await query.showIndex("SourceExecution");
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "source_execution_team_status_finished", "source_execution_started",
    ]));
    const record = await db.SourceExecution.findOne();
    expect(record).toMatchObject({ projectId: 21, chartId: 22, datasetId: 23, dataRequestId: 24, runId: 25 });
    await record.update({ startedAt: new Date("2020-01-01"), finishedAt: new Date("2020-01-02") });
    expect((await execution.cleanupSourceExecutions({ dryRun: true })).matchedRecords).toBe(1);
    expect(await db.SourceExecution.count()).toBe(1);
    expect((await execution.cleanupSourceExecutions({ limit: 1, batchSize: 1 })).deletedRecords).toBe(1);
    expect((await execution.reportPendingExecutions()).count).toBe(0);
  });

  it("keeps compact evidence when diagnostic history expires and preserves active runs", async () => {
    const audit = require("../../modules/updateAudit");
    const runs = [];
    for (const [status, days] of [["success", 40], ["partial_failure", 40], ["partial_failure", 100], ["running", 100], ["queued", 100]]) {
      const trace = await audit.startRun({ triggerType: "chart_manual", entityType: "chart", teamId: 7, status });
      await db.UpdateRun.update({ startedAt: new Date(Date.now() - days * 86400000) }, { where: { id: trace.runId } });
      runs.push(trace);
    }
    await execution.runSourceExecution({ ...options, auditContext: { traceContext: runs[0] } }, async () => []);
    await audit.cleanupExpiredRuns({});
    expect(await db.UpdateRun.findByPk(runs[0].runId)).toBeNull();
    expect(await db.UpdateRun.findByPk(runs[2].runId)).toBeNull();
    expect(await db.UpdateRun.count()).toBe(3);
    expect((await db.SourceExecution.findOne()).runId).toBe(runs[0].runId);
  });

  it("removes records with a team, while deletion of a shared-team member preserves them", async () => {
    const TeamController = require("../../controllers/TeamController");
    const UserController = require("../../controllers/UserController");
    const runtimeCache = require("../../modules/runtimeCache");
    vi.spyOn(runtimeCache, "clearPendingAiActions").mockResolvedValue(undefined);
    const owner = await db.User.create(userFactory.build());
    const member = await db.User.create(userFactory.build());
    const first = await db.Team.create({ name: "First" });
    const second = await db.Team.create({ name: "Second" });
    await db.TeamRole.bulkCreate([
      { team_id: first.id, user_id: owner.id, role: "teamOwner" },
      { team_id: second.id, user_id: owner.id, role: "teamOwner" },
      { team_id: second.id, user_id: member.id, role: "teamViewer" },
    ]);
    for (const team of [first, second]) {
      await execution.runSourceExecution({ connection: { ...connection, team_id: team.id }, cacheHit: false }, async () => []);
    }
    await new TeamController().deleteTeam(first.id, owner.id);
    expect(await db.SourceExecution.count()).toBe(1);
    await new UserController().deleteUser(member.id);
    expect(await db.SourceExecution.count({ where: { teamId: second.id } })).toBe(1);
    await new UserController().deleteUser(owner.id);
    expect(await db.SourceExecution.count()).toBe(0);
  });

  it("can roll back and apply the table migration", async () => {
    const query = db.sequelize.getQueryInterface();
    await migration.down(query);
    await migration.up(query, Sequelize);
    await dateIndexMigration.up(query);
    await execution.runSourceExecution(options, async () => []);
    expect(await db.SourceExecution.count({ where: { status: "success", cacheHit: false } })).toBe(1);
  });
});
