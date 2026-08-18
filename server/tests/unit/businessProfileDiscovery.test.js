import {
  describe, expect, it, vi,
} from "vitest";

const {
  discoverBusinessProfile,
  extractPageProfile,
  normalizeWebsiteUrl,
  robotsAllows,
} = require("../../modules/teamOnboarding/businessProfileDiscovery");
const { sanitizeBusinessProfile } = require("../../modules/teamOnboarding/businessProfile");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function response(url, body, contentType = "text/html; charset=utf-8") {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    body: data,
    headers: {
      "content-length": `${data.length}`,
      "content-type": contentType,
    },
    request: { uri: { href: url } },
    statusCode: 200,
  };
}

describe("business profile discovery", () => {
  it("uses structured business data before Open Graph and reads bounded profile pages", async () => {
    const homeHtml = `
      <html lang="en"><head><title>Fallback title</title>
      <meta property="og:site_name" content="Open Graph name">
      <meta property="og:description" content="Open Graph description">
      <meta name="theme-color" content="#1455d9">
      <script type="application/ld+json">{
        "@type":"Organization","name":"Structured Business",
        "description":"Structured description","industry":"Business intelligence",
        "logo":"/brand.png"
      }</script></head><body>
      <a href="/about">About our company</a>
      <a href="https://www.linkedin.com/company/structured-business">LinkedIn</a>
      </body></html>`;
    const aboutHtml = `<html><head><meta name="keywords" content="analytics, dashboards"></head>
      <body>Raw page text must not be saved.</body></html>`;
    const requestFn = vi.fn(async (options, policy) => {
      expect(policy.allowPrivateHost).toBe(false);
      if (options.url === "https://example.com/") return response(options.url, homeHtml);
      if (options.url === "https://example.com/robots.txt") {
        return response(options.url, "User-agent: *\nDisallow:", "text/plain");
      }
      if (options.url === "https://example.com/about") return response(options.url, aboutHtml);
      if (options.url === "https://example.com/brand.png") {
        return response(options.url, PNG, "image/png");
      }
      throw new Error(`Unexpected request: ${options.url}`);
    });
    const profile = await discoverBusinessProfile("example.com", { requestFn });
    expect(profile).toMatchObject({
      businessName: "Structured Business",
      description: "Structured description",
      domain: "example.com",
      logo: { data: PNG.toString("base64"), mimeType: "image/png" },
      metadata: {
        industry: "Business intelligence",
        language: "en",
        socialLinks: ["https://www.linkedin.com/company/structured-business"],
        themeColor: "#1455d9",
      },
      websiteUrl: "https://example.com/",
    });
    expect(JSON.stringify(profile)).not.toContain("Raw page text");
    expect(requestFn).toHaveBeenCalledTimes(4);
  });

  it("does not read profile pages that robots.txt disallows", async () => {
    const requestFn = vi.fn(async (options) => {
      if (options.url === "https://example.com/") {
        return response(options.url, "<html><a href='/about'>About</a></html>");
      }
      if (options.url === "https://example.com/robots.txt") {
        return response(options.url, "User-agent: *\nDisallow: /about", "text/plain");
      }
      if (options.url === "https://example.com/favicon.ico") {
        return response(options.url, PNG, "image/png");
      }
      throw new Error("A disallowed page was requested");
    });
    await discoverBusinessProfile("https://example.com", { requestFn });
    expect(requestFn.mock.calls.map(([options]) => options.url))
      .not.toContain("https://example.com/about");
  });

  it("rejects credentials, unsafe ports, oversized HTML, and non-HTML pages", async () => {
    expect(() => normalizeWebsiteUrl("https://user:pass@example.com"))
      .toThrow("Enter a valid business website");
    expect(() => normalizeWebsiteUrl("https://example.com:8080"))
      .toThrow("Enter a valid business website");
    await expect(discoverBusinessProfile("example.com", {
      requestFn: async (options) => ({
        ...response(options.url, "ok"),
        headers: { "content-length": `${1024 * 1024 + 1}`, "content-type": "text/html" },
      }),
    })).rejects.toMatchObject({ code: "DISCOVERY_TOO_LARGE" });
    await expect(discoverBusinessProfile("example.com", {
      requestFn: async (options) => response(options.url, "{}", "application/json"),
    })).rejects.toMatchObject({ code: "DISCOVERY_NOT_HTML" });
    await expect(discoverBusinessProfile("http://127.0.0.1"))
      .rejects.toMatchObject({ code: "SSRF_BLOCKED", reason: "private_network" });
  });

  it("sanitizes approved metadata and validates stored image bytes", () => {
    const profile = sanitizeBusinessProfile({
      businessName: "  Acme   Analytics  ",
      domain: "EXAMPLE.COM",
      logo: { data: PNG.toString("base64"), mimeType: "image/png" },
      metadata: { ignored: "raw", keywords: ["analytics", "analytics", "reporting"] },
      websiteUrl: "example.com?tracking=1",
    });
    expect(profile).toMatchObject({
      businessName: "Acme Analytics",
      domain: "example.com",
      logoMimeType: "image/png",
      metadata: { keywords: ["analytics", "reporting"] },
      websiteUrl: "https://example.com/",
    });
    expect(profile.metadata).not.toHaveProperty("ignored");
    expect(() => sanitizeBusinessProfile({
      logo: { data: Buffer.from("<svg></svg>").toString("base64"), mimeType: "image/png" },
    })).toThrow("Invalid business logo");
  });

  it("extracts standard metadata without executing page scripts", () => {
    const profile = extractPageProfile(`
      <html lang="fr"><head><title>Example</title>
      <meta name="description" content="A clear description">
      <link rel="icon" href="/favicon.ico"></head></html>
    `, "https://example.com/");
    expect(profile).toMatchObject({
      businessName: "Example",
      description: "A clear description",
      logoCandidates: ["https://example.com/favicon.ico"],
      metadata: { language: "fr", siteTitle: "Example" },
    });
    expect(robotsAllows("User-agent: *\nDisallow: /private", "/private/about")).toBe(false);
  });
});
