import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const dnsPromises = require("dns").promises;
const {
  validateOutboundUrl,
} = require("../../modules/outboundTargetPolicy");

// NAT64 / DNS64 coverage: on an IPv6-only / DNS64 deployment the resolver
// synthesizes AAAA records that embed an IPv4 address in the low 32 bits of a
// NAT64 prefix (RFC 6052 well-known 64:ff9b::/96, RFC 8215 local-use
// 64:ff9b:1::/48). The guard must treat the embedded IPv4 the same as a literal.
describe("outboundTargetPolicy NAT64/DNS64 SSRF coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks NAT64 local-use (64:ff9b:1::/48) metadata addresses", async () => {
    // 64:ff9b:1::a9fe:a9fe -> a9fe:a9fe -> 169.254.169.254
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "64:ff9b:1::a9fe:a9fe", family: 6 },
    ]);

    await expect(
      validateOutboundUrl("http://nat64-metadata-local.example/latest/meta-data/", {
        allowPrivateHost: false,
      })
    ).rejects.toMatchObject({ code: "SSRF_BLOCKED", reason: "metadata_endpoint" });
  });

  it("blocks NAT64 well-known (64:ff9b::/96) metadata addresses", async () => {
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "64:ff9b::a9fe:a9fe", family: 6 },
    ]);

    await expect(
      validateOutboundUrl("http://nat64-metadata-wk.example/latest/meta-data/", {
        allowPrivateHost: false,
      })
    ).rejects.toMatchObject({ code: "SSRF_BLOCKED", reason: "metadata_endpoint" });
  });

  it("blocks NAT64-embedded RFC 1918 addresses", async () => {
    // 64:ff9b:1::0a00:0001 -> 0a00:0001 -> 10.0.0.1
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "64:ff9b:1::0a00:0001", family: 6 },
    ]);

    await expect(
      validateOutboundUrl("http://nat64-rfc1918.example/", { allowPrivateHost: false })
    ).rejects.toMatchObject({ code: "SSRF_BLOCKED", reason: "private_network" });
  });

  it("still allows genuine public IPv6 targets", async () => {
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);

    const result = await validateOutboundUrl("http://public-v6.example/", {
      allowPrivateHost: false,
    });
    expect(result.resolvedAddresses).toContain("2606:2800:220:1:248:1893:25c8:1946");
  });
});