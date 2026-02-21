import { describe, expect, it } from "vitest";

const {
  MAX_LOGO_UPLOAD_SIZE_BYTES,
  buildSafeLogoFilename,
  isAllowedLogoMimeType,
  isValidLogoImageBuffer,
  resolveSafeUploadPath,
} = require("../../modules/logoUploadSecurity");

describe("logoUploadSecurity", () => {
  it("allows expected logo mime types", () => {
    expect(isAllowedLogoMimeType("image/png")).toBe(true);
    expect(isAllowedLogoMimeType("image/jpeg")).toBe(true);
    expect(isAllowedLogoMimeType("image/jpg")).toBe(true);
    expect(isAllowedLogoMimeType("image/webp")).toBe(true);
    expect(isAllowedLogoMimeType("image/svg+xml")).toBe(true);
    expect(isAllowedLogoMimeType("text/html")).toBe(false);
  });

  it("detects valid image signatures", () => {
    const pngBuffer = Buffer.from(
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]
    );
    const jpegBuffer = Buffer.from(
      [0xFF, 0xD8, 0xFF, 0xEE, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    );
    const gifBuffer = Buffer.from("GIF89a123456", "ascii");
    const webpBuffer = Buffer.from("RIFF1234WEBPVP8 ", "ascii");
    const svgBuffer = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "utf8");

    expect(isValidLogoImageBuffer(pngBuffer, "image/png")).toBe(true);
    expect(isValidLogoImageBuffer(jpegBuffer, "image/jpeg")).toBe(true);
    expect(isValidLogoImageBuffer(gifBuffer, "image/gif")).toBe(true);
    expect(isValidLogoImageBuffer(webpBuffer, "image/webp")).toBe(true);
    expect(isValidLogoImageBuffer(svgBuffer, "image/svg+xml")).toBe(true);
  });

  it("rejects spoofed payloads", () => {
    const htmlBuffer = Buffer.from("<html><script>alert(1)</script></html>", "utf8");

    expect(isValidLogoImageBuffer(htmlBuffer, "image/png")).toBe(false);
    expect(isValidLogoImageBuffer(htmlBuffer, "image/jpeg")).toBe(false);
  });

  it("rejects unsafe svg content", () => {
    const unsafeSvg = Buffer.from("<svg><script>alert(1)</script></svg>", "utf8");
    const unsafeSvgWithHandler = Buffer.from("<svg onload=\"alert(1)\"></svg>", "utf8");

    expect(isValidLogoImageBuffer(unsafeSvg, "image/svg+xml")).toBe(false);
    expect(isValidLogoImageBuffer(unsafeSvgWithHandler, "image/svg+xml")).toBe(false);
  });

  it("builds safe filenames from server-side IDs only", () => {
    const fileName = buildSafeLogoFilename("image/png", () => "abc123");
    const svgFileName = buildSafeLogoFilename("image/svg+xml", () => "xyz789");
    expect(fileName).toBe("abc123.png");
    expect(svgFileName).toBe("xyz789.svg");
  });

  it("rejects upload paths escaping the upload root", () => {
    const safePath = resolveSafeUploadPath("/tmp/uploads", "logo.png");
    const unsafePath = resolveSafeUploadPath("/tmp/uploads", "../../etc/passwd");

    expect(safePath).toBe("/tmp/uploads/logo.png");
    expect(unsafePath).toBeNull();
  });

  it("uses a bounded upload size", () => {
    expect(MAX_LOGO_UPLOAD_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});
