import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const verifyDataApiKey = require("../../modules/verifyDataApiKey.js");

describe("verifyDataApiKey helpers", () => {
  it("accepts only the required API-key claims", () => {
    expect(verifyDataApiKey.hasRequiredClaims({
      id: 1,
      apiKeyId: "key-id",
      teamId: 2,
      tokenType: "api_key",
    })).toBe(true);
    expect(verifyDataApiKey.hasRequiredClaims({ id: 1, teamId: 2 })).toBe(false);
    expect(verifyDataApiKey.hasRequiredClaims({
      id: 1,
      apiKeyId: "key-id",
      teamId: 2,
      tokenType: "share",
    })).toBe(false);
  });

  it("rejects malformed and repeated bearer headers", () => {
    expect(verifyDataApiKey.readBearerToken({
      rawHeaders: ["Authorization", "Bearer token"],
      headers: {},
    })).toBe("token");
    expect(verifyDataApiKey.readBearerToken({
      rawHeaders: ["Authorization", "Bearer one", "Authorization", "Bearer two"],
      headers: {},
    })).toBe(null);
    expect(verifyDataApiKey.readBearerToken({
      rawHeaders: ["Authorization", "Bearer token extra"],
      headers: {},
    })).toBe(null);
  });

  it("compares token digests without comparing variable-length token buffers", () => {
    expect(verifyDataApiKey.tokensMatch("same-token", "same-token")).toBe(true);
    expect(verifyDataApiKey.tokensMatch("same-token", "other-token")).toBe(false);
    expect(verifyDataApiKey.tokensMatch("short", "a-much-longer-token")).toBe(false);
  });
});
