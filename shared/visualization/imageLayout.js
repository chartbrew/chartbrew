const IMAGE_SIZE_PRESETS = Object.freeze({
  social: Object.freeze({ height: 630, width: 1200 }),
  square: Object.freeze({ height: 1080, width: 1080 }),
});

const IMAGE_LIMITS = Object.freeze({
  maxDimension: 2400,
  maxPixels: 5_760_000,
  minOriginalShortSide: 480,
});

function round(value) {
  return Math.max(0, Math.round(value));
}

function assertPositiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return number;
}

function fitWithinLimits(width, height) {
  let nextWidth = width;
  let nextHeight = height;
  const shortSide = Math.min(nextWidth, nextHeight);
  if (shortSide < IMAGE_LIMITS.minOriginalShortSide) {
    const scale = IMAGE_LIMITS.minOriginalShortSide / shortSide;
    nextWidth *= scale;
    nextHeight *= scale;
  }

  const longSide = Math.max(nextWidth, nextHeight);
  if (longSide > IMAGE_LIMITS.maxDimension) {
    const scale = IMAGE_LIMITS.maxDimension / longSide;
    nextWidth *= scale;
    nextHeight *= scale;
  }

  const pixels = nextWidth * nextHeight;
  if (pixels > IMAGE_LIMITS.maxPixels) {
    const scale = Math.sqrt(IMAGE_LIMITS.maxPixels / pixels);
    nextWidth *= scale;
    nextHeight *= scale;
  }

  return { height: round(nextHeight), width: round(nextWidth) };
}

function resolveImageSize(size = {}) {
  if (IMAGE_SIZE_PRESETS[size.preset]) return { ...IMAGE_SIZE_PRESETS[size.preset] };
  if (size.preset !== "original") throw new Error("Image size preset is not supported");

  const sourceWidth = assertPositiveNumber(size.sourceWidth, "sourceWidth");
  const sourceHeight = assertPositiveNumber(size.sourceHeight, "sourceHeight");
  return fitWithinLimits(sourceWidth * 2, sourceHeight * 2);
}

function resolveImageLayout({ content = {}, height, layout = "shareCard", width }) {
  const finalWidth = assertPositiveNumber(width, "width");
  const finalHeight = assertPositiveNumber(height, "height");
  const scale = Math.max(0.72, Math.min(1.25, finalWidth / 1200, finalHeight / 630));

  if (layout === "chartOnly") {
    const padding = round(28 * scale);
    return {
      canvas: { height: round(finalHeight), width: round(finalWidth), x: 0, y: 0 },
      chart: {
        height: round(finalHeight - (padding * 2)),
        width: round(finalWidth - (padding * 2)),
        x: padding,
        y: padding,
      },
      layout,
      scale,
    };
  }

  if (layout !== "shareCard") throw new Error("Image layout is not supported");

  const margin = round(32 * scale);
  const padding = round(36 * scale);
  const card = {
    height: round(finalHeight - (margin * 2)),
    width: round(finalWidth - (margin * 2)),
    x: margin,
    y: margin,
  };
  const hasHeader = Boolean(content.logo || content.companyName || content.dashboardName);
  const hasTitle = Boolean(content.title?.show);
  const hasSubtitle = Boolean(content.subtitle?.show);
  const hasFooter = Boolean(content.dateRange || content.lastUpdated || content.branding);
  const headerHeight = hasHeader ? round(38 * scale) : 0;
  const headerGap = hasHeader && (hasTitle || hasSubtitle) ? round(20 * scale) : 0;
  const titleHeight = hasTitle ? round(39 * scale) : 0;
  const subtitleHeight = hasSubtitle ? round(26 * scale) : 0;
  const titleGap = (hasTitle || hasSubtitle) ? round(16 * scale) : 0;
  const footerGap = hasFooter ? round(18 * scale) : 0;
  const footerHeight = hasFooter ? round(38 * scale) : 0;
  const bodyTop = card.y + padding + headerHeight + headerGap + titleHeight + subtitleHeight + titleGap;
  const bodyBottom = card.y + card.height - padding - footerHeight - footerGap;

  return {
    canvas: { height: round(finalHeight), width: round(finalWidth), x: 0, y: 0 },
    card,
    chart: {
      height: Math.max(round(120 * scale), round(bodyBottom - bodyTop)),
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: bodyTop,
    },
    footer: {
      height: footerHeight,
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: card.y + card.height - padding - footerHeight,
    },
    header: {
      height: headerHeight,
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: card.y + padding,
    },
    layout,
    scale,
    subtitle: {
      height: subtitleHeight,
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: card.y + padding + headerHeight + headerGap + titleHeight,
    },
    title: {
      height: titleHeight,
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: card.y + padding + headerHeight + headerGap,
    },
  };
}

module.exports = {
  IMAGE_LIMITS,
  IMAGE_SIZE_PRESETS,
  resolveImageLayout,
  resolveImageSize,
};
