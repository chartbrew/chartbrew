const IMAGE_LAYOUT_REFERENCE = { height: 720, width: 1280 };
const IMAGE_DETAIL_REFERENCE = {
  landscape: { height: 540, width: 960 },
  portrait: { height: 780, width: 360 },
};
const SHARE_CARD_ASPECT = { height: 3, width: 4 };
const PORTRAIT_RATIO = 1.2;

function round(value) {
  return Math.max(0, Math.round(value));
}

function resolveLayoutScale(width, height, portrait) {
  if (portrait) return Math.max(0.72, width / IMAGE_LAYOUT_REFERENCE.width);
  return Math.max(
    0.72,
    Math.min(width / IMAGE_LAYOUT_REFERENCE.width, height / IMAGE_LAYOUT_REFERENCE.height)
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

export function resolveImageLayout({ content = {}, height, layout = "shareCard", width }) {
  const portrait = height / width >= PORTRAIT_RATIO;
  const scale = resolveLayoutScale(width, height, portrait);
  const detailScale = resolveDetailScale(width, height, portrait);
  const textScales = resolveTextScales(scale, detailScale, portrait);

  if (layout === "chartOnly") {
    const padding = round(28 * scale);
    const card = {
      height: round(height - (padding * 2)),
      width: round(width - (padding * 2)),
      x: padding,
      y: padding,
    };
    return {
      canvas: { height: round(height), width: round(width), x: 0, y: 0 },
      card,
      chart: { ...card },
      detailScale,
      layout,
      scale,
      textScales,
    };
  }

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
    const maxCardWidth = round(width - (marginX * 2));
    const chromeHeight = identityHeight + identityGap + brandingGap
      + (hasBranding ? brandingHeight : 0);
    const maxCardHeight = round(height - chromeHeight - round(96 * scale));
    let cardWidth = maxCardWidth;
    let cardHeight = round(cardWidth * SHARE_CARD_ASPECT.height / SHARE_CARD_ASPECT.width);
    if (cardHeight > maxCardHeight) {
      cardHeight = Math.max(round(180 * scale), maxCardHeight);
      cardWidth = round(cardHeight * SHARE_CARD_ASPECT.width / SHARE_CARD_ASPECT.height);
    }
    const clusterHeight = chromeHeight + cardHeight;
    const clusterY = round((height - clusterHeight) / 2);
    identityY = clusterY;
    card = {
      height: cardHeight,
      width: cardWidth,
      x: round((width - cardWidth) / 2),
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
        brandingGap + brandingHeight + round(8 * textScales.identity)
      )
      : round(52 * scale);
    card = {
      height: round(height - marginTop - marginBottom),
      width: round(width - (marginX * 2)),
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
    canvas: { height: round(height), width: round(width), x: 0, y: 0 },
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
