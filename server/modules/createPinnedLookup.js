const net = require("net");

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

function createLookupError(hostname) {
  const error = new Error(`Validated DNS resolution not available for ${hostname}.`);
  error.code = "ENOTFOUND";
  error.hostname = hostname;
  return error;
}

function createPinnedLookup(expectedHostname, resolvedAddresses = []) {
  const normalizedExpectedHostname = normalizeHostname(expectedHostname);
  const candidates = resolvedAddresses
    .map((address) => ({
      address,
      family: net.isIP(address),
    }))
    .filter((entry) => entry.family);

  return (hostname, options, callback) => {
    const lookupOptions = typeof options === "function" ? {} : options || {};
    const cb = typeof options === "function" ? options : callback;
    const normalizedHostname = normalizeHostname(hostname);

    if (!cb) return;

    if (normalizedHostname !== normalizedExpectedHostname) {
      process.nextTick(() => cb(createLookupError(hostname)));
      return;
    }

    const requestedFamily = Number(lookupOptions.family) || 0;
    const matches = requestedFamily
      ? candidates.filter((entry) => entry.family === requestedFamily)
      : candidates;

    if (matches.length === 0) {
      process.nextTick(() => cb(createLookupError(hostname)));
      return;
    }

    process.nextTick(() => {
      if (lookupOptions.all) {
        cb(null, matches.map((entry) => ({ ...entry })));
        return;
      }

      cb(null, matches[0].address, matches[0].family);
    });
  };
}

module.exports = createPinnedLookup;
