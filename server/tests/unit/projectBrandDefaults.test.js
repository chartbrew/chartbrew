import {
  afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const db = require("../../models/models");
const {
  applyTeamBrandDefaults,
  applyTeamBrandDefaultsToExistingProjects,
  getTeamBrandDefaults,
} = require("../../modules/teamOnboarding/projectBrandDefaults");

describe("team project brand defaults", () => {
  let uploadDirectory;

  beforeEach(async () => {
    uploadDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "chartbrew-team-logo-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.promises.rm(uploadDirectory, { force: true, recursive: true });
  });

  it("creates a safe shared logo path and website default", async () => {
    const logoData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.spyOn(db.TeamBusinessProfile, "findOne").mockResolvedValue({
      logoData,
      logoMimeType: "image/png",
      websiteUrl: "https://example.com/",
    });

    const defaults = await getTeamBrandDefaults(42, { uploadDirectory });

    expect(defaults).toEqual({
      logo: expect.stringMatching(/^uploads\/team-logo-42-[a-f0-9]{20}\.png$/),
      logoLink: "https://example.com/",
    });
    const fileName = defaults.logo.replace("uploads/", "");
    expect(await fs.promises.readFile(path.join(uploadDirectory, fileName))).toEqual(logoData);
  });

  it("keeps explicit dashboard branding overrides", async () => {
    vi.spyOn(db.TeamBusinessProfile, "findOne").mockResolvedValue({
      logoData: null,
      logoMimeType: null,
      websiteUrl: "https://example.com/",
    });

    const data = await applyTeamBrandDefaults({
      logo: "uploads/custom.png",
      logoLink: "https://custom.example/",
      name: "Sales",
      team_id: 42,
    }, { uploadDirectory });

    expect(data.logo).toBe("uploads/custom.png");
    expect(data.logoLink).toBe("https://custom.example/");
  });

  it("only fills empty branding on existing dashboards", async () => {
    vi.spyOn(db.TeamBusinessProfile, "findOne").mockResolvedValue({
      logoData: null,
      logoMimeType: null,
      websiteUrl: "https://example.com/",
    });
    const update = vi.spyOn(db.Project, "update").mockResolvedValue([1]);

    await applyTeamBrandDefaultsToExistingProjects(42, { uploadDirectory });

    expect(update).toHaveBeenCalledWith(
      { logoLink: "https://example.com/" },
      { transaction: undefined, where: { logoLink: null, team_id: 42 } }
    );
  });
});
