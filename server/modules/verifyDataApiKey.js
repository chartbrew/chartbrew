const { createHash, timingSafeEqual } = require("crypto");
const { Op } = require("sequelize");

const db = require("../models/models");
const TeamController = require("../controllers/TeamController");
const { buildDataApiAccess, normalizeScopes } = require("./dataApiAccess");
const { incrementDataApiMetric } = require("./dataApiMetrics");
const { DataApiError, sendDataApiError } = require("./dataApiResponse");
const verifySessionToken = require("./verifySessionToken");

const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;
const teamController = new TeamController();

function dataApiError(req, res, code) {
  const ipKey = createHash("sha256").update(String(req.ip || "unknown")).digest("hex").slice(0, 16);
  incrementDataApiMetric("authorization_failures", { code });
  console.warn("[data-api] authorization_failed", { // oxlint-disable-line no-console
    code,
    ipKey,
    requestId: req.id,
  });
  return sendDataApiError(req, res, new DataApiError(code));
}

function readBearerToken(req) {
  const authorizationHeaders = [];
  for (let index = 0; index < (req.rawHeaders || []).length; index += 2) {
    if (String(req.rawHeaders[index]).toLowerCase() === "authorization") {
      authorizationHeaders.push(req.rawHeaders[index + 1]);
    }
  }

  if (authorizationHeaders.length > 1) return null;

  const authorization = authorizationHeaders[0] || req.headers?.authorization;
  if (typeof authorization !== "string") return null;

  const match = authorization.match(/^Bearer ([^\s,]+)$/i);
  return match ? match[1] : null;
}

function hasRequiredClaims(decoded) {
  return decoded?.tokenType === "api_key"
    && typeof decoded.apiKeyId === "string"
    && decoded.apiKeyId.length > 0
    && Number.isInteger(Number(decoded.teamId))
    && Number.isInteger(Number(decoded.id));
}

function tokenDigest(token) {
  return createHash("sha256").update(String(token)).digest();
}

function tokensMatch(suppliedToken, storedToken) {
  if (typeof suppliedToken !== "string" || typeof storedToken !== "string") return false;
  return timingSafeEqual(tokenDigest(suppliedToken), tokenDigest(storedToken));
}

async function updateLastUsed(apiKey) {
  const lastUsedAt = apiKey.last_used_at ? new Date(apiKey.last_used_at).getTime() : 0;
  if (Date.now() - lastUsedAt < LAST_USED_WRITE_INTERVAL_MS) return;

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - LAST_USED_WRITE_INTERVAL_MS);
    await db.Apikey.update({ last_used_at: now }, {
      where: {
        id: apiKey.id,
        [Op.or]: [
          { last_used_at: null },
          { last_used_at: { [Op.lte]: cutoff } },
        ],
      },
    });
  } catch (error) {
    // Authentication must not fail because a usage timestamp could not be stored.
  }
}

function verifyDataApiKey(requiredScope = "data:read") {
  return async (req, res, next) => {
    const token = readBearerToken(req);
    if (!token) {
      return dataApiError(req, res, "API_KEY_REQUIRED");
    }

    let decoded;
    try {
      decoded = verifySessionToken(token);
    } catch (error) {
      return dataApiError(req, res, "API_KEY_INVALID");
    }

    if (!hasRequiredClaims(decoded)) {
      return dataApiError(req, res, "API_KEY_INVALID");
    }

    try {
      const apiKey = await db.Apikey.findOne({
        attributes: [
          "id", "token", "team_id", "user_id", "scopes", "project_ids", "all_projects",
          "last_used_at",
        ],
        where: { id: decoded.apiKeyId },
      });

      if (!apiKey || !tokensMatch(token, apiKey.token)) {
        return dataApiError(req, res, "API_KEY_INVALID");
      }

      if (
        Number(decoded.id) !== apiKey.user_id
        || Number(decoded.teamId) !== apiKey.team_id
        || !apiKey.user_id
      ) {
        return dataApiError(req, res, "API_KEY_INVALID");
      }

      const blacklisted = await db.TokenBlacklist.findOne({
        attributes: ["id"],
        where: { token },
      });
      if (blacklisted) {
        return dataApiError(req, res, "API_KEY_INVALID");
      }

      if (!normalizeScopes(apiKey.scopes).includes(requiredScope)) {
        return dataApiError(req, res, "API_KEY_SCOPE_REQUIRED");
      }

      const [user, teamRole] = await Promise.all([
        db.User.findOne({ attributes: ["id", "active"], where: { id: apiKey.user_id } }),
        teamController.getTeamRole(apiKey.team_id, apiKey.user_id),
      ]);

      if (!user || user.active === false || !teamRole) {
        return dataApiError(req, res, "API_KEY_INVALID");
      }

      const access = await buildDataApiAccess(db, apiKey, teamRole);
      if (!access.role || !["teamOwner", "teamAdmin", "projectAdmin", "projectEditor", "projectViewer"].includes(access.role)) {
        return dataApiError(req, res, "API_KEY_INVALID");
      }

      req.apiKeyAccess = access;
      await updateLastUsed(apiKey);
      return next();
    } catch (error) {
      return dataApiError(req, res, "API_KEY_INVALID");
    }
  };
}

verifyDataApiKey.hasRequiredClaims = hasRequiredClaims;
verifyDataApiKey.readBearerToken = readBearerToken;
verifyDataApiKey.tokensMatch = tokensMatch;

module.exports = verifyDataApiKey;
