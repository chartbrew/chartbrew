import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  getDatasetDisplayName,
  normalizeDatasetIdentityPayload,
} = require("../../modules/datasetIdentity.js");

describe("datasetIdentity", () => {
  it("prefers dataset.name when building a display label", () => {
    expect(getDatasetDisplayName({ name: "Orders", legend: "Legacy Orders" })).toBe("Orders");
    expect(getDatasetDisplayName({ legend: "Legacy Orders" })).toBe("Legacy Orders");
  });

  it("keeps name and legend synchronized in normalized payloads", () => {
    expect(normalizeDatasetIdentityPayload({ name: "Orders" })).toEqual({
      name: "Orders",
      legend: "Orders",
    });

    expect(normalizeDatasetIdentityPayload({ legend: "Revenue" })).toEqual({
      name: "Revenue",
      legend: "Revenue",
    });

    expect(normalizeDatasetIdentityPayload({ name: "MRR", legend: "Old Legend" })).toEqual({
      name: "MRR",
      legend: "MRR",
    });
  });
});
