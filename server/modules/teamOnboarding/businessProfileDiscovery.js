const { DomUtils, parseDocument } = require("htmlparser2");

const safeRequest = require("../safeRequest");
const {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_LOGO_BYTES,
  cleanText,
  detectImageMimeType,
  sanitizeMetadata,
} = require("./businessProfile");

const MAX_HTML_BYTES = 1024 * 1024;
const MAX_ROBOTS_BYTES = 100 * 1024;
const TOTAL_TIMEOUT_MS = 10000;
const USER_AGENT = "ChartbrewBusinessProfileBot/1.0";
const SOCIAL_HOSTS = [
  "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "github.com",
];

function getAttribute(node, name) {
  if (!node) return "";
  return DomUtils.getAttributeValue(node, name) || "";
}

function isElementNamed(node, name) {
  return Boolean(node && node.name && node.name.toLowerCase() === name);
}

function findElements(document, name) {
  return DomUtils.findAll((node) => isElementNamed(node, name), document.children || []);
}

function findFirstElement(document, name) {
  return DomUtils.findOne((node) => isElementNamed(node, name), document.children || []);
}

function getMeta(document, key, attribute = "property") {
  const target = key.toLowerCase();
  const meta = findElements(document, "meta").find((node) => {
    return getAttribute(node, attribute).toLowerCase() === target;
  });
  return cleanText(getAttribute(meta, "content"), 1200);
}

function flattenJsonLd(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value !== "object") return [];
  return [value, ...flattenJsonLd(value["@graph"])];
}

function getJsonLdEntities(document) {
  return findElements(document, "script").flatMap((node) => {
    if (getAttribute(node, "type").toLowerCase() !== "application/ld+json") return [];
    try {
      return flattenJsonLd(JSON.parse(DomUtils.textContent(node)));
    } catch (error) {
      return [];
    }
  });
}

function hasJsonLdType(entity, expectedTypes) {
  const types = Array.isArray(entity?.["@type"]) ? entity["@type"] : [entity?.["@type"]];
  return types.some((type) => expectedTypes.has(String(type || "").toLowerCase()));
}

function getJsonLdLogo(entity) {
  const logo = entity?.logo;
  if (typeof logo === "string") return logo;
  if (logo && typeof logo === "object") return logo.url || logo.contentUrl || null;
  return null;
}

function toAbsoluteHttpUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const parsed = new URL(value, baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function splitKeywords(value) {
  if (!value) return [];
  return String(value).split(",").map((keyword) => keyword.trim()).filter(Boolean);
}

function extractPageProfile(html, pageUrl) {
  const document = parseDocument(html, { decodeEntities: true });
  const jsonLdEntity = getJsonLdEntities(document).find((entity) => {
    return hasJsonLdType(entity, new Set(["organization", "corporation", "localbusiness", "website"]));
  }) || {};
  const titleNode = findFirstElement(document, "title");
  const htmlNode = findFirstElement(document, "html");
  const siteTitle = titleNode ? cleanText(DomUtils.textContent(titleNode), 200) : null;
  const standardDescription = getMeta(document, "description", "name");
  const openGraphTitle = getMeta(document, "og:site_name") || getMeta(document, "og:title");
  const openGraphDescription = getMeta(document, "og:description");
  const openGraphImage = getMeta(document, "og:image");
  const logoCandidates = [];
  const addLogoCandidate = (value) => {
    const url = toAbsoluteHttpUrl(value, pageUrl);
    if (url && !logoCandidates.includes(url)) logoCandidates.push(url);
  };
  addLogoCandidate(getJsonLdLogo(jsonLdEntity));
  addLogoCandidate(openGraphImage);
  findElements(document, "link").forEach((node) => {
    const rel = getAttribute(node, "rel").toLowerCase().split(/\s+/);
    if (rel.includes("icon") || rel.includes("apple-touch-icon")) {
      addLogoCandidate(getAttribute(node, "href"));
    }
  });
  const socialLinks = [];
  findElements(document, "a").forEach((node) => {
    const url = toAbsoluteHttpUrl(getAttribute(node, "href"), pageUrl);
    if (!url) return;
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (SOCIAL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      socialLinks.push(url);
    }
  });
  const keywords = splitKeywords(jsonLdEntity.keywords || getMeta(document, "keywords", "name"));
  return {
    businessName: cleanText(jsonLdEntity.name, 200) || openGraphTitle || siteTitle,
    description: cleanText(jsonLdEntity.description, 1200)
      || openGraphDescription || standardDescription,
    logoCandidates,
    metadata: sanitizeMetadata({
      language: getAttribute(htmlNode, "lang"),
      locale: getMeta(document, "og:locale"),
      themeColor: getMeta(document, "theme-color", "name"),
      industry: jsonLdEntity.industry,
      siteTitle,
      keywords,
      socialLinks,
    }),
    aboutLinks: findElements(document, "a").map((node) => ({
      href: toAbsoluteHttpUrl(getAttribute(node, "href"), pageUrl),
      text: cleanText(DomUtils.textContent(node), 100),
    })).filter((link) => link.href),
  };
}

function normalizeWebsiteUrl(value) {
  const input = cleanText(value, 2048);
  if (!input) throw new Error("Enter a business website");
  let parsed;
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch (error) {
    throw new Error("Enter a valid business website");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Enter a valid business website");
  }
  if (parsed.username || parsed.password) throw new Error("Enter a valid business website");
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("Enter a valid business website");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function responseUrl(response, fallbackUrl) {
  return response?.request?.uri?.href || fallbackUrl;
}

async function fetchResource(url, options) {
  const remaining = options.deadline - Date.now();
  if (remaining <= 0) {
    const error = new Error("Website discovery timed out");
    error.code = "DISCOVERY_TIMEOUT";
    throw error;
  }
  const response = await options.requestFn({
    url,
    method: "GET",
    headers: {
      "Accept": options.accept,
      "User-Agent": USER_AGENT,
    },
    encoding: null,
    followRedirect: true,
    maxRedirects: 3,
    maximumResponseBytes: options.maximumBytes,
    resolveWithFullResponse: true,
    simple: false,
    timeout: remaining,
  }, {
    allowPrivateHost: false,
    allowedPorts: [80, 443],
    feature: "business_profile_discovery",
  });
  const statusCode = Number(response?.statusCode || 0);
  if (statusCode < 200 || statusCode >= 300) {
    const error = new Error("Website could not be read");
    error.code = "DISCOVERY_HTTP_ERROR";
    throw error;
  }
  const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body || "");
  const contentLength = Number(response.headers?.["content-length"] || body.length);
  if (contentLength > options.maximumBytes || body.length > options.maximumBytes) {
    const error = new Error("Website response is too large");
    error.code = "DISCOVERY_TOO_LARGE";
    throw error;
  }
  return {
    body,
    contentType: String(response.headers?.["content-type"] || "").toLowerCase(),
    url: responseUrl(response, url),
  };
}

async function fetchHtml(url, options) {
  const resource = await fetchResource(url, {
    ...options,
    accept: "text/html,application/xhtml+xml",
    maximumBytes: MAX_HTML_BYTES,
  });
  if (!resource.contentType.includes("text/html")
    && !resource.contentType.includes("application/xhtml+xml")) {
    const error = new Error("Website did not return HTML");
    error.code = "DISCOVERY_NOT_HTML";
    throw error;
  }
  return { ...resource, html: resource.body.toString("utf8") };
}

function parseRobotsGroups(text) {
  const groups = [];
  let group = null;
  String(text || "").split(/\r?\n/).forEach((line) => {
    const withoutComment = line.replace(/#.*$/, "").trim();
    if (!withoutComment) return;
    const separator = withoutComment.indexOf(":");
    if (separator < 0) return;
    const field = withoutComment.slice(0, separator).trim().toLowerCase();
    const value = withoutComment.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!group || group.hasRules) {
        group = { agents: [], disallow: [], hasRules: false };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (field === "disallow" && group) {
      group.hasRules = true;
      if (value) group.disallow.push(value);
    }
  });
  return groups;
}

function robotsAllows(robotsText, pathname) {
  const groups = parseRobotsGroups(robotsText);
  const exact = groups.filter((group) => group.agents.includes("chartbrewbusinessprofilebot"));
  const matching = exact.length ? exact : groups.filter((group) => group.agents.includes("*"));
  return !matching.some((group) => group.disallow.some((path) => pathname.startsWith(path)));
}

async function loadRobots(origin, options) {
  try {
    const resource = await fetchResource(new URL("/robots.txt", origin).toString(), {
      ...options,
      accept: "text/plain,*/*;q=0.1",
      maximumBytes: MAX_ROBOTS_BYTES,
    });
    return resource.body.toString("utf8");
  } catch (error) {
    return "";
  }
}

function selectAboutLinks(links, origin, robotsText) {
  const selected = [];
  links.forEach((link) => {
    if (selected.length >= 2) return;
    const parsed = new URL(link.href);
    if (parsed.origin !== origin) return;
    if (!/(about|company|who-we-are|our-story)/i.test(`${parsed.pathname} ${link.text || ""}`)) return;
    if (!robotsAllows(robotsText, parsed.pathname)) return;
    if (!selected.includes(parsed.toString())) selected.push(parsed.toString());
  });
  return selected;
}

function mergePageProfiles(pageProfiles) {
  const merged = {
    businessName: null, description: null, logoCandidates: [], metadata: {},
  };
  pageProfiles.forEach((profile) => {
    merged.businessName ||= profile.businessName;
    merged.description ||= profile.description;
    profile.logoCandidates.forEach((candidate) => {
      if (!merged.logoCandidates.includes(candidate)) merged.logoCandidates.push(candidate);
    });
    Object.entries(profile.metadata || {}).forEach(([field, value]) => {
      if (field === "socialLinks" || field === "keywords") {
        merged.metadata[field] = [...new Set([...(merged.metadata[field] || []), ...value])].slice(0, 10);
      } else if (!merged.metadata[field] && value) merged.metadata[field] = value;
    });
  });
  merged.metadata = sanitizeMetadata(merged.metadata);
  return merged;
}

async function downloadLogo(candidates, options) {
  for (const candidate of candidates.slice(0, 6)) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      const resource = await fetchResource(candidate, {
        ...options,
        accept: "image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon",
        maximumBytes: MAX_LOGO_BYTES,
      });
      const declaredMimeType = resource.contentType.split(";")[0].trim();
      const detectedMimeType = detectImageMimeType(resource.body);
      const declaredIsIcon = declaredMimeType === "image/x-icon"
        || declaredMimeType === "image/vnd.microsoft.icon";
      const declaredTypeMatches = declaredMimeType === detectedMimeType
        || (declaredIsIcon && detectedMimeType === "image/x-icon");
      if (detectedMimeType && ALLOWED_IMAGE_MIME_TYPES.has(declaredMimeType)
        && declaredTypeMatches) {
        return { mimeType: detectedMimeType, data: resource.body.toString("base64") };
      }
    } catch (error) {
      // Try the next logo.
    }
  }
  return null;
}

async function discoverBusinessProfile(websiteUrl, options = {}) {
  const requestFn = options.requestFn || safeRequest;
  const deadline = Date.now() + (options.timeoutMs || TOTAL_TIMEOUT_MS);
  const startUrl = normalizeWebsiteUrl(websiteUrl);
  const requestOptions = { deadline, requestFn };
  const home = await fetchHtml(startUrl, requestOptions);
  const canonicalUrl = normalizeWebsiteUrl(home.url);
  const origin = new URL(canonicalUrl).origin;
  const homeProfile = extractPageProfile(home.html, canonicalUrl);
  const robotsText = await loadRobots(origin, requestOptions);
  const aboutLinks = selectAboutLinks(homeProfile.aboutLinks, origin, robotsText);
  const pageProfiles = [homeProfile];
  for (const link of aboutLinks) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      const page = await fetchHtml(link, requestOptions);
      if (new URL(page.url).origin === origin) {
        pageProfiles.push(extractPageProfile(page.html, page.url));
      }
    } catch (error) {
      // The home page is sufficient.
    }
  }
  const merged = mergePageProfiles(pageProfiles);
  merged.logoCandidates.push(new URL("/favicon.ico", origin).toString());
  const logo = await downloadLogo(merged.logoCandidates, requestOptions);
  return {
    websiteUrl: canonicalUrl,
    domain: new URL(canonicalUrl).hostname.toLowerCase(),
    businessName: merged.businessName,
    description: merged.description,
    logo,
    metadata: merged.metadata,
  };
}

module.exports = {
  discoverBusinessProfile,
  extractPageProfile,
  normalizeWebsiteUrl,
  robotsAllows,
};
