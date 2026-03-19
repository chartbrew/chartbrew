import { describe, expect, it } from "vitest";

const {
  getAllSearchParams,
  getPublicChartRuntimeVariables,
} = await import(new URL("../../../client/src/modules/publicChartRuntime.js", import.meta.url));

describe("publicChartRuntime", () => {
  it("returns all search params as a flat object", () => {
    const searchParams = new URLSearchParams([
      ["token", "share_token"],
      ["theme", "dark"],
      ["region", "emea"],
      ["fields[status]", "paid"],
    ]);

    expect(getAllSearchParams(searchParams)).toEqual({
      token: "share_token",
      theme: "dark",
      region: "emea",
      "fields[status]": "paid",
    });
  });

  it("filters out share-specific params when building runtime variables", () => {
    const searchParams = new URLSearchParams([
      ["token", "share_token"],
      ["theme", "dark"],
      ["isSnapshot", "true"],
      ["snapshot", "true"],
      ["pass", "secret"],
      ["password", "secret"],
      ["accessToken", "viewer_token"],
      ["region", "emea"],
      ["team", "sales"],
    ]);

    expect(getPublicChartRuntimeVariables(searchParams)).toEqual({
      region: "emea",
      team: "sales",
    });
  });
});
