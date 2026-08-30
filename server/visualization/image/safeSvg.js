const FORBIDDEN_SERVER_SVG = /<(?:script|foreignObject|iframe|object|embed)\b|\b(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/)/i;

function isForbiddenControlCharacter(character) {
  const codePoint = character.codePointAt(0);
  return codePoint <= 8
    || codePoint === 11
    || codePoint === 12
    || (codePoint >= 14 && codePoint <= 31)
    || codePoint === 127;
}

function escapeXml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizePlainText(value, maxCodePoints) {
  const normalized = [...`${value ?? ""}`.replace(/\r\n?/g, "\n")]
    .filter((character) => !isForbiddenControlCharacter(character))
    .join("")
    .trim();
  return [...normalized].slice(0, maxCodePoints).join("");
}

function splitTextLines(value, { fontSize, maxLines = 1, width }) {
  const text = sanitizePlainText(value, 500);
  if (!text) return [];
  const maxCharacters = Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.55)));
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if ([...next].length <= maxCharacters) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    line = [...word].slice(0, maxCharacters).join("");
  });
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = [...visible[maxLines - 1]].slice(0, Math.max(1, maxCharacters - 1)).join("");
  visible[maxLines - 1] = `${last}…`;
  return visible;
}

function renderText({
  anchor = "start",
  color,
  fontSize,
  fontWeight = 400,
  lineHeight = fontSize * 1.2,
  maxLines = 1,
  text,
  width,
  x,
  y,
}) {
  const lines = splitTextLines(text, { fontSize, maxLines, width });
  if (lines.length === 0) return "";
  const spans = lines.map((line, index) => {
    return `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`;
  }).join("");
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Chartbrew Inter Tight" `
    + `font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="${anchor}">${spans}</text>`;
}

function prefixSvgIds(svg, prefix) {
  const ids = [];
  const withIds = svg.replace(/\bid="([^"]+)"/g, (match, id) => {
    ids.push(id);
    return `id="${prefix}-${id}"`;
  });
  return ids.reduce((result, id) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${prefix}-${id})`)
      .replace(new RegExp(`(["'])#${escaped}(["'])`, "g"), `$1#${prefix}-${id}$2`);
  }, withIds);
}

function canonicalizeSvgIds(svg, prefix = "chart") {
  const ids = [];
  `${svg}`.replace(/\bid="([^"]+)"/g, (match, id) => {
    if (!ids.includes(id)) ids.push(id);
    return match;
  });
  const withIds = ids.reduce((result, id, index) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const replacement = `${prefix}-${index}`;
    return result
      .replace(new RegExp(`id="${escaped}"`, "g"), `id="${replacement}"`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${replacement})`)
      .replace(new RegExp(`(["'])#${escaped}(["'])`, "g"), `$1#${replacement}$2`);
  }, `${svg}`);
  const classNames = [...new Set(withIds.match(/\bzr\d+-cls-\d+\b/g) || [])];
  return classNames.reduce((result, className, index) => {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`\\b${escaped}\\b`, "g"), `${prefix}-class-${index}`);
  }, withIds);
}

function embedServerSvg(svg, { height, idPrefix, width, x, y }) {
  if (typeof svg !== "string" || !/^\s*<svg\b/i.test(svg) || FORBIDDEN_SERVER_SVG.test(svg)) {
    throw new Error("The server chart SVG is invalid");
  }
  const prefixed = prefixSvgIds(svg.trim(), idPrefix);
  const openingEnd = prefixed.indexOf(">");
  if (openingEnd === -1 || !/<\/svg>\s*$/i.test(prefixed)) {
    throw new Error("The server chart SVG is incomplete");
  }
  const opening = prefixed.slice(0, openingEnd + 1);
  const inner = prefixed.slice(openingEnd + 1).replace(/<\/svg>\s*$/i, "");
  const viewBox = opening.match(/\bviewBox="([^"]+)"/i)?.[1] || `0 0 ${width} ${height}`;
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${escapeXml(viewBox)}" `
    + `preserveAspectRatio="xMidYMid meet" overflow="hidden">${inner}</svg>`;
}

module.exports = {
  canonicalizeSvgIds,
  embedServerSvg,
  escapeXml,
  prefixSvgIds,
  renderText,
  sanitizePlainText,
  splitTextLines,
};
