import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyValueFormula,
  evaluateValueFormula,
  parseValueFormula,
} = require("../../visualization/valueFormula.js");

const LOCAL_FORMULAS = [
  "${ROUND(val/1000, 0)}k",
  "${val / 100}",
  "${val/100}",
  "${val}",
  "{ROUND(val * 100, 0)}%",
  "{ROUND(val / 100, 2)}",
  "{ROUND(val*100, 0)}%",
  "{val * 100}%",
  "{val * 2}",
  "{val / 1000}",
  "{val / 1000}k",
  "{val / 100}",
  "{val}%",
  "{val}s",
];

describe("visualization value formulas", () => {
  it("parses calculation separately from presentation", () => {
    expect(parseValueFormula("${ROUND(val/1000, 0)}k")).toEqual({
      expression: "ROUND(val/1000, 0)",
      prefix: "$",
      suffix: "k",
    });
  });

  it("evaluates all formula shapes found in the local migration corpus", () => {
    LOCAL_FORMULAS.forEach((formula) => {
      const result = evaluateValueFormula(1234, formula);
      expect(result.numericValue).not.toBeNull();
      expect(result.formattedValue).toContain(result.prefix);
      expect(result.formattedValue).toContain(result.suffix);
    });
  });

  it("keeps formatting for value visualizations and numbers for charts", () => {
    expect(applyValueFormula(1234, "${val / 100}", { formatted: true })).toBe("$12.34");
    expect(applyValueFormula(1234, "${val / 100}")).toBe(12.34);
    expect(applyValueFormula(2, "{val * 100}%", { formatted: true })).toBe("200%");
  });
});
