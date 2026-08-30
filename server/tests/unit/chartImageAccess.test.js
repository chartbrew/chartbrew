import { describe, expect, it, vi } from "vitest";

const {
  authorizeChartImage,
  canExportChartImage,
  parseResourceId,
} = require("../../modules/chartImage/imageAccess");

describe("chart image access", () => {
  it.each(["teamOwner", "teamAdmin"])("allows %s without project export flags", (role) => {
    expect(canExportChartImage({ canExport: false, projects: [], role }, 42)).toBe(true);
  });

  it.each(["projectAdmin", "projectEditor", "projectViewer"])(
    "allows %s only with project access and export permission",
    (role) => {
      expect(canExportChartImage({ canExport: true, projects: [42], role }, 42)).toBe(true);
      expect(canExportChartImage({ canExport: false, projects: [42], role }, 42)).toBe(false);
      expect(canExportChartImage({ canExport: true, projects: [41], role }, 42)).toBe(false);
    }
  );

  it("rejects unknown roles and invalid resource IDs", () => {
    expect(canExportChartImage({ canExport: true, projects: [42], role: "viewer" }, 42)).toBe(false);
    ["0", "-1", "1.2", "abc", Number.MAX_SAFE_INTEGER + 1].forEach((value) => {
      expect(() => parseResourceId(value)).toThrow(expect.objectContaining({
        code: "RESOURCE_NOT_FOUND",
      }));
    });
  });

  it("authorizes before returning the bounded worker access context", async () => {
    const db = {
      Chart: { findOne: vi.fn().mockResolvedValue({ id: 7, project_id: 5 }) },
      Project: { findOne: vi.fn().mockResolvedValue({ id: 5, team_id: 3 }) },
      TeamRole: {
        findOne: vi.fn().mockResolvedValue({
          canExport: true,
          id: 11,
          projects: [5],
          role: "projectViewer",
        }),
      },
    };
    await expect(authorizeChartImage({ chartId: "7", projectId: "5", userId: 2 }, { db }))
      .resolves.toEqual({
        chartId: 7,
        projectId: 5,
        teamId: 3,
        userId: 2,
      });
  });

  it("does not load the chart when export access is denied", async () => {
    const db = {
      Chart: { findOne: vi.fn() },
      Project: { findOne: vi.fn().mockResolvedValue({ id: 5, team_id: 3 }) },
      TeamRole: {
        findOne: vi.fn().mockResolvedValue({
          canExport: false,
          projects: [5],
          role: "projectViewer",
        }),
      },
    };
    await expect(authorizeChartImage({ chartId: 7, projectId: 5, userId: 2 }, { db }))
      .rejects.toMatchObject({ code: "IMAGE_EXPORT_FORBIDDEN" });
    expect(db.Chart.findOne).not.toHaveBeenCalled();
  });

  it("requires the chart and project relationship", async () => {
    const db = {
      Chart: { findOne: vi.fn().mockResolvedValue(null) },
      Project: { findOne: vi.fn().mockResolvedValue({ id: 5, team_id: 3 }) },
      TeamRole: {
        findOne: vi.fn().mockResolvedValue({ id: 11, role: "teamOwner" }),
      },
    };
    await expect(authorizeChartImage({ chartId: 7, projectId: 5, userId: 2 }, { db }))
      .rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
