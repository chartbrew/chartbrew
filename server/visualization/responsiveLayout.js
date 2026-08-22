const responsiveLayout = require("../../shared/visualization/responsiveLayout.json");

function toSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function getResponsiveGeometry(width, height) {
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

function getDenseLimitedMaxWidth(pointCount, seriesCount, spacing) {
  const marks = Math.max(1, Number(pointCount) || 0) * Math.max(1, Number(seriesCount) || 0);
  return Math.max(
    responsiveLayout.geometry.width.regularMax,
    Math.ceil(marks * spacing)
  );
}

function getLineLimitedMaxWidth(pointCount, seriesCount = 1) {
  return getDenseLimitedMaxWidth(
    pointCount,
    seriesCount,
    responsiveLayout.presets.line.densePointSpacing
  );
}

function getBarLimitedMaxWidth(pointCount, seriesCount = 1) {
  return getDenseLimitedMaxWidth(
    pointCount,
    seriesCount,
    responsiveLayout.presets.bar.denseBarSpacing
  );
}

function resolveCartesianComposition({ height, limitedMaxWidth, width }) {
  const geometry = getResponsiveGeometry(width, height);
  if (geometry.width === "narrow" || geometry.height === "shallow") return "sparkline";
  if (geometry.width === "regular") return "limited";
  return toSize(width) <= limitedMaxWidth ? "limited" : "analysis";
}

function resolveLineComposition({ height, pointCount, seriesCount, width }) {
  return resolveCartesianComposition({
    height,
    limitedMaxWidth: getLineLimitedMaxWidth(pointCount, seriesCount),
    width,
  });
}

function resolveBarComposition({ height, pointCount, seriesCount, width }) {
  return resolveCartesianComposition({
    height,
    limitedMaxWidth: getBarLimitedMaxWidth(pointCount, seriesCount),
    width,
  });
}

module.exports = {
  RESPONSIVE_LAYOUT: responsiveLayout,
  getBarLimitedMaxWidth,
  getLineLimitedMaxWidth,
  getResponsiveGeometry,
  resolveBarComposition,
  resolveLineComposition,
};
