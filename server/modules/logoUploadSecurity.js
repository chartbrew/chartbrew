const path = require("path");

const MAX_LOGO_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_LOGO_MIME_TYPES = Object.freeze({
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
  "application/svg+xml": ".svg",
});

const normalizeMimeType = (mimeType = "") => {
  const normalized = `${mimeType}`.toLowerCase().trim();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized === "application/svg+xml") return "image/svg+xml";
  return normalized;
};

const isSafeSvgBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  const content = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!content) return false;

  const hasSvgRoot = /^(?:<\?xml[\s\S]*?\?>\s*)?<svg[\s>][\s\S]*$/i.test(content);
  if (!hasSvgRoot) {
    return false;
  }

  const hasClosingSvg = /<\/svg>\s*$/i.test(content);
  const hasSelfClosingSvg = /<svg[^>]*\/>\s*$/i.test(content);
  if (!hasClosingSvg && !hasSelfClosingSvg) {
    return false;
  }

  const unsafePatterns = [
    /<script[\s>]/i,
    /\son[a-z]+\s*=/i,
    /\b(?:href|xlink:href)\s*=\s*["']?\s*javascript:/i,
    /<foreignobject[\s>]/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
  ];

  return !unsafePatterns.some((pattern) => pattern.test(content));
};

const getImageTypeFromBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4E
    && buffer[3] === 0x47
    && buffer[4] === 0x0D
    && buffer[5] === 0x0A
    && buffer[6] === 0x1A
    && buffer[7] === 0x0A
  ) {
    return "image/png";
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "image/jpeg";
  }

  // GIF signature: GIF87a / GIF89a
  if (buffer.toString("ascii", 0, 6) === "GIF87a"
    || buffer.toString("ascii", 0, 6) === "GIF89a"
  ) {
    return "image/gif";
  }

  // WEBP signature: RIFF....WEBP
  if (buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

const isAllowedLogoMimeType = (mimeType) => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  return !!ALLOWED_LOGO_MIME_TYPES[normalizedMimeType];
};

const isValidLogoImageBuffer = (buffer, mimeType) => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!isAllowedLogoMimeType(normalizedMimeType)) {
    return false;
  }

  if (normalizedMimeType === "image/svg+xml") {
    return isSafeSvgBuffer(buffer);
  }

  const detectedMimeType = getImageTypeFromBuffer(buffer);
  return detectedMimeType === normalizedMimeType;
};

const buildSafeLogoFilename = (mimeType, idGenerator) => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const extension = ALLOWED_LOGO_MIME_TYPES[normalizedMimeType];
  if (!extension) return null;

  const generatedId = typeof idGenerator === "function" ? idGenerator() : idGenerator;
  if (!generatedId) return null;

  return `${generatedId}${extension}`;
};

const resolveSafeUploadPath = (uploadDirectory, fileName) => {
  const resolvedDirectory = path.resolve(uploadDirectory);
  const resolvedPath = path.resolve(resolvedDirectory, fileName);
  if (!resolvedPath.startsWith(`${resolvedDirectory}${path.sep}`)) {
    return null;
  }
  return resolvedPath;
};

module.exports = {
  MAX_LOGO_UPLOAD_SIZE_BYTES,
  buildSafeLogoFilename,
  isAllowedLogoMimeType,
  isValidLogoImageBuffer,
  resolveSafeUploadPath,
};
