import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const dnsPromises = require("dns").promises;
const {
  getGlobalAllowPrivateNetworkCalls,
  parseStrictBoolean,
  validateOutboundUrl,
} = require("../../modules/outboundTargetPolicy");

describe("outboundTargetPolicy", () => {
  const originalEnvValue = process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS;

  beforeEach(() => {
    delete process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS;
  });

  afterEach(() => {
    if (originalEnvValue === undefined) {
      delete process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS;
    } else {
      process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS = originalEnvValue;
    }
    vi.restoreAllMocks();
  });

  it("parses strict booleans and falls back to null for invalid values", () => {
    expect(parseStrictBoolean("true")).toBe(true);
    expect(parseStrictBoolean("1")).toBe(true);
    expect(parseStrictBoolean("false")).toBe(false);
    expect(parseStrictBoolean("0")).toBe(false);
    expect(parseStrictBoolean("yes")).toBeNull();
  });

  it("defaults to deny private network calls when env var is missing", () => {
    expect(getGlobalAllowPrivateNetworkCalls()).toBe(false);
  });

  it("allows public literal IP targets", async () => {
    const result = await validateOutboundUrl("https://8.8.8.8");
    expect(result.hostname).toBe("8.8.8.8");
    expect(result.allowPrivateHost).toBe(false);
  });

  it("blocks private literal IP targets by default", async () => {
    await expect(validateOutboundUrl("http://10.0.0.12")).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "private_network",
    });
  });

  it("allows private literal IP targets when global policy allows them", async () => {
    process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS = "true";
    const result = await validateOutboundUrl("http://10.0.0.12");
    expect(result.allowPrivateHost).toBe(true);
  });

  it("uses per-connection override before global env default", async () => {
    process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS = "true";
    await expect(validateOutboundUrl("http://10.0.0.12", { allowPrivateHost: false })).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "private_network",
    });

    process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS = "false";
    const result = await validateOutboundUrl("http://10.0.0.12", { allowPrivateHost: true });
    expect(result.allowPrivateHost).toBe(true);
  });

  it("blocks metadata endpoints regardless of private-host policy", async () => {
    process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS = "true";
    await expect(validateOutboundUrl("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "metadata_endpoint",
    });

    await expect(validateOutboundUrl("http://metadata.google.internal/computeMetadata/v1")).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "metadata_endpoint",
    });
  });

  it("blocks hostname targets that resolve to private IP ranges", async () => {
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "10.0.0.5", family: 4 },
    ]);

    await expect(validateOutboundUrl("https://api.example.com/v1")).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
      reason: "private_network",
    });
  });
});
