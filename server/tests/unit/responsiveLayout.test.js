const {
  getBarLimitedMaxWidth,
  getLineLimitedMaxWidth,
  getResponsiveGeometry,
  resolveBarComposition,
  resolveLineComposition,
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
});
