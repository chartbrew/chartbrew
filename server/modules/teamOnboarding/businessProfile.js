const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const MAX_LOGO_BYTES = 512 * 1024;

function cleanText(value, maximumLength) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maximumLength);
}

function cleanOptionalUrl(value, maximumLength = 2048) {
  const cleaned = cleanText(value, maximumLength);
  if (!cleaned) return null;
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
      ? cleaned : `https://${cleaned}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().slice(0, maximumLength);
  } catch (error) {
    return null;
  }
}

function detectImageMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return "image/x-icon";
  }
  return null;
}

function normalizeLogo(logo) {
  if (!logo || typeof logo !== "object" || !logo.data) {
    return { logoData: null, logoMimeType: null };
  }
  const suppliedMimeType = cleanText(logo.mimeType, 100)?.toLowerCase();
  if (!suppliedMimeType || !ALLOWED_IMAGE_MIME_TYPES.has(suppliedMimeType)) {
    throw new Error("Invalid business logo");
  }
  const logoData = Buffer.from(String(logo.data), "base64");
  if (!logoData.length || logoData.length > MAX_LOGO_BYTES) throw new Error("Invalid business logo");
  const detectedMimeType = detectImageMimeType(logoData);
  if (!detectedMimeType) throw new Error("Invalid business logo");
  const suppliedIsIcon = suppliedMimeType === "image/x-icon"
    || suppliedMimeType === "image/vnd.microsoft.icon";
  if (detectedMimeType !== suppliedMimeType
    && !(suppliedIsIcon && detectedMimeType === "image/x-icon")) {
    throw new Error("Invalid business logo");
  }
  return { logoData, logoMimeType: detectedMimeType };
}

function sanitizeStringList(values, maximumItems, maximumLength) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => cleanText(value, maximumLength))
    .filter(Boolean))].slice(0, maximumItems);
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const sanitized = {};
  const scalarFields = {
    language: 35,
    locale: 35,
    themeColor: 32,
    industry: 120,
    siteTitle: 200,
  };
  Object.entries(scalarFields).forEach(([field, maximumLength]) => {
    const value = cleanText(metadata[field], maximumLength);
    if (value) sanitized[field] = value;
  });
  const keywords = sanitizeStringList(metadata.keywords, 10, 60);
  if (keywords.length) sanitized.keywords = keywords;
  const socialLinks = sanitizeStringList(metadata.socialLinks, 10, 500)
    .map((value) => cleanOptionalUrl(value, 500)).filter(Boolean);
  if (socialLinks.length) sanitized.socialLinks = socialLinks;
  return sanitized;
}

function sanitizeBusinessProfile(profile = {}, options = {}) {
  const includeLogo = options.includeLogo !== false;
  const websiteUrl = cleanOptionalUrl(profile.websiteUrl);
  let domain = cleanText(profile.domain, 253)?.toLowerCase() || null;
  if (websiteUrl) domain = new URL(websiteUrl).hostname.toLowerCase();
  const sanitized = {
    websiteUrl,
    domain,
    businessName: cleanText(profile.businessName, 200),
    description: cleanText(profile.description, 1200),
    metadata: sanitizeMetadata(profile.metadata),
  };
  if (includeLogo) Object.assign(sanitized, normalizeLogo(profile.logo));
  return sanitized;
}

function sanitizeTeamName(value) {
  const name = cleanText(value, 100);
  if (!name) throw new Error("Team name is required");
  return name;
}

function sanitizeUseCases(value) {
  const useCases = cleanText(value, 500);
  if (!useCases) throw new Error("Team use case is required");
  return useCases;
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_LOGO_BYTES,
  cleanText,
  detectImageMimeType,
  sanitizeBusinessProfile,
  sanitizeMetadata,
  sanitizeTeamName,
  sanitizeUseCases,
};
