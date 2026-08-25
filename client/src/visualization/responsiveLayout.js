import responsiveLayout from "../../../shared/visualization/responsiveLayout.json" with { type: "json" };

function toSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function getResponsiveGeometry(width, height) {
  const resolvedWidth = toSize(width);
  const resolvedHeight = toSize(height);
  const ratio = resolvedHeight > 0 ? resolvedWidth / resolvedHeight : 0;
  const { geometry } = responsiveLayout;

  let heightBand = "tall";
  if (resolvedHeight <= geometry.height.shallowMax) heightBand = "shallow";
  else if (resolvedHeight <= geometry.height.regularMax) heightBand = "regular";

  let shape = "balanced";
  if (ratio >= geometry.shape.panoramicMinRatio) shape = "panoramic";
  else if (ratio > 0 && ratio <= geometry.shape.portraitMaxRatio) shape = "portrait";

  let widthBand = "wide";
  if (resolvedWidth <= geometry.width.narrowMax) widthBand = "narrow";
  else if (resolvedWidth <= geometry.width.regularMax) widthBand = "regular";

  return { height: heightBand, shape, width: widthBand };
}

export function getKpiMetricCapacity(width, editMode = false) {
  const resolvedWidth = toSize(width);
  const capacity = Math.max(1, Math.floor(resolvedWidth / responsiveLayout.kpi.minimumMetricWidth));
  return Math.min(capacity, editMode ? 4 : 8);
}

function getDenseLimitedMaxWidth(pointCount, seriesCount = 1, spacing) {
  const marks = Math.max(1, Number(pointCount) || 0) * Math.max(1, Number(seriesCount) || 0);
  return Math.max(
    responsiveLayout.geometry.width.regularMax,
    Math.ceil(marks * spacing)
  );
}

function resolveCartesianComposition({ height, limitedMaxWidth, width }) {
  const geometry = getResponsiveGeometry(width, height);
  if (geometry.width === "narrow" || geometry.height === "shallow") return "sparkline";
  if (geometry.width === "regular") return "limited";
  return toSize(width) <= limitedMaxWidth ? "limited" : "analysis";
}

export function resolveLineComposition({ height, pointCount, seriesCount = 1, width }) {
  return resolveCartesianComposition({
    height,
    limitedMaxWidth: getDenseLimitedMaxWidth(
      pointCount,
      seriesCount,
      responsiveLayout.presets.line.densePointSpacing
    ),
    width,
  });
}

export function resolveBarComposition({ height, pointCount, seriesCount = 1, width }) {
  return resolveCartesianComposition({
    height,
    limitedMaxWidth: getDenseLimitedMaxWidth(
      pointCount,
      seriesCount,
      responsiveLayout.presets.bar.denseBarSpacing
    ),
    width,
  });
}

export function resolveHorizontalBarComposition({ height, width }) {
  const geometry = getResponsiveGeometry(width, height);
  return geometry.width === "narrow" || geometry.height === "shallow"
    ? "compact"
    : "comparison";
}

export function resolveCategoryComposition({ height, width }) {
  const geometry = getResponsiveGeometry(width, height);
  if (geometry.width === "narrow" && geometry.height === "shallow") return "micro";
  if (geometry.height === "shallow") return "side-summary";
  if (geometry.width === "wide") return "side-breakdown";
  if (geometry.height === "tall") return "stacked-breakdown";
  if (geometry.width === "narrow") return "stacked-summary";
  return "centered";
}

export function resolveMatrixComposition({ columnCount = 1, height, rowCount = 1, width }) {
  const geometry = getResponsiveGeometry(width, height);
  if (geometry.width === "narrow" || geometry.height === "shallow") return "dense";
  const cellSize = Math.min(
    toSize(width) / Math.max(1, Number(columnCount) || 1),
    toSize(height) / Math.max(1, Number(rowCount) || 1)
  );
  if (geometry.width === "regular"
    || geometry.height === "regular"
    || cellSize < responsiveLayout.presets.matrix.minimumLabeledCellSize) return "bounded";
  return "labeled";
}

export function resolveGaugeComposition({ height, width }) {
  const geometry = getResponsiveGeometry(width, height);
  if (geometry.width === "narrow" && geometry.height === "shallow") return "micro";
  if (toSize(height) <= responsiveLayout.presets.gauge.sideSummaryMaxHeight
    && geometry.width !== "narrow") return "side-summary";
  if (geometry.width === "narrow") return "compact";
  if (geometry.width === "wide" || geometry.height === "tall") return "large";
  return "centered";
}

export { responsiveLayout as RESPONSIVE_LAYOUT };
