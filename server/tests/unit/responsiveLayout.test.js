const {
  getBarLimitedMaxWidth,
  getLineLimitedMaxWidth,
  getResponsiveGeometry,
  resolveBarComposition,
  resolveCategoryComposition,
  resolveGaugeComposition,
  resolveHorizontalBarComposition,
  resolveLineComposition,
  resolveMatrixComposition,
  resolvePolarComposition,
  resolveRadarComposition,
} = require("../../visualization/responsiveLayout");

describe("responsive visualization layout", () => {
  it("resolves width, height, and shape independently", () => {
    expect(getResponsiveGeometry(189, 231)).toEqual({
      height: "regular",
      shape: "balanced",
      width: "narrow",
    });
    expect(getResponsiveGeometry(424, 80)).toEqual({
      height: "shallow",
      shape: "panoramic",
      width: "regular",
    });
  });

  it("selects line compositions from geometry and mark density", () => {
    expect(resolveLineComposition({ height: 104, pointCount: 30, width: 189 })).toBe("sparkline");
    expect(resolveLineComposition({ height: 80, pointCount: 30, width: 424 })).toBe("sparkline");
    expect(resolveLineComposition({ height: 231, pointCount: 30, width: 424 })).toBe("limited");
    expect(resolveLineComposition({ height: 300, pointCount: 30, width: 800 })).toBe("analysis");
    expect(resolveLineComposition({ height: 300, pointCount: 80, width: 800 })).toBe("limited");
    expect(getLineLimitedMaxWidth(80)).toBe(1120);
  });

  it("selects vertical bar compositions from geometry and mark density", () => {
    expect(resolveBarComposition({ height: 104, pointCount: 30, width: 189 })).toBe("sparkline");
    expect(resolveBarComposition({ height: 80, pointCount: 30, width: 424 })).toBe("sparkline");
    expect(resolveBarComposition({ height: 231, pointCount: 30, width: 424 })).toBe("limited");
    expect(resolveBarComposition({ height: 300, pointCount: 30, width: 800 })).toBe("analysis");
    expect(resolveBarComposition({ height: 300, pointCount: 80, width: 800 })).toBe("limited");
    expect(getBarLimitedMaxWidth(80)).toBe(1120);
  });

  it("selects category compositions from independent width and height bands", () => {
    expect(resolveCategoryComposition({ height: 104, width: 189 })).toBe("micro");
    expect(resolveCategoryComposition({ height: 104, width: 424 })).toBe("side-summary");
    expect(resolveCategoryComposition({ height: 231, width: 189 })).toBe("stacked-summary");
    expect(resolveCategoryComposition({ height: 231, width: 424 })).toBe("centered");
    expect(resolveCategoryComposition({ height: 300, width: 800 })).toBe("side-breakdown");
    expect(resolveCategoryComposition({ height: 400, width: 424 })).toBe("stacked-breakdown");
    expect(resolveCategoryComposition({ height: 400, width: 189 })).toBe("stacked-breakdown");
  });

  it("selects horizontal bar comparison and compact compositions", () => {
    expect(resolveHorizontalBarComposition({ height: 104, width: 424 })).toBe("compact");
    expect(resolveHorizontalBarComposition({ height: 231, width: 189 })).toBe("compact");
    expect(resolveHorizontalBarComposition({ height: 231, width: 424 })).toBe("comparison");
  });

  it("selects matrix compositions from geometry and cell density", () => {
    expect(resolveMatrixComposition({ columnCount: 5, height: 104, rowCount: 7, width: 424 })).toBe("dense");
    expect(resolveMatrixComposition({ columnCount: 5, height: 231, rowCount: 7, width: 189 })).toBe("dense");
    expect(resolveMatrixComposition({ columnCount: 5, height: 231, rowCount: 7, width: 424 })).toBe("bounded");
    expect(resolveMatrixComposition({ columnCount: 5, height: 400, rowCount: 7, width: 800 })).toBe("labeled");
    expect(resolveMatrixComposition({ columnCount: 60, height: 400, rowCount: 7, width: 800 })).toBe("bounded");
  });

  it("selects gauge compositions from width and height", () => {
    expect(resolveGaugeComposition({ height: 104, width: 189 })).toBe("micro");
    expect(resolveGaugeComposition({ height: 104, width: 424 })).toBe("side-summary");
    expect(resolveGaugeComposition({ height: 231, width: 189 })).toBe("compact");
    expect(resolveGaugeComposition({ height: 231, width: 424 })).toBe("centered");
    expect(resolveGaugeComposition({ height: 300, width: 800 })).toBe("large");
  });

  it("selects polar and radar compositions from width and height", () => {
    expect(resolvePolarComposition({ height: 104, width: 424 })).toBe("compact");
    expect(resolvePolarComposition({ height: 231, width: 424 })).toBe("limited");
    expect(resolvePolarComposition({ height: 400, width: 800 })).toBe("analysis");
    expect(resolveRadarComposition({ height: 231, width: 189 })).toBe("compact");
    expect(resolveRadarComposition({ height: 231, width: 424 })).toBe("limited");
    expect(resolveRadarComposition({ height: 400, width: 800 })).toBe("analysis");
  });
});
