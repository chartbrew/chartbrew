import { describe, expect, it, vi } from "vitest";

const { recordChartImageEvent } = require("../../modules/chartImage/imageObservability");

describe("chart image observability", () => {
  it("records only the bounded operational allowlist", () => {
    const logger = vi.fn();
    recordChartImageEvent({
      chartId: 7,
      data: [{ secret: true }],
      durationMs: 12.4,
      height: 630,
      layout: "shareCard",
      logoDataUri: "private-logo",
      operationalCodes: ["LOGO_UNAVAILABLE", "one", "two", "three", "truncated"],
      outputBytes: 1234,
      preset: "line",
      projectId: 5,
      requestBody: { title: "Private title" },
      requestId: "request-1",
      success: true,
      teamId: 3,
      title: "Private title",
      userId: 2,
      width: 1200,
    }, logger);
    expect(logger).toHaveBeenCalledWith({
      chartId: 7,
      durationMs: 12,
      errorCode: null,
      height: 630,
      layout: "shareCard",
      operationalCodes: ["LOGO_UNAVAILABLE", "one", "two", "three"],
      outputBytes: 1234,
      preset: "line",
      projectId: 5,
      requestId: "request-1",
      success: true,
      teamId: 3,
      userId: 2,
      width: 1200,
    });
  });
});
