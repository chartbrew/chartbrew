import { createRequire } from "module";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const {
  signLegacyShareToken,
  signShareToken,
  validateShareTokenPolicy,
  verifyShareToken,
} = require("../../modules/shareToken.js");
const settings = require("../../settings-dev.js");

const sharePolicy = {
  id: 7,
  entity_type: "Chart",
  entity_id: 42,
  visibility: "private",
};

describe("shareToken", () => {
  it("signs and verifies HS256 tokens with the generated encryption key", () => {
    const token = signShareToken(
      { sub: { type: "Chart", id: 42, sharePolicyId: 7 } },
      { expiresIn: "1h" }
    );
    const decodedToken = verifyShareToken(token);

    expect(decodedToken.sub).toEqual({ type: "Chart", id: 42, sharePolicyId: 7 });
    expect(() => validateShareTokenPolicy(decodedToken, sharePolicy, "Chart", 42)).not.toThrow();
  });

  it("accepts legacy tokens only when compatibility is enabled", () => {
    const previousValue = settings.allowLegacyShareTokens;
    settings.allowLegacyShareTokens = true;

    try {
      const token = signLegacyShareToken(
        { sub: { type: "Chart", id: 42, sharePolicyId: 7 } }
      );

      expect(verifyShareToken(token).sub).toEqual({ type: "Chart", id: 42, sharePolicyId: 7 });
    } finally {
      settings.allowLegacyShareTokens = previousValue;
    }
  });

  it("does not sign legacy tokens when compatibility is disabled", () => {
    const previousValue = settings.allowLegacyShareTokens;
    settings.allowLegacyShareTokens = false;

    try {
      expect(() => signLegacyShareToken(
        { sub: { type: "Chart", id: 42, sharePolicyId: 7 } }
      )).toThrow("Legacy share tokens are disabled");
    } finally {
      settings.allowLegacyShareTokens = previousValue;
    }
  });

  it("rejects legacy tokens when compatibility is disabled", () => {
    const token = jwt.sign(
      { sub: { type: "Chart", id: 42, sharePolicyId: 7 } },
      process.env.CB_SECRET_DEV,
      { algorithm: "HS256" }
    );
    const previousValue = settings.allowLegacyShareTokens;
    settings.allowLegacyShareTokens = false;

    try {
      expect(() => verifyShareToken(token)).toThrow("invalid signature");
    } finally {
      settings.allowLegacyShareTokens = previousValue;
    }
  });

  it("rejects unexpected algorithms", () => {
    const token = jwt.sign(
      { sub: { type: "Chart", id: 42, sharePolicyId: 7 } },
      process.env.CB_ENCRYPTION_KEY_DEV,
      { algorithm: "HS384" }
    );

    expect(() => verifyShareToken(token)).toThrow("invalid algorithm");
  });

  it("rejects tokens bound to another policy", () => {
    const token = signShareToken({ sub: { type: "Chart", id: 42, sharePolicyId: 8 } });
    const decodedToken = verifyShareToken(token);

    expect(() => validateShareTokenPolicy(decodedToken, sharePolicy, "Chart", 42))
      .toThrow("Invalid share token");
  });

  it("rejects disabled or expired policies", () => {
    const token = signShareToken({ sub: { type: "Chart", id: 42, sharePolicyId: 7 } });
    const decodedToken = verifyShareToken(token);

    expect(() => validateShareTokenPolicy(
      decodedToken,
      { ...sharePolicy, visibility: "disabled" },
      "Chart",
      42
    )).toThrow("Share policy is disabled");
    expect(() => validateShareTokenPolicy(
      decodedToken,
      { ...sharePolicy, expires_at: new Date(Date.now() - 1000) },
      "Chart",
      42
    )).toThrow("Share policy has expired");
  });
});
