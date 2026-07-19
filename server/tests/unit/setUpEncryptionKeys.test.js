const fs = require("fs");
const os = require("os");
const path = require("path");
const { describe, expect, it } = require("vitest");

const setUpEncryptionKeys = require("../../modules/setUpEncryptionKeys");
const {
  generatePassword,
  setEnvDefault,
} = require("../../modules/setUpEncryptionKeys");

describe("setUpEncryptionKeys helpers", () => {
  it("generates strong URL-safe BullMQ passwords", () => {
    const firstPassword = generatePassword();
    const secondPassword = generatePassword();

    expect(firstPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(secondPassword).not.toBe(firstPassword);
  });

  it("fills an empty environment variable without replacing existing values", () => {
    const generated = setEnvDefault("CB_BULLMQ_PASSWORD=\n", "CB_BULLMQ_PASSWORD", "generated");
    const existing = setEnvDefault(generated.data, "CB_BULLMQ_PASSWORD", "replacement");

    expect(generated.data).toBe("CB_BULLMQ_PASSWORD=generated\n");
    expect(generated.updated).toBe(true);
    expect(existing.value).toBe("generated");
    expect(existing.updated).toBe(false);
  });

  it("persists generated credentials for first startup", () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "chartbrew-secrets-"));
    const envPath = path.join(temporaryDirectory, ".env");

    try {
      fs.writeFileSync(envPath, [
        "CB_ENCRYPTION_KEY=",
        "CB_ENCRYPTION_KEY_DEV=",
        "CB_BULLMQ_USERNAME=",
        "CB_BULLMQ_PASSWORD=",
        "",
      ].join("\n"));

      setUpEncryptionKeys(envPath);

      const generatedEnv = fs.readFileSync(envPath, "utf8");
      expect(generatedEnv).toMatch(/^CB_ENCRYPTION_KEY=[a-f0-9]{64}$/m);
      expect(generatedEnv).toMatch(/^CB_ENCRYPTION_KEY_DEV=[a-f0-9]{64}$/m);
      expect(generatedEnv).toMatch(/^CB_BULLMQ_USERNAME=chartbrew$/m);
      expect(generatedEnv).toMatch(/^CB_BULLMQ_PASSWORD=[A-Za-z0-9_-]{32}$/m);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
