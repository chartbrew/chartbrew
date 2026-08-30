import { describe, expect, it } from "vitest";

const { validateImageUserToken } = require("../../modules/chartImage/imageAuthentication");

describe("chart image authentication", () => {
  it("accepts a bounded user session", () => {
    expect(validateImageUserToken({
      email: "user@example.com",
      exp: 2_678_400,
      iat: 0,
      id: 2,
    })).toBe(true);
  });

  it("rejects legacy API key lifetimes", () => {
    expect(validateImageUserToken({ exp: 400_000_000_000, iat: 1_000, id: 2 })).toBe(false);
  });

  it.each([
    { id: 2, tokenType: "api_key" },
    { id: 2, tokenType: "share" },
    { id: 2, sub: { id: 7, type: "Chart" } },
  ])("rejects non-session token claims: %j", (decoded) => {
    expect(validateImageUserToken({ exp: 2_000, iat: 1_000, ...decoded })).toBe(false);
  });

  it("rejects tokens without a bounded issued-at and expiry pair", () => {
    expect(validateImageUserToken({ id: 2 })).toBe(false);
    expect(validateImageUserToken({ exp: 1_000, iat: 1_000, id: 2 })).toBe(false);
  });

  it("rejects signed tokens that are not login sessions", () => {
    expect(validateImageUserToken({
      email: "user@example.com",
      exp: 2_000,
      iat: 1_000,
      id: 2,
      newEmail: "new@example.com",
    })).toBe(false);
  });
});
