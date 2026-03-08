import {
  beforeAll, beforeEach, describe, expect, it,
} from "vitest";
import { createRequire } from "module";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("Update Run read path", () => {
  let models;
  let updateRunController;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    models = await getModels();
    const UpdateRunController = require("../../controllers/UpdateRunController.js");
    updateRunController = new UpdateRunController();
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
  });

  it("filters runs by accessible projects and returns detail with children/events", async () => {
    const team = await models.Team.create({
      name: "Audit Team",
    });

    const accessibleProject = await models.Project.create({
      name: "Accessible Dashboard",
      brewName: "accessible-dashboard",
      team_id: team.id,
    });

    const inaccessibleProject = await models.Project.create({
      name: "Restricted Dashboard",
      brewName: "restricted-dashboard",
      team_id: team.id,
    });

    const accessibleRootRun = await models.UpdateRun.create({
      traceId: "trace-accessible-root",
      rootTraceId: "trace-accessible-root",
      parentRunId: null,
      triggerType: "chart_manual",
      entityType: "chart",
      teamId: team.id,
      projectId: accessibleProject.id,
      chartId: 900,
      status: "success",
      startedAt: new Date(),
    });

    await models.UpdateRunEvent.create({
      runId: accessibleRootRun.id,
      sequence: 1,
      stage: "chart_loaded",
      status: "success",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 10,
      payload: { chartId: 900 },
    });

    const accessibleChildRun = await models.UpdateRun.create({
      traceId: "trace-accessible-child",
      rootTraceId: "trace-accessible-root",
      parentRunId: accessibleRootRun.id,
      triggerType: "chart_manual",
      entityType: "dataset_request",
      teamId: team.id,
      projectId: accessibleProject.id,
      chartId: 900,
      datasetId: 501,
      dataRequestId: 601,
      connectionId: 701,
      status: "success",
      startedAt: new Date(),
    });

    const inaccessibleRun = await models.UpdateRun.create({
      traceId: "trace-inaccessible-root",
      rootTraceId: "trace-inaccessible-root",
      parentRunId: null,
      triggerType: "chart_manual",
      entityType: "chart",
      teamId: team.id,
      projectId: inaccessibleProject.id,
      chartId: 901,
      status: "success",
      startedAt: new Date(),
    });

    const listRuns = await updateRunController.findByTeam(
      team.id,
      {},
      [accessibleProject.id]
    );

    expect(listRuns.map((run) => run.id)).toEqual(
      expect.arrayContaining([accessibleRootRun.id, accessibleChildRun.id])
    );
    expect(listRuns.map((run) => run.id)).not.toContain(inaccessibleRun.id);

    const filteredRuns = await updateRunController.findByTeam(
      team.id,
      { dataset_id: 501 },
      [accessibleProject.id]
    );

    expect(filteredRuns).toHaveLength(1);
    expect(filteredRuns[0].id).toBe(accessibleChildRun.id);

    const detailRun = await updateRunController.findByIdAndTeam(
      accessibleRootRun.id,
      team.id,
      [accessibleProject.id]
    );

    expect(detailRun.id).toBe(accessibleRootRun.id);
    expect(detailRun.events).toHaveLength(1);
    expect(detailRun.childRuns).toHaveLength(1);
    expect(detailRun.childRuns[0].id).toBe(accessibleChildRun.id);

    const missingRun = await updateRunController.findByIdAndTeam(
      inaccessibleRun.id,
      team.id,
      [accessibleProject.id]
    );

    expect(missingRun).toBeNull();
  });
});
