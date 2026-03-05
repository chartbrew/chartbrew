import { describe, expect, it } from "vitest";

const { sanitizeOutboundRequestOptions } = require("../../modules/sanitizeOutboundRequestOptions");

function captureError(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

describe("sanitizeOutboundRequestOptions", () => {
  it("removes forwarded headers and strips matching Host header", () => {
    const sanitized = sanitizeOutboundRequestOptions({
      url: "https://api.example.com/resource",
      method: "GET",
      headers: {
        "X-Forwarded-Host": "proxy.internal",
        "X-Forwarded-For": "1.1.1.1",
        Forwarded: "for=1.1.1.1;host=proxy.internal",
        Host: "api.example.com",
        Authorization: "Bearer token",
      },
    });

    expect(sanitized.headers.Authorization).toBe("Bearer token");
    expect(sanitized.headers.Host).toBeUndefined();
    expect(sanitized.headers["X-Forwarded-Host"]).toBeUndefined();
    expect(sanitized.headers.Forwarded).toBeUndefined();
  });

  it("rejects mismatched Host header authority", () => {
    const error = captureError(() => {
      sanitizeOutboundRequestOptions({
        url: "https://api.example.com/resource",
        headers: {
          Host: "evil.example.com",
        },
      });
    });

    expect(error).toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "host_header_mismatch",
    });
  });

  it("rejects disallowed outbound request options", () => {
    const proxyError = captureError(() => {
      sanitizeOutboundRequestOptions({
        url: "https://api.example.com/resource",
        proxy: "http://localhost:3128",
      });
    });

    expect(proxyError).toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "disallowed_request_option",
    });

    const baseUrlError = captureError(() => {
      sanitizeOutboundRequestOptions({
        url: "https://api.example.com/resource",
        baseUrl: "https://api.example.com",
      });
    });

    expect(baseUrlError).toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "disallowed_request_option",
    });
  });

  it("requires absolute URLs", () => {
    const error = captureError(() => {
      sanitizeOutboundRequestOptions({
        url: "/relative/path",
      });
    });

    expect(error).toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "invalid_url",
    });
  });
});
