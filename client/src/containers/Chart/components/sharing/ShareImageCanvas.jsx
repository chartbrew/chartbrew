import React, { forwardRef, useMemo } from "react";
import PropTypes from "prop-types";

import { API_HOST } from "../../../../config/settings";
import { semanticColors } from "../../../../lib/themeTokens";
import { resolveImageLayout } from "../../../../visualization/shareImageLayout";
import ChartRenderer from "../ChartRenderer";
import { getShareImageBackgroundSrc } from "./shareImageBackgrounds";
import { SHARE_IMAGE_BACKGROUND_PRESETS, SHARE_IMAGE_DEFAULT_COLOR } from "./shareImageDefaults";

function getBackgroundPreset(options) {
  if (options.background?.mode !== "image") return null;
  return SHARE_IMAGE_BACKGROUND_PRESETS.find((item) => item.id === options.background.id)
    || SHARE_IMAGE_BACKGROUND_PRESETS[0];
}

function getBackground(options, colors) {
  const image = getBackgroundPreset(options);
  if (image) return image.ink === "light" ? "#18181B" : SHARE_IMAGE_DEFAULT_COLOR;
  if (options.background?.mode === "gradient") {
    return `linear-gradient(135deg, ${options.background.from}, ${options.background.to})`;
  }
  if (options.background?.mode === "custom") return options.background.color;
  return colors.background.DEFAULT;
}

function getLuminance(hex) {
  const value = Number.parseInt(`${hex || ""}`.replace("#", ""), 16);
  if (!Number.isFinite(value)) return 1;
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;
}

function getCanvasInk(options, strong = false) {
  const image = getBackgroundPreset(options);
  if (image?.ink === "light") return strong ? "#FAFAFA" : "#E4E4E7";
  if (image?.ink === "dark") return strong ? "#18181B" : "#52525B";
  const values = options.background?.mode === "gradient"
    ? [options.background.from, options.background.to]
    : [options.background?.color];
  const luminance = values
    .map((value) => getLuminance(value))
    .reduce((sum, value) => sum + value, 0) / values.length;
  if (luminance < 0.45) return strong ? "#FAFAFA" : "#E4E4E7";
  return strong ? "#18181B" : "#52525B";
}

function getLogoUrl(logo) {
  if (!logo) return null;
  if (/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/i.test(logo)) return logo;
  if (`${logo}`.startsWith(`${API_HOST}/`)) return logo;
  if (/^(?:blob:|https?:\/\/)/i.test(logo)) return null;
  return `${API_HOST}/${`${logo}`.replace(/^\/+/, "")}`;
}

function absoluteStyle(slot) {
  if (!slot) return { display: "none" };
  return {
    height: slot.height,
    left: slot.x,
    position: "absolute",
    top: slot.y,
    width: slot.width,
  };
}

const ShareImageCanvas = forwardRef(function ShareImageCanvas({
  chart,
  dimensions,
  options,
  project,
  team = {},
}, ref) {
  const colors = semanticColors[options.theme];
  const portrait = dimensions.height / dimensions.width >= 1.2;
  const layout = useMemo(() => resolveImageLayout({
    content: options.content,
    height: dimensions.height,
    layout: options.layout,
    width: dimensions.width,
  }), [dimensions.height, dimensions.width, options.content, options.layout]);
  const contentScale = layout.textScales?.content || layout.scale;
  const identityScale = layout.textScales?.identity || layout.scale;
  const brandingScale = layout.textScales?.branding || layout.scale;
  const logoUrl = options.content.logo ? getLogoUrl(project.logo) : null;
  const companyName = team?.name || "";
  const projectName = project.dashboardTitle || project.name || "";
  const identityGap = Math.round(12 * layout.scale);
  const logoSize = logoUrl ? Math.round(28 * identityScale) : 0;
  const identityTextWidth = Math.max(
    0,
    (layout.identity?.width || 0) - logoSize - (logoUrl ? identityGap : 0)
  );
  const companyMaxWidth = options.content.dashboardName && projectName
    ? Math.round(identityTextWidth * 0.55)
    : identityTextWidth;
  const projectMaxWidth = options.content.companyName && companyName
    ? Math.round(identityTextWidth * 0.4)
    : identityTextWidth;
  const canvasInk = getCanvasInk(options, true);
  const canvasMuted = getCanvasInk(options);
  const backgroundImageSrc = getShareImageBackgroundSrc(options.background?.id);

  return (
    <div
      ref={ref}
      aria-label={`Preview of ${chart.name}`}
      className={options.theme === "dark" ? "dark" : "light"}
      data-share-image-canvas
      data-theme={options.theme}
      role="img"
      style={{
        background: getBackground(options, colors),
        color: colors.foreground.DEFAULT,
        colorScheme: options.theme,
        fontFamily: "Inter Tight, Inter, sans-serif",
        height: dimensions.height,
        overflow: "hidden",
        pointerEvents: "none",
        position: "relative",
        userSelect: "none",
        width: dimensions.width,
      }}
    >
      {options.background?.mode === "image" && backgroundImageSrc && (
        <img
          alt=""
          src={backgroundImageSrc}
          style={{
            height: "100%",
            left: 0,
            objectFit: "cover",
            objectPosition: "center",
            position: "absolute",
            top: 0,
            width: "100%",
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          ...absoluteStyle(layout.card),
          background: colors.content1.DEFAULT,
          borderRadius: Math.round(24 * layout.scale),
          overflow: "hidden",
          zIndex: 1,
        }}
      />

      {layout.identity && (
        <div
          style={{
            ...absoluteStyle(layout.identity),
            alignItems: "center",
            display: "flex",
            gap: identityGap,
            zIndex: 1,
          }}
        >
          {logoUrl && (
            <img
              alt=""
              crossOrigin="anonymous"
              src={logoUrl}
              style={{
                height: Math.round(28 * identityScale),
                maxHeight: layout.identity.height,
                objectFit: "contain",
                width: Math.round(28 * identityScale),
              }}
            />
          )}
          {options.content.companyName && companyName && (
            <div
              style={{
                color: canvasInk,
                fontSize: Math.round(16 * identityScale),
                fontWeight: 700,
                lineHeight: 1,
                maxWidth: companyMaxWidth,
                minWidth: 0,
                overflow: "hidden",
                flexShrink: 0,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: companyMaxWidth,
              }}
            >
              {companyName}
            </div>
          )}
          {options.content.dashboardName && projectName && (
            <div
              style={{
                color: canvasMuted,
                fontSize: Math.round(14 * identityScale),
                fontWeight: 500,
                lineHeight: 1,
                marginLeft: "auto",
                maxWidth: projectMaxWidth,
                minWidth: 0,
                overflow: "hidden",
                flexShrink: 0,
                textOverflow: "ellipsis",
                textAlign: "right",
                whiteSpace: "nowrap",
                width: projectMaxWidth,
              }}
            >
              {projectName}
            </div>
          )}
        </div>
      )}

      {options.content.title?.show && (
        <div
          style={{
            ...absoluteStyle(layout.title),
            color: colors.foreground.DEFAULT,
            fontSize: Math.round((portrait ? 26 : 28) * contentScale),
            fontWeight: 700,
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          {options.content.title.text}
        </div>
      )}

      {options.content.subtitle?.show && (
        <div
          style={{
            ...absoluteStyle(layout.subtitle),
            color: colors.foreground[500],
            fontSize: Math.round(16 * contentScale),
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          {options.content.subtitle.text}
        </div>
      )}

      <div style={{ ...absoluteStyle(layout.chart), zIndex: 1 }}>
        <ChartRenderer
          chart={{ ...chart, loading: false }}
          compactAxes={portrait}
          detailScale={layout.detailScale}
          embedded
          height={layout.chart.height}
          renderer="svg"
          theme={options.theme}
        />
      </div>

      {layout.branding && options.content.branding === "chartbrew" && (
        <div
          style={{
            ...absoluteStyle(layout.branding),
            alignItems: "baseline",
            color: canvasMuted,
            display: "flex",
            fontSize: Math.round(11 * brandingScale),
            gap: Math.round(4 * brandingScale),
            justifyContent: "flex-end",
            lineHeight: 1,
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          <span>Powered by</span>
          <span
            style={{
              alignItems: "baseline",
              color: canvasInk,
              display: "inline-flex",
              fontSize: Math.round(20 * brandingScale),
            }}
          >
            <span style={{ fontWeight: 700 }}>chart</span>
            <span>brew</span>
          </span>
        </div>
      )}
    </div>
  );
});

ShareImageCanvas.propTypes = {
  chart: PropTypes.object.isRequired,
  dimensions: PropTypes.shape({
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
  }).isRequired,
  options: PropTypes.object.isRequired,
  project: PropTypes.object.isRequired,
  team: PropTypes.object,
};

export default ShareImageCanvas;
