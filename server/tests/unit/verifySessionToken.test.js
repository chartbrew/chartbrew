import { createRequire } from "module";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";

const require = createRequire(import.meta.url);
const verifySessionToken = require("../../modules/verifySessionToken.js");

describe("verifySessionToken", () => {
  it("accepts HS256 tokens signed with the session encryption key", () => {
    const token = jwt.sign({ id: 42 }, process.env.CB_ENCRYPTION_KEY_DEV, { algorithm: "HS256" });

    expect(verifySessionToken(token).id).toBe(42);
  });

  it("rejects tokens signed with the legacy secret", () => {
    const token = jwt.sign({ id: 42 }, process.env.CB_SECRET_DEV, { algorithm: "HS256" });

    expect(() => verifySessionToken(token)).toThrow("invalid signature");
  });

  it("rejects session tokens using an unexpected algorithm", () => {
    const token = jwt.sign({ id: 42 }, process.env.CB_ENCRYPTION_KEY_DEV, { algorithm: "HS384" });

    expect(() => verifySessionToken(token)).toThrow("invalid algorithm");
  });
});
