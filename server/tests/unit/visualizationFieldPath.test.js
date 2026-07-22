import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  FieldPathError,
  getFieldValue,
  parseFieldPath,
  selectRows,
} = require("../../visualization/fieldPath.js");

describe("visualization field paths", () => {
  it("selects root array rows and resolves nested values", () => {
    const rows = [{ metrics: { total: 10 } }, { metrics: { total: 15 } }];

    expect(selectRows(rows, ["root[].metrics.total"])).toBe(rows);
    expect(getFieldValue(rows[0], "root[].metrics.total")).toBe(10);
  });

  it("selects rows from a nested API response", () => {
    const response = { data: { items: [{ total: 8 }, { total: 13 }] } };
    const rows = selectRows(response, ["root.data.items[].total"]);

    expect(rows).toEqual([{ total: 8 }, { total: 13 }]);
    expect(parseFieldPath("root.data.items[].total")).toEqual({
      collectionPath: "data.items",
      isCollection: true,
      selector: "root.data.items[].total",
      valuePath: "total",
    });
  });

  it("wraps scalar objects as a single row", () => {
    const metric = { total: 21 };
    expect(selectRows(metric, ["root.total"])).toEqual([metric]);
    expect(getFieldValue(metric, "root.total")).toBe(21);
  });

  it("requires flattening when a selector traverses multiple array levels", () => {
    expect(() => parseFieldPath("root.groups[].items[].value")).toThrow(FieldPathError);
  });
});
