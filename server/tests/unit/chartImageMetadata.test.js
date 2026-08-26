import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const {
  formatDateRange,
  formatLastUpdated,
  getImagePreset,
  getLogoFileName,
  isSafeRasterLogoBuffer,
  loadChartImageDocument,
  resolveBranding,
} = require("../../modules/chartImage/imageMetadata");
const { normalizeImageRequest } = require("../../modules/chartImage/imageRequest");

function record(value) {
  return { toJSON: () => value };
}

function preparedData(mark = "line") {
  return {
    generatedAt: "2026-08-24T03:30:00.000Z",
    results: [{ mark, rows: [] }],
  };
}

function dependencies(overrides = {}) {
  const chart = {
    id: 7,
    name: "Trusted chart",
    project_id: 5,
    type: "line",
    visualization: { layers: [], settings: {}, status: "ready", version: 2 },
  };
  return {
    buildChartFingerprints: vi.fn().mockResolvedValue({ visualization: "visual-1" }),
    db: {
      Chart: { unscoped: () => ({ findOne: vi.fn().mockResolvedValue(record(chart)) }) },
      Project: {
        findOne: vi.fn().mockResolvedValue(record({
          dashboardTitle: "Trusted dashboard",
          id: 5,
          logo: "uploads/logo.png",
          name: "Project",
          team_id: 3,
          timezone: "Asia/Bangkok",
        })),
      },
      Team: {
        findOne: vi.fn().mockResolvedValue(record({
          id: 3,
          name: "Trusted team",
          showBranding: true,
        })),
      },
    },
    loadPreparedSnapshot: vi.fn().mockResolvedValue({
      preparedData: preparedData(),
      updatedAt: "2026-08-24T03:30:00.000Z",
      visualizationFingerprint: "visual-1",
    }),
    loadProjectLogoDataUri: vi.fn().mockResolvedValue("data:image/png;base64,logo"),
    ...overrides,
  };
}

const access = { chartId: 7, projectId: 5, teamId: 3, userId: 2 };

describe("chart image metadata", () => {
  it("loads only trusted names, metadata, branding, and a matching snapshot", async () => {
    const deps = dependencies();
    const result = await loadChartImageDocument(
      access,
      normalizeImageRequest({ version: 1 }),
      deps
    );
    expect(result.document).toMatchObject({
      content: {
        branding: "chartbrew",
        title: { show: true, text: "Trusted chart" },
      },
      metadata: {
        companyName: "Trusted team",
        dashboardName: "Trusted dashboard",
        lastUpdated: expect.stringContaining("Aug 24, 2026"),
        logoDataUri: "data:image/png;base64,logo",
      },
      preparedData: preparedData(),
      renderContext: { timezone: "Asia/Bangkok" },
    });
    expect(deps.loadProjectLogoDataUri).toHaveBeenCalledWith("uploads/logo.png");
  });

  it("omits an unavailable configured logo with a bounded operational code", async () => {
    const deps = dependencies({ loadProjectLogoDataUri: vi.fn().mockResolvedValue(null) });
    const result = await loadChartImageDocument(
      access,
      normalizeImageRequest({ version: 1 }),
      deps
    );
    expect(result.document.metadata.logoDataUri).toBeNull();
    expect(result.operationalCodes).toEqual(["LOGO_UNAVAILABLE"]);
  });

  it("does not load a logo when it is hidden or the layout is chart-only", async () => {
    const deps = dependencies();
    await loadChartImageDocument(
      access,
      normalizeImageRequest({ content: { logo: false }, version: 1 }),
      deps
    );
    expect(deps.loadProjectLogoDataUri).not.toHaveBeenCalled();
  });

  it("rejects stale and missing prepared snapshots", async () => {
    const stale = dependencies({
      buildChartFingerprints: vi.fn().mockResolvedValue({ visualization: "visual-2" }),
    });
    await expect(loadChartImageDocument(
      access,
      normalizeImageRequest({ version: 1 }),
      stale
    )).rejects.toMatchObject({ code: "IMAGE_DATA_UNAVAILABLE" });
    expect(stale.loadProjectLogoDataUri).not.toHaveBeenCalled();

    const missing = dependencies({ loadPreparedSnapshot: vi.fn().mockResolvedValue(null) });
    await expect(loadChartImageDocument(
      access,
      normalizeImageRequest({ version: 1 }),
      missing
    )).rejects.toMatchObject({ code: "IMAGE_DATA_UNAVAILABLE" });
  });

  it("rejects unsupported chart presets", () => {
    expect(() => getImagePreset(preparedData("table"))).toThrow(expect.objectContaining({
      code: "IMAGE_PRESET_UNSUPPORTED",
    }));
    expect(() => getImagePreset({ results: [{ mark: "line" }, { mark: "bar" }] }))
      .toThrow(expect.objectContaining({ code: "IMAGE_PRESET_UNSUPPORTED" }));
  });

  it("enforces the team branding authority", () => {
    expect(resolveBranding(null, true)).toBe("chartbrew");
    expect(resolveBranding(null, false)).toBe("whiteLabel");
    expect(resolveBranding("chartbrew", false)).toBe("chartbrew");
    expect(() => resolveBranding("whiteLabel", true)).toThrow(expect.objectContaining({
      code: "INVALID_IMAGE_OPTIONS",
    }));
  });

  it("accepts only flat local upload names", () => {
    expect(getLogoFileName("uploads/logo.png")).toBe("logo.png");
    expect(getLogoFileName("/uploads/logo.png")).toBe("logo.png");
    expect(getLogoFileName("uploads/nested/logo.png")).toBeNull();
    expect(getLogoFileName("https://example.com/logo.png")).toBeNull();
  });

  it("rejects raster logos with excessive decoded dimensions", async () => {
    const safe = await sharp({
      create: { background: "#ffffff", channels: 4, height: 10, width: 10 },
    }).png().toBuffer();
    const tooWide = await sharp({
      create: { background: "#ffffff", channels: 4, height: 1, width: 5000 },
    }).png().toBuffer();
    await expect(isSafeRasterLogoBuffer(safe)).resolves.toBe(true);
    await expect(isSafeRasterLogoBuffer(tooWide)).resolves.toBe(false);
    await expect(isSafeRasterLogoBuffer(Buffer.from("not an image"))).resolves.toBe(false);
  });

  it("formats absolute dates with the selected locale and timezone", () => {
    expect(formatDateRange(
      "2026-08-23T17:00:00.000Z",
      "2026-08-24T17:00:00.000Z",
      "en-US",
      "Asia/Bangkok"
    )).toContain("Aug 24");
    expect(formatLastUpdated(
      "2026-08-24T03:30:00.000Z",
      "en-US",
      "Asia/Bangkok"
    )).toContain("Updated Aug 24, 2026");
  });
});
