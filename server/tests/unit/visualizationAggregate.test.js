import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { aggregateRows } = require("../../visualization/aggregate.js");

describe("visualization aggregation", () => {
  it("computes every supported aggregation in one grouped pass", () => {
    const rows = [
      {
        category: "A",
        sumValue: 2,
        avgValue: 2,
        minValue: 2,
        maxValue: 2,
        countValue: "x",
        uniqueValue: "x",
        lastValue: 2,
      },
      {
        category: "A",
        sumValue: "4",
        avgValue: "4",
        minValue: "4",
        maxValue: "4",
        countValue: "y",
        uniqueValue: "x",
        lastValue: 4,
      },
      {
        category: "A",
        sumValue: null,
        avgValue: null,
        minValue: null,
        maxValue: null,
        countValue: null,
        uniqueValue: "y",
        lastValue: null,
      },
    ];

    const result = aggregateRows(rows, ["category"], {
      sumValue: { aggregate: "sum" },
      avgValue: { aggregate: "avg" },
      minValue: { aggregate: "min" },
      maxValue: { aggregate: "max" },
      countValue: { aggregate: "count" },
      uniqueValue: { aggregate: "count_unique" },
      lastValue: { aggregate: "none" },
    });

    expect(result).toEqual([{
      category: "A",
      __sourceRowCount: 3,
      sumValue: 6,
      avgValue: 3,
      minValue: 2,
      maxValue: 4,
      countValue: 2,
      uniqueValue: 2,
      lastValue: 4,
    }]);
  });

  it("keeps numeric and string dimension identities separate", () => {
    const result = aggregateRows([
      { category: 1, value: 2 },
      { category: "1", value: 3 },
    ], ["category"], { value: { aggregate: "sum" } });

    expect(result).toHaveLength(2);
    expect(result.map((row) => row.category)).toEqual([1, "1"]);
  });
});
