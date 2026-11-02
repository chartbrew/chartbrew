const MAX_SESSION_SECONDS = 31 * 24 * 60 * 60;
const USER_SESSION_CLAIMS = new Set(["email", "exp", "iat", "id"]);

function validateImageUserToken(decoded) {
  // Current user sessions last no more than 30 days. API keys use a much longer lifetime.
  if (decoded?.tokenType || decoded?.sub) return false;
  if (!Number.isSafeInteger(decoded?.id) || decoded.id <= 0) return false;
  if (typeof decoded?.email !== "string" || decoded.email.length === 0) return false;
  if (!Number.isInteger(decoded?.iat) || !Number.isInteger(decoded?.exp)) return false;
  return Object.keys(decoded).every((key) => USER_SESSION_CLAIMS.has(key))
    && decoded.exp > decoded.iat
    && (decoded.exp - decoded.iat) <= MAX_SESSION_SECONDS;
}

module.exports = {
  MAX_SESSION_SECONDS,
  USER_SESSION_CLAIMS,
  validateImageUserToken,
};
