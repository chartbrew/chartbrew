import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = `
  const assert = require("node:assert/strict");
  const settings = require("./settings");
  const config = require("./models/config/config");
  const { encrypt, decrypt, checkEncryptionKeys } = require("./modules/cbCrypto");
  const { getRedisOptions, hasRedisOverrides } = require("./redisConnection");
  assert.equal(settings.client, "https://client.example");
  assert.equal(settings.secret, "test-secret");
  assert.equal(config[process.env.NODE_ENV].database, "chartbrew_test");
  assert.equal(getRedisOptions().host, "redis.example");
  assert.equal(hasRedisOverrides("CB_RUNTIME_REDIS"), true);
  assert.equal(getRedisOptions("CB_RUNTIME_REDIS").host, "cache.example");
  checkEncryptionKeys();
  assert.equal(decrypt(encrypt("saved credential")), "saved credential");
`;

describe("environment settings", () => {
  it.each(["development", "test", "production"])("uses the same variable names in %s", (mode) => {
    expect(() => execFileSync(process.execPath, ["-e", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: mode,
        CB_DB_NAME: "chartbrew_test",
        CB_SECRET: "test-secret",
        CB_ENCRYPTION_KEY: "01".repeat(32),
        VITE_APP_CLIENT_HOST: "https://client.example",
        CB_REDIS_HOST: "redis.example",
        CB_RUNTIME_REDIS_HOST: "cache.example",
      },
      stdio: "pipe",
    })).not.toThrow();
  });

  it.each(["development", "test", "production"])("rejects an invalid encryption key in %s", (mode) => {
    const result = spawnSync(process.execPath, ["-e", 'require("./modules/cbCrypto").checkEncryptionKeys()'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: mode, CB_ENCRYPTION_KEY: "invalid" },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid AES-256 encryption key in CB_ENCRYPTION_KEY");
  });
});
