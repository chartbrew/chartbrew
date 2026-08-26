import { describe, expect, it } from "vitest";

const { normalizeImageRequest } = require("../../modules/chartImage/imageRequest");

function request(overrides = {}) {
  return { version: 1, ...overrides };
}

describe("chart image request", () => {
  it("uses the fixed safe defaults", () => {
    expect(normalizeImageRequest(request())).toEqual({
      background: { mode: "default" },
      content: {
        branding: null,
        companyName: true,
        dashboardName: true,
        dateRange: true,
        lastUpdated: true,
        logo: true,
        subtitle: { show: false, text: "" },
        title: { show: true, text: null },
      },
      height: 630,
      layout: "shareCard",
      locale: "en-US",
      size: { height: 630, preset: "social", width: 1200 },
      theme: "light",
      version: 1,
      width: 1200,
    });
  });

  it("normalizes each size preset", () => {
    expect(normalizeImageRequest(request({ size: { preset: "square" } })))
      .toMatchObject({ height: 1080, width: 1080 });
    expect(normalizeImageRequest(request({
      size: { preset: "original", sourceHeight: 200, sourceWidth: 400 },
    }))).toMatchObject({ height: 480, width: 960 });
  });

  it("accepts bounded options and canonicalizes the locale", () => {
    expect(normalizeImageRequest(request({
      background: { color: "#123ABC", mode: "custom" },
      content: {
        branding: "whiteLabel",
        companyName: false,
        dashboardName: false,
        dateRange: false,
        lastUpdated: false,
        logo: false,
        subtitle: { show: true, text: "Context" },
        title: { show: false, text: "Custom" },
      },
      layout: "chartOnly",
      locale: "en-us",
      theme: "dark",
    }))).toMatchObject({
      background: { color: "#123ABC", mode: "custom" },
      layout: "chartOnly",
      locale: "en-US",
      theme: "dark",
    });
  });

  it.each([
    {},
    { version: 2 },
    request({ extra: true }),
    request({ layout: "other" }),
    request({ theme: "current" }),
    request({ locale: "not a locale" }),
    request({ background: { color: "#fff", mode: "custom" } }),
    request({ background: { color: "#ffffff", mode: "default" } }),
    request({ size: { preset: "social", sourceHeight: 100, sourceWidth: 100 } }),
    request({ size: { preset: "original", sourceHeight: 0, sourceWidth: 100 } }),
    request({ size: { preset: "original", sourceHeight: 10_001, sourceWidth: 1 } }),
    request({ size: { preset: "original", sourceHeight: 10_000, sourceWidth: 10_000 } }),
    request({ content: { logo: "yes" } }),
    request({ content: { branding: "custom" } }),
  ])("rejects an invalid contract: %j", (value) => {
    expect(() => normalizeImageRequest(value)).toThrow(expect.objectContaining({
      code: "INVALID_IMAGE_OPTIONS",
    }));
  });

  it("rejects forbidden keys at every accepted object level", () => {
    const root = JSON.parse("{\"version\":1,\"__proto__\":{}}");
    const nested = JSON.parse("{\"version\":1,\"content\":{\"constructor\":{}}}");
    expect(() => normalizeImageRequest(root)).toThrow(expect.objectContaining({
      code: "INVALID_IMAGE_OPTIONS",
    }));
    expect(() => normalizeImageRequest(nested)).toThrow(expect.objectContaining({
      code: "INVALID_IMAGE_OPTIONS",
    }));
  });

  it("rejects text above the fixed limits", () => {
    expect(() => normalizeImageRequest(request({
      content: { title: { show: true, text: "x".repeat(161) } },
    }))).toThrow(expect.objectContaining({ code: "INVALID_IMAGE_OPTIONS" }));
    expect(() => normalizeImageRequest(request({
      content: { subtitle: { show: true, text: "x".repeat(241) } },
    }))).toThrow(expect.objectContaining({ code: "INVALID_IMAGE_OPTIONS" }));
  });
});
