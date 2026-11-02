const IMAGE_SIZE_PRESETS = Object.freeze({
  landscape: Object.freeze({ height: 720, width: 1280 }),
  mobile: Object.freeze({ height: 2340, width: 1080 }),
});

const IMAGE_LIMITS = Object.freeze({
  maxDimension: 2400,
  maxPixels: 5_760_000,
  minOriginalShortSide: 480,
});

const IMAGE_LAYOUT_REFERENCE = Object.freeze({ height: 720, width: 1280 });
const IMAGE_DETAIL_REFERENCE = Object.freeze({
  landscape: Object.freeze({ height: 540, width: 960 }),
  portrait: Object.freeze({ height: 780, width: 360 }),
});
const SHARE_CARD_ASPECT = Object.freeze({ height: 3, width: 4 });
const PORTRAIT_RATIO = 1.2;

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

function resolveLayoutScale(width, height, portrait) {
  if (portrait) return Math.max(0.72, width / IMAGE_LAYOUT_REFERENCE.width);
  return Math.max(
    0.72,
    Math.min(width / IMAGE_LAYOUT_REFERENCE.width, height / IMAGE_LAYOUT_REFERENCE.height),
  );
}

function resolveDetailScale(width, height, portrait) {
  const reference = portrait ? IMAGE_DETAIL_REFERENCE.portrait : IMAGE_DETAIL_REFERENCE.landscape;
  const scale = Math.min(width / reference.width, height / reference.height);
  return Math.max(1, Math.min(portrait ? 3 : 2, scale));
}

function resolveTextScales(layoutScale, detailScale, portrait) {
  return {
    branding: Math.max(layoutScale, portrait ? detailScale * 0.8 : detailScale),
    content: Math.max(layoutScale, portrait ? Math.min(detailScale, 2.1) : detailScale),
    identity: Math.max(layoutScale, detailScale),
  };
}

function buildCardContent(card, content, scale, contentScale) {
  const hasTitle = Boolean(content.title?.show);
  const hasSubtitle = Boolean(content.subtitle?.show);
  const padding = round(Math.max(36 * scale, 24 * contentScale));
  const titleHeight = hasTitle ? round(34 * contentScale) : 0;
  const subtitleHeight = hasSubtitle ? round(22 * contentScale) : 0;
  const titleGap = (hasTitle || hasSubtitle)
    ? round(Math.max(16 * scale, 8 * contentScale))
    : 0;
  const bodyTop = card.y + padding + titleHeight + subtitleHeight + titleGap;
  const bodyBottom = card.y + card.height - padding;

  return {
    chart: {
      height: Math.max(round(120 * scale), round(bodyBottom - bodyTop)),
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: bodyTop,
    },
    subtitle: {
      height: subtitleHeight,
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: card.y + padding + titleHeight,
    },
    title: {
      height: titleHeight,
      width: round(card.width - (padding * 2)),
      x: card.x + padding,
      y: card.y + padding,
    },
  };
}

function resolveImageLayout({ content = {}, height, layout = "shareCard", width }) {
  const finalWidth = assertPositiveNumber(width, "width");
  const finalHeight = assertPositiveNumber(height, "height");
  const portrait = finalHeight / finalWidth >= PORTRAIT_RATIO;
  const scale = resolveLayoutScale(finalWidth, finalHeight, portrait);
  const detailScale = resolveDetailScale(finalWidth, finalHeight, portrait);
  const textScales = resolveTextScales(scale, detailScale, portrait);

  if (layout === "chartOnly") {
    const padding = round(28 * scale);
    const card = {
      height: round(finalHeight - (padding * 2)),
      width: round(finalWidth - (padding * 2)),
      x: padding,
      y: padding,
    };
    return {
      canvas: { height: round(finalHeight), width: round(finalWidth), x: 0, y: 0 },
      card,
      chart: { ...card },
      detailScale,
      layout,
      scale,
      textScales,
    };
  }

  if (layout !== "shareCard") throw new Error("Image layout is not supported");

  const hasBranding = content.branding === "chartbrew";
  const hasIdentity = Boolean(content.logo || content.companyName || content.dashboardName);
  const marginX = round(52 * scale);
  const identityHeight = hasIdentity
    ? round((content.logo ? 28 : 20) * textScales.identity)
    : 0;
  const identityGap = hasIdentity ? round(12 * textScales.identity) : 0;
  const brandingHeight = round(20 * textScales.branding);
  const brandingGap = hasBranding ? round(12 * textScales.identity) : 0;
  const brandingWidth = round(188 * textScales.branding);

  let card;
  let identityY;
  let brandingY;

  if (portrait) {
    const maxCardWidth = round(finalWidth - (marginX * 2));
    const chromeHeight = identityHeight + identityGap + brandingGap + (hasBranding ? brandingHeight : 0);
    const maxCardHeight = round(finalHeight - chromeHeight - round(96 * scale));
    let cardWidth = maxCardWidth;
    let cardHeight = round(cardWidth * SHARE_CARD_ASPECT.height / SHARE_CARD_ASPECT.width);
    if (cardHeight > maxCardHeight) {
      cardHeight = Math.max(round(180 * scale), maxCardHeight);
      cardWidth = round(cardHeight * SHARE_CARD_ASPECT.width / SHARE_CARD_ASPECT.height);
    }
    const clusterHeight = chromeHeight + cardHeight;
    const clusterY = round((finalHeight - clusterHeight) / 2);
    identityY = clusterY;
    card = {
      height: cardHeight,
      width: cardWidth,
      x: round((finalWidth - cardWidth) / 2),
      y: clusterY + identityHeight + identityGap,
    };
    brandingY = card.y + card.height + brandingGap;
  } else {
    identityY = hasIdentity ? round(18 * scale) : 0;
    const marginTop = hasIdentity
      ? identityY + identityHeight + identityGap
      : round(52 * scale);
    const marginBottom = hasBranding
      ? Math.max(
        round(68 * scale),
        brandingGap + brandingHeight + round(8 * textScales.identity),
      )
      : round(52 * scale);
    card = {
      height: round(finalHeight - marginTop - marginBottom),
      width: round(finalWidth - (marginX * 2)),
      x: marginX,
      y: marginTop,
    };
    brandingY = card.y + card.height + brandingGap;
  }

  const slots = buildCardContent(card, content, scale, textScales.content);

  return {
    branding: hasBranding ? {
      height: brandingHeight,
      width: brandingWidth,
      x: round(card.x + card.width - brandingWidth),
      y: brandingY,
    } : null,
    canvas: { height: round(finalHeight), width: round(finalWidth), x: 0, y: 0 },
    card,
    chart: slots.chart,
    detailScale,
    identity: hasIdentity ? {
      height: identityHeight,
      width: card.width,
      x: card.x,
      y: identityY,
    } : null,
    layout,
    scale,
    subtitle: slots.subtitle,
    textScales,
    title: slots.title,
  };
}

module.exports = {
  IMAGE_LAYOUT_REFERENCE,
  IMAGE_LIMITS,
  IMAGE_SIZE_PRESETS,
  resolveImageLayout,
  resolveImageSize,
};
