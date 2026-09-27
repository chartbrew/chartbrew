import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { reportThemes } from "../../../shared/reportAppearance.mjs";

const db = require("../../models/models");
const { saveReportAppearance, createPreset, changePreset } = require("../../modules/reportAppearance");

describe("report appearance writes", () => {
  afterEach(() => vi.restoreAllMocks());
  const appearance = reportThemes[0].appearance;

  it("registers the preset routes through the server startup contract", () => {
    const app = express();
    const register = require("../../api/ReportThemeRoute");
    const middleware = register(app);
    expect(() => app.use("reportTheme", middleware)).not.toThrow();
    const next = vi.fn();
    middleware({}, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("validates colors and uses an atomic revision comparison", async () => {
    const update = vi.spyOn(db.Project, "update").mockResolvedValue([1]);
    await expect(saveReportAppearance(12, { appearance: null, revision: 0 })).rejects.toMatchObject({ statusCode: 400 });
    expect(update).not.toHaveBeenCalled();
    const saved = await saveReportAppearance(12, { appearance, revision: 3 });
    expect(update).toHaveBeenCalledWith({ reportAppearance: appearance, reportAppearanceRevision: 4 },
      { where: { id: 12, reportAppearanceRevision: 3 } });
    expect(saved.reportAppearanceRevision).toBe(4);
    update.mockResolvedValue([0]);
    await expect(saveReportAppearance(12, { appearance, revision: 3 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects unsupported fields, invalid revisions, and oversized names", async () => {
    const create = vi.spyOn(db.ReportThemePreset, "create").mockResolvedValue({ id: 1 });
    await expect(createPreset(1, 2, { name: "x", appearance, team_id: 3 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(createPreset(1, 2, { name: " ", appearance })).rejects.toMatchObject({ statusCode: 400 });
    await expect(createPreset(1, 2, { name: "x".repeat(81), appearance })).rejects.toMatchObject({ statusCode: 400 });
    await expect(saveReportAppearance(1, { appearance, revision: "0" })).rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
    await createPreset(1, 2, { name: " Brand ", appearance });
    expect(create).toHaveBeenCalledWith({ name: "Brand", appearance, team_id: 1, created_by: 2 });
  });

  it("updates only preset fields and refuses stale deletes", async () => {
    const preset = db.ReportThemePreset.build({ id: 1, team_id: 2, created_by: 3, name: "Brand", appearance, revision: 4 });
    const update = vi.spyOn(db.ReportThemePreset, "update").mockResolvedValue([1]);
    const remove = vi.spyOn(db.ReportThemePreset, "destroy").mockResolvedValue(0);
    const projectUpdate = vi.spyOn(db.Project, "update");
    const saved = await changePreset(preset, { name: "New", revision: 4 });
    expect(saved.name).toBe("New");
    expect(update).toHaveBeenCalledWith({ name: "New", revision: 5 }, { where: { id: 1, team_id: 2, revision: 4 } });
    await expect(changePreset(preset, { revision: 4 }, true)).rejects.toMatchObject({ statusCode: 409 });
    expect(remove).toHaveBeenCalledWith({ where: { id: 1, team_id: 2, revision: 4 } });
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});
