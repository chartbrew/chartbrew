const dns = require("dns").promises;
const net = require("net");

const {
  incrementSecurityCounter,
  logOutboundSecurityEvent,
} = require("./outboundSecurityAudit");

const PRIVATE_IPV4_BLOCKLIST = new net.BlockList();
[
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].forEach(([address, prefix]) => {
  PRIVATE_IPV4_BLOCKLIST.addSubnet(address, prefix, "ipv4");
});

const PRIVATE_IPV6_BLOCKLIST = new net.BlockList();
[
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
].forEach(([address, prefix]) => {
  PRIVATE_IPV6_BLOCKLIST.addSubnet(address, prefix, "ipv6");
});

const METADATA_HOSTNAMES = new Set([
  "metadata",
  "metadata.google.internal",
  "metadata.google.internal.",
  "metadata.azure.internal",
]);

const METADATA_IP_ADDRESSES = new Set([
  "169.254.169.254",
  "100.100.100.200",
  "fd00:ec2::254",
]);

class OutboundPolicyError extends Error {
  constructor(reason, message, details = {}) {
    super(message);
    this.name = "OutboundPolicyError";
    this.code = "SSRF_BLOCKED";
    this.reason = reason;
    this.statusCode = 400;

    Object.assign(this, details);
  }
}

function isOutboundPolicyError(error) {
  return !!error && error.code === "SSRF_BLOCKED";
}

function serializeOutboundPolicyError(error) {
  if (!isOutboundPolicyError(error)) return null;

  return {
    code: error.code,
    reason: error.reason,
    message: error.message,
  };
}

function parseStrictBoolean(value) {
  if (value === undefined || value === null || value === "") return null;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;

  return null;
}

let loggedInvalidAllowPrivateValue = false;

function getGlobalAllowPrivateNetworkCalls() {
  const rawValue = process.env.CB_ALLOW_PRIVATE_NETWORK_CALLS;
  const parsedValue = parseStrictBoolean(rawValue);

  if (parsedValue === null) {
    if (rawValue !== undefined && rawValue !== null && rawValue !== "" && !loggedInvalidAllowPrivateValue) {
      loggedInvalidAllowPrivateValue = true;
      // Invalid values are treated as deny-by-default.
      console.warn("[outboundTargetPolicy] Invalid CB_ALLOW_PRIVATE_NETWORK_CALLS value. Expected true/1/false/0. Falling back to false."); // oxlint-disable-line no-console
    }
    return false;
  }

  return parsedValue;
}

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

function normalizeIpAddress(address) {
  return String(address || "")
    .trim()
    .toLowerCase();
}

function isMetadataHostname(hostname) {
  return METADATA_HOSTNAMES.has(hostname);
}

function isMetadataAddress(address) {
  if (METADATA_IP_ADDRESSES.has(address)) return true;

  if (address.startsWith("::ffff:")) {
    const mappedIpv4 = address.replace("::ffff:", "");
    return METADATA_IP_ADDRESSES.has(mappedIpv4);
  }

  return false;
}

function getMappedIpv4(address) {
  if (!address.startsWith("::ffff:")) return null;
  const mappedIpv4 = address.replace("::ffff:", "");
  return net.isIP(mappedIpv4) === 4 ? mappedIpv4 : null;
}

function isPrivateOrReservedAddress(address) {
  const mappedIpv4 = getMappedIpv4(address);
  if (mappedIpv4) {
    return PRIVATE_IPV4_BLOCKLIST.check(mappedIpv4, "ipv4");
  }

  const family = net.isIP(address);
  if (family === 4) {
    return PRIVATE_IPV4_BLOCKLIST.check(address, "ipv4");
  }
  if (family === 6) {
    return PRIVATE_IPV6_BLOCKLIST.check(address, "ipv6");
  }
  return false;
}

function createPolicyLogPayload(url, context, reason, extra = {}) {
  return {
    reason,
    targetUrl: url,
    source: context.source || "api_request",
    teamId: context.teamId || null,
    connectionId: context.connectionId || null,
    userId: context.userId || null,
    ...extra,
  };
}

function createPolicyError(reason, message, url, context, extra = {}) {
  incrementSecurityCounter("ssrf_blocked_total");
  if (reason === "metadata_endpoint") {
    incrementSecurityCounter("metadata_blocked_total");
  }

  logOutboundSecurityEvent(
    createPolicyLogPayload(url, context, reason, extra)
  );

  return new OutboundPolicyError(reason, message, extra);
}

function resolveAllowPrivateHost(context = {}) {
  if (typeof context.allowPrivateHost === "boolean") {
    return context.allowPrivateHost;
  }

  return getGlobalAllowPrivateNetworkCalls();
}

async function resolveTargetAddresses(hostname) {
  const addresses = [];
  const ipFamily = net.isIP(hostname);

  if (ipFamily) {
    addresses.push({
      address: normalizeIpAddress(hostname),
      family: ipFamily,
    });
    return addresses;
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
    resolved.forEach((entry) => {
      const family = net.isIP(entry.address);
      if (!family) return;

      addresses.push({
        address: normalizeIpAddress(entry.address),
        family,
      });
    });
  } catch (error) {
    // Let downstream network errors surface naturally if DNS fails.
  }

  return addresses;
}

async function validateOutboundUrl(targetUrl, context = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (error) {
    throw createPolicyError(
      "invalid_url",
      "Invalid outbound URL provided.",
      targetUrl,
      context
    );
  }

  const protocol = (parsedUrl.protocol || "").toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw createPolicyError(
      "invalid_scheme",
      "Only http and https outbound URLs are allowed.",
      targetUrl,
      context
    );
  }

  const normalizedHostname = normalizeHostname(parsedUrl.hostname);
  if (!normalizedHostname) {
    throw createPolicyError(
      "invalid_url",
      "Outbound URL must include a hostname.",
      targetUrl,
      context
    );
  }

  if (isMetadataHostname(normalizedHostname)) {
    throw createPolicyError(
      "metadata_endpoint",
      "Requests to cloud metadata endpoints are blocked.",
      targetUrl,
      context,
      { hostname: normalizedHostname }
    );
  }

  const allowPrivateHost = resolveAllowPrivateHost(context);
  const resolvedAddresses = await resolveTargetAddresses(normalizedHostname);

  let privateAddressMatched = false;
  for (const resolvedAddress of resolvedAddresses) {
    if (isMetadataAddress(resolvedAddress.address)) {
      throw createPolicyError(
        "metadata_endpoint",
        "Requests to cloud metadata endpoints are blocked.",
        targetUrl,
        context,
        { hostname: normalizedHostname, address: resolvedAddress.address }
      );
    }

    if (isPrivateOrReservedAddress(resolvedAddress.address)) {
      privateAddressMatched = true;
      if (!allowPrivateHost) {
        throw createPolicyError(
          "private_network",
          "Requests to private or reserved network ranges are blocked.",
          targetUrl,
          context,
          { hostname: normalizedHostname, address: resolvedAddress.address }
        );
      }
    }
  }

  if (privateAddressMatched && allowPrivateHost) {
    incrementSecurityCounter("private_target_allowed_total");
  }

  return {
    url: parsedUrl.toString(),
    hostname: normalizedHostname,
    allowPrivateHost,
    resolvedAddresses: resolvedAddresses.map((entry) => entry.address),
  };
}

module.exports = {
  OutboundPolicyError,
  isOutboundPolicyError,
  serializeOutboundPolicyError,
  parseStrictBoolean,
  getGlobalAllowPrivateNetworkCalls,
  validateOutboundUrl,
};
