import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "module";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { reportThemes } from "../../../shared/reportAppearance.mjs";

const require = createRequire(import.meta.url);

describe("Report appearance and team presets", () => {
  let app;
  let db;
  const appearance = reportThemes[0].appearance;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
    app = await createTestApp();
    app.use("project", require("../../api/ProjectRoute")(app));
    app.use("reportTheme", require("../../api/ReportThemeRoute")(app));
  });

  async function fixture(role = "projectEditor") {
    const user = await db.User.create(userFactory.build());
    const team = await db.Team.create({ name: "Theme team" });
    const project = await db.Project.create({ name: "Report", team_id: team.id });
    const teamRole = await db.TeamRole.create({ team_id: team.id, user_id: user.id, role, projects: [project.id] });
    const token = generateTestToken({ id: user.id, email: user.email, name: user.name });
    return { user, team, project, teamRole, auth: `Bearer ${token}`, base: `/team/${team.id}/report-theme-presets` };
  }

  it("copies a preset to two reports and keeps both copies after preset updates and deletion", async () => {
    const f = await fixture();
    const second = await db.Project.create({ name: "Second", team_id: f.team.id });
    await f.teamRole.update({ projects: [f.project.id, second.id] });
    const created = await request(app).post(f.base).set("Authorization", f.auth).send({ name: " Brand ", appearance });
    expect(created.status).toBe(200);
    expect(created.body.name).toBe("Brand");
    for (const project of [f.project, second]) {
      const saved = await request(app).put(`/project/${project.id}/report-appearance`).set("Authorization", f.auth)
        .send({ appearance: created.body.appearance, revision: 0 });
      expect(saved.status).toBe(200);
      expect(saved.body.reportAppearanceRevision).toBe(1);
    }
    const updated = await request(app).put(`${f.base}/${created.body.id}`).set("Authorization", f.auth)
      .send({ appearance: reportThemes[2].appearance, revision: 0 });
    expect(updated.status).toBe(200);
    expect(updated.body.revision).toBe(1);
    const deleted = await request(app).delete(`${f.base}/${created.body.id}`).set("Authorization", f.auth).send({ revision: 1 });
    expect(deleted.status).toBe(200);
    expect((await f.project.reload()).reportAppearance).toEqual(appearance);
    expect((await second.reload()).reportAppearance).toEqual(appearance);
  });

  it("blocks other teams, restricted projects, viewers, and edits to another creator's preset", async () => {
    const f = await fixture();
    const other = await fixture();
    const preset = await db.ReportThemePreset.create({ team_id: f.team.id, created_by: other.user.id, name: "Shared", appearance });
    const project = await db.Project.create({ name: "Restricted", team_id: f.team.id });
    expect((await request(app).get(f.base).set("Authorization", other.auth)).status).toBe(403);
    expect((await request(app).put(`/project/${project.id}/report-appearance`).set("Authorization", f.auth)
      .send({ appearance, revision: 0 })).status).toBe(403);
    expect((await request(app).put(`${f.base}/${preset.id}`).set("Authorization", f.auth)
      .send({ name: "Changed", revision: 0 })).status).toBe(403);
    await f.teamRole.update({ role: "teamAdmin" });
    expect((await request(app).put(`${f.base}/${preset.id}`).set("Authorization", f.auth)
      .send({ name: "Changed", revision: 0 })).status).toBe(200);
    await f.teamRole.update({ role: "projectViewer" });
    expect((await request(app).get(f.base).set("Authorization", f.auth)).status).toBe(403);
    expect((await request(app).put(`/project/${f.project.id}/report-appearance`).set("Authorization", f.auth)
      .send({ appearance, revision: 0 })).status).toBe(403);
    expect((await request(app).get(f.base)).status).not.toBe(200);
  });

  it("rejects invalid appearance and stale writes, including concurrent saves", async () => {
    const f = await fixture();
    const path = `/project/${f.project.id}/report-appearance`;
    const invalid = await request(app).put(path).set("Authorization", f.auth).send({ appearance: null, revision: 0 });
    expect(invalid.status).toBe(400);
    const results = await Promise.all([0, 1].map(() => request(app).put(path).set("Authorization", f.auth).send({ appearance, revision: 0 })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const created = await request(app).post(f.base).set("Authorization", f.auth).send({ name: "Brand", appearance });
    await request(app).put(`${f.base}/${created.body.id}`).set("Authorization", f.auth).send({ name: "New", revision: 0 });
    const stale = await request(app).delete(`${f.base}/${created.body.id}`).set("Authorization", f.auth).send({ revision: 0 });
    expect(stale.status).toBe(409);
    expect(await db.ReportThemePreset.count({ where: { id: created.body.id } })).toBe(1);
    expect((await f.project.reload()).reportAppearanceRevision).toBe(1);
  });

  it("does not let the general update endpoint overwrite appearance or its revision", async () => {
    const f = await fixture();
    const response = await request(app).put(`/project/${f.project.id}`).set("Authorization", f.auth)
      .send({ reportAppearance: appearance, reportAppearanceRevision: 100 });
    expect(response.status).toBe(200);
    expect((await f.project.reload()).reportAppearance).toBeNull();
    expect(f.project.reportAppearanceRevision).toBe(0);
  });

  it("keeps JSON getters compatible with string-valued drivers", () => {
    const preset = db.ReportThemePreset.build({ name: "JSON", team_id: 1 });
    preset.setDataValue("appearance", JSON.stringify(appearance));
    expect(preset.appearance).toEqual(appearance);
    const project = db.Project.build({ team_id: 1 });
    project.setDataValue("reportAppearance", JSON.stringify(appearance));
    expect(project.reportAppearance).toEqual(appearance);
  });
});
