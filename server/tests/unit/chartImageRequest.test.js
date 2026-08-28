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
        dateRange: false,
        lastUpdated: false,
        logo: true,
        subtitle: { show: false, text: "" },
        title: { show: true, text: null },
      },
      height: 720,
      layout: "shareCard",
      locale: "en-US",
      size: { height: 720, preset: "landscape", width: 1280 },
      theme: "light",
      version: 1,
      width: 1280,
    });
  });

  it("normalizes each size preset", () => {
    expect(normalizeImageRequest(request({ size: { preset: "mobile" } })))
      .toMatchObject({ height: 2340, width: 1080 });
    expect(normalizeImageRequest(request({
      size: { preset: "original", sourceHeight: 200, sourceWidth: 400 },
    }))).toMatchObject({ height: 480, width: 960 });
  });

  it("accepts a gradient canvas background", () => {
    expect(normalizeImageRequest(request({
      background: { from: "#103751", mode: "gradient", to: "#1A7FA0" },
    }))).toMatchObject({
      background: { from: "#103751", mode: "gradient", to: "#1A7FA0" },
    });
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
    request({ background: { from: "#103751", mode: "gradient" } }),
    request({ background: { color: "#ffffff", mode: "gradient", from: "#103751", to: "#1A7FA0" } }),
    request({ size: { preset: "landscape", sourceHeight: 100, sourceWidth: 100 } }),
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
