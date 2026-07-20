import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { remapVisualizationBindings } = require("../../visualization/remapBindings.js");

describe("visualization binding remapping", () => {
  it("replaces template binding IDs while preserving shared value layers", () => {
    const visualization = {
      version: 2,
      layers: [
        { id: "revenue", bindingId: "orders", mark: "bar", encoding: {} },
        { id: "cost", bindingId: "orders", mark: "bar", encoding: {} },
        { id: "users", bindingId: "customers", mark: "line", encoding: {} },
      ],
    };
    const next = remapVisualizationBindings(
      visualization,
      [{ templateBindingId: "orders" }, { templateBindingId: "customers" }],
      [{ id: 101 }, { id: 202 }]
    );

    expect(next.layers.map((layer) => layer.bindingId)).toEqual([101, 101, 202]);
    expect(visualization.layers[0].bindingId).toBe("orders");
  });

  it("falls back to binding order for older templates without binding metadata", () => {
    const next = remapVisualizationBindings({
      version: 2,
      layers: [
        { id: "first", bindingId: 50, mark: "bar", encoding: {} },
        { id: "second", bindingId: 60, mark: "bar", encoding: {} },
      ],
    }, [{}, {}], [{ id: 501 }, { id: 601 }]);

    expect(next.layers.map((layer) => layer.bindingId)).toEqual([501, 601]);
  });
});
