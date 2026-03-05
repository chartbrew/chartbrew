const { OutboundPolicyError } = require("./outboundTargetPolicy");

const DISALLOWED_OPTION_KEYS = [
  "baseUrl",
  "baseURL",
  "uri",
  "proxy",
  "tunnel",
  "agent",
  "agentClass",
  "agentOptions",
  "httpAgent",
  "httpsAgent",
  "pool",
  "forever",
  "localAddress",
];

function defaultPortForProtocol(protocol) {
  return protocol === "https:" ? "443" : "80";
}

function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

function normalizeAuthority(hostname, port, protocol) {
  return `${normalizeHostname(hostname)}:${port || defaultPortForProtocol(protocol)}`;
}

function normalizeHostHeaderAuthority(hostHeader, protocol) {
  const parsedHost = new URL(`${protocol}//${hostHeader}`);
  return normalizeAuthority(parsedHost.hostname, parsedHost.port, protocol);
}

function sanitizeOutboundHeaders(headers, parsedUrl) {
  const sanitizedHeaders = {};
  let hostHeaderValue;

  Object.keys(headers || {}).forEach((headerName) => {
    const lowerHeaderName = headerName.toLowerCase();

    if (lowerHeaderName === "forwarded" || lowerHeaderName.startsWith("x-forwarded-")) {
      return;
    }

    if (lowerHeaderName === ":authority") {
      return;
    }

    if (lowerHeaderName === "host") {
      hostHeaderValue = headers[headerName];
      return;
    }

    sanitizedHeaders[headerName] = headers[headerName];
  });

  if (hostHeaderValue !== undefined && hostHeaderValue !== null && hostHeaderValue !== "") {
    const expectedAuthority = normalizeAuthority(
      parsedUrl.hostname,
      parsedUrl.port,
      parsedUrl.protocol
    );
    let suppliedAuthority;
    try {
      suppliedAuthority = normalizeHostHeaderAuthority(hostHeaderValue, parsedUrl.protocol);
    } catch (error) {
      throw new OutboundPolicyError(
        "host_header_mismatch",
        "Invalid Host header supplied for outbound request."
      );
    }

    if (suppliedAuthority !== expectedAuthority) {
      throw new OutboundPolicyError(
        "host_header_mismatch",
        "Host header does not match outbound request URL authority."
      );
    }
  }

  return sanitizedHeaders;
}

function sanitizeOutboundRequestOptions(options, requestUrl = null) {
  if (!options || typeof options !== "object") {
    throw new OutboundPolicyError(
      "invalid_request_options",
      "Invalid outbound request options."
    );
  }

  const sanitizedOptions = { ...options };

  DISALLOWED_OPTION_KEYS.forEach((optionKey) => {
    if (Object.prototype.hasOwnProperty.call(sanitizedOptions, optionKey)
      && sanitizedOptions[optionKey] !== undefined
    ) {
      throw new OutboundPolicyError(
        "disallowed_request_option",
        `Outbound request option '${optionKey}' is not allowed.`
      );
    }
  });

  const candidateUrl = requestUrl || sanitizedOptions.url;
  if (!candidateUrl || typeof candidateUrl !== "string") {
    throw new OutboundPolicyError(
      "invalid_url",
      "Outbound request URL must be an absolute URL."
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(candidateUrl);
  } catch (error) {
    throw new OutboundPolicyError(
      "invalid_url",
      "Outbound request URL must be an absolute URL."
    );
  }

  if (!parsedUrl.protocol || !parsedUrl.hostname) {
    throw new OutboundPolicyError(
      "invalid_url",
      "Outbound request URL must be an absolute URL."
    );
  }

  sanitizedOptions.url = parsedUrl.toString();
  sanitizedOptions.headers = sanitizeOutboundHeaders(sanitizedOptions.headers || {}, parsedUrl);

  return sanitizedOptions;
}

module.exports = {
  sanitizeOutboundRequestOptions,
};
