const jwt = require("jsonwebtoken");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

function signShareToken(payload, options = {}) {
  return jwt.sign(payload, settings.encryptionKey, { ...options, algorithm: "HS256" });
}

function signLegacyShareToken(payload, options = {}) {
  if (!settings.allowLegacyShareTokens) {
    throw new Error("Legacy share tokens are disabled");
  }

  return jwt.sign(payload, settings.secret, { ...options, algorithm: "HS256" });
}

function verifyShareToken(token) {
  try {
    return jwt.verify(token, settings.encryptionKey, { algorithms: ["HS256"] });
  } catch (error) {
    if (!settings.allowLegacyShareTokens || error?.message === "invalid algorithm") {
      throw error;
    }

    return jwt.verify(token, settings.secret, { algorithms: ["HS256"] });
  }
}

function validateShareTokenPolicy(decodedToken, sharePolicy, entityType, entityId) {
  const tokenMatchesPolicy = `${decodedToken?.sub?.sharePolicyId}` === `${sharePolicy?.id}`;
  const tokenMatchesEntity = decodedToken?.sub?.type === entityType
    && `${decodedToken?.sub?.id}` === `${entityId}`;
  const policyMatchesEntity = sharePolicy?.entity_type === entityType
    && `${sharePolicy?.entity_id}` === `${entityId}`;

  if (!tokenMatchesPolicy || !tokenMatchesEntity || !policyMatchesEntity) {
    throw new Error("Invalid share token");
  }

  if (sharePolicy.visibility === "disabled") {
    throw new Error("Share policy is disabled");
  }

  if (sharePolicy.expires_at && new Date(sharePolicy.expires_at).getTime() <= Date.now()) {
    throw new Error("Share policy has expired");
  }

  return decodedToken;
}

module.exports = {
  signLegacyShareToken,
  signShareToken,
  validateShareTokenPolicy,
  verifyShareToken,
};
