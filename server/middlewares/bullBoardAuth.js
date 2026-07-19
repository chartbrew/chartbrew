const crypto = require("crypto");

function secureCompare(actual, expected) {
  const actualHash = crypto.createHash("sha256").update(actual).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();

  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function rejectRequest(res) {
  res.setHeader("WWW-Authenticate", "Basic realm=\"Chartbrew BullMQ\", charset=\"UTF-8\"");
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).send("Authentication required");
}

function bullBoardAuth(req, res, next) {
  const expectedUsername = process.env.CB_BULLMQ_USERNAME;
  const expectedPassword = process.env.CB_BULLMQ_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("BullMQ dashboard credentials are not configured");
  }

  const authorization = req.get("authorization") || "";
  const [scheme, encodedCredentials, ...extraParts] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "basic" || !encodedCredentials || extraParts.length > 0) {
    return rejectRequest(res);
  }

  const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf8");
  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex < 0) {
    return rejectRequest(res);
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);
  const usernameMatches = secureCompare(username, expectedUsername);
  const passwordMatches = secureCompare(password, expectedPassword);

  if (!usernameMatches || !passwordMatches) {
    return rejectRequest(res);
  }

  res.setHeader("Cache-Control", "no-store");
  return next();
}

module.exports = bullBoardAuth;
