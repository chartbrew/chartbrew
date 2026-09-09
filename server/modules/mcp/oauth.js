const { createHash, createHmac, randomBytes, timingSafeEqual } = require("crypto");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const db = require("../../models/models");
const { DATA_API_SCOPES, TEAM_WIDE_ROLES, PROJECT_ROLES, buildDataApiAccess, normalizeProjectIds } = require("../dataApiAccess");
const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const hash = (value) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const after = (seconds) => new Date(Date.now() + seconds * 1000);
const fail = (code = "invalid_request", status = 400) => { throw Object.assign(new Error(code), { oauthCode: code, status }); };
const validString = (value, max = 2048) => typeof value === "string" && value.length > 0 && value.length <= max;
const equal = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));

function urls() {
  const apiHost = process.env.NODE_ENV === "production" ? process.env.VITE_APP_API_HOST : process.env.VITE_APP_API_HOST_DEV;
  const resource = new URL(process.env.CB_MCP_PUBLIC_URL || new URL("/mcp", apiHost || "http://localhost:3210").href);
  if (resource.pathname !== "/mcp" || resource.search || resource.hash || resource.username || resource.password
    || (resource.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && resource.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(resource.hostname)))) throw new Error("MCP requires a public HTTPS URL ending in /mcp");
  return { resource: resource.href, issuer: resource.origin, client: settings.client || "http://localhost:4018" };
}

function scopes(value = "data:read") {
  if (!validString(value, 200)) return fail("invalid_scope");
  const result = [...new Set(value.split(" "))];
  if (!result.includes("data:read") || result.some((scope) => !DATA_API_SCOPES.has(scope))) return fail("invalid_scope");
  return result;
}

function requestedResource(value) {
  const resource = urls().resource;
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.some((item) => item !== resource)) return fail("invalid_target");
  return resource;
}

function validRedirect(value) {
  if (!validString(value) || !URL.canParse(value) || /[\s*]/.test(value)) return false;
  const url = new URL(value);
  return !url.hash && !url.username && !url.password
    && !["code", "state", "error", "iss"].some((key) => url.searchParams.has(key))
    && (url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)));
}

async function register(body) {
  const method = body.token_endpoint_auth_method || "none";
  if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.length || body.redirect_uris.length > 10
    || !body.redirect_uris.every(validRedirect)) return fail("invalid_redirect_uri");
  if (!validString(body.client_name || "External app", 80)
    || [...(body.client_name || "")].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return fail("invalid_client_metadata");
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)
    || (body.grant_types && (!Array.isArray(body.grant_types) || !body.grant_types.includes("authorization_code")
      || body.grant_types.some((type) => !["authorization_code", "refresh_token"].includes(type))))
    || (body.response_types && (!Array.isArray(body.response_types) || body.response_types.length !== 1 || body.response_types[0] !== "code"))) return fail("invalid_client_metadata");
  const clientSecret = method === "none" ? null : secret();
  const client = await db.McpOAuthClient.create({ id: randomBytes(24).toString("hex"), name: body.client_name || "External app",
    redirectUris: body.redirect_uris, authMethod: method, secretHash: clientSecret ? hash(clientSecret) : null });
  return { client_id: client.id, client_name: client.name, redirect_uris: client.redirectUris, token_endpoint_auth_method: method,
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], client_id_issued_at: Math.floor(Date.now() / 1000),
    ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}) };
}

async function authenticateClient(req) {
  if ((req.rawHeaders || []).filter((value, index) => index % 2 === 0 && value.toLowerCase() === "authorization").length > 1) return fail("invalid_client", 401);
  let { client_id: id, client_secret: supplied } = req.body;
  let method = supplied ? "client_secret_post" : "none";
  if (req.headers.authorization) {
    if (id || supplied || !/^Basic [A-Za-z0-9+/]+=*$/.test(req.headers.authorization)) return fail("invalid_client", 401);
    const credentials = Buffer.from(req.headers.authorization.slice(6), "base64").toString();
    const split = credentials.indexOf(":");
    if (split < 0) return fail("invalid_client", 401);
    try {
      id = decodeURIComponent(credentials.slice(0, split).replace(/\+/g, " "));
      supplied = decodeURIComponent(credentials.slice(split + 1).replace(/\+/g, " "));
    } catch { return fail("invalid_client", 401); }
    method = "client_secret_basic";
  }
  if (!validString(id, 64)) return fail("invalid_client", 401);
  const client = await db.McpOAuthClient.findByPk(id);
  if (!client || client.authMethod !== method || (method !== "none" && (!validString(supplied) || !equal(hash(supplied), client.secretHash)))) return fail("invalid_client", 401);
  return client;
}

async function authorize(query) {
  if (!validString(query.client_id, 64)) return fail("invalid_client");
  const client = await db.McpOAuthClient.findByPk(query.client_id);
  if (!client || !validString(query.redirect_uri) || !client.redirectUris.includes(query.redirect_uri)) return fail("invalid_redirect_uri");
  if (query.response_type !== "code" || query.code_challenge_method !== "S256"
    || !validString(query.code_challenge, 43) || !/^[A-Za-z0-9_-]{43}$/.test(query.code_challenge)
    || (query.state !== undefined && !validString(query.state))) return fail();
  const resource = requestedResource(query.resource);
  const grant = await db.McpOAuthGrant.create({ client_id: client.id, redirectUri: query.redirect_uri,
    challenge: query.code_challenge, state: query.state || null, resource,
    scopes: scopes(query.scope === undefined ? [...DATA_API_SCOPES].join(" ") : query.scope), expiresAt: after(600) });
  return new URL(`/oauth/consent?request=${grant.id}`, urls().client).href;
}

async function pending(id, userId, transaction) {
  if (!validString(id, 36) || !/^[a-f0-9-]{36}$/.test(id)) return fail();
  const grant = await db.McpOAuthGrant.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!grant || grant.revokedAt || grant.codeHash || grant.expiresAt <= new Date()
    || (grant.user_id && grant.user_id !== userId)) return fail("invalid_grant");
  const user = await db.User.findByPk(userId, { attributes: ["id", "active"], transaction });
  if (!user || user.active === false) return fail("access_denied", 403);
  return grant;
}

function allowedScopes(role) {
  return TEAM_WIDE_ROLES.has(role) ? [...DATA_API_SCOPES] : ["data:read", "data:refresh"];
}

async function consentInfo(id, userId) {
  return db.sequelize.transaction(async (transaction) => {
    const grant = await pending(id, userId, transaction);
    await grant.update({ user_id: userId }, { transaction });
    const client = await db.McpOAuthClient.findByPk(grant.client_id, { transaction });
    const roles = await db.TeamRole.findAll({ where: { user_id: userId, role: { [Op.in]: [...TEAM_WIDE_ROLES, ...PROJECT_ROLES] } },
      include: [{ model: db.Team, attributes: ["id", "name"], required: true }], transaction });
    return { app: { name: client.name, returnHost: new URL(grant.redirectUri).host }, scopes: grant.scopes,
      teams: roles.map((role) => ({ id: role.team_id, name: role.Team.name, allProjects: TEAM_WIDE_ROLES.has(role.role), scopes: allowedScopes(role.role) })) };
  });
}

function returnToClient(grant, params) {
  const url = new URL(grant.redirectUri);
  for (const [key, value] of Object.entries({ ...params, iss: urls().issuer, ...(grant.state ? { state: grant.state } : {}) })) url.searchParams.set(key, value);
  return url.href;
}

async function consent(id, userId, body) {
  return db.sequelize.transaction(async (transaction) => {
    const grant = await pending(id, userId, transaction);
    // A request must first be shown to this signed-in user. Consent cannot be supplied by a harness.
    if (grant.user_id !== userId) return fail("access_denied", 403);
    if (body.allow === false) {
      await grant.update({ revokedAt: new Date() }, { transaction });
      return { redirect: returnToClient(grant, { error: "access_denied" }) };
    }
    if (body.allow !== true || !Number.isInteger(body.teamId) || !Array.isArray(body.scopes) || !body.scopes.every((scope) => typeof scope === "string")) return fail();
    const role = await db.TeamRole.findOne({ where: { team_id: body.teamId, user_id: userId }, transaction });
    const selected = scopes(body.scopes.join(" "));
    if (!role || ![...TEAM_WIDE_ROLES, ...PROJECT_ROLES].includes(role.role)
      || selected.some((scope) => !grant.scopes.includes(scope) || !allowedScopes(role.role).includes(scope))) return fail("access_denied", 403);
    const code = secret();
    await grant.update({ team_id: body.teamId, scopes: selected, all_projects: TEAM_WIDE_ROLES.has(role.role),
      project_ids: normalizeProjectIds(role.projects), codeHash: hash(code), codeExpiresAt: after(60), expiresAt: after(90 * 86400) }, { transaction });
    return { redirect: returnToClient(grant, { code }) };
  });
}

async function accessForGrant(grant, transaction) {
  if (!grant || !grant.team_id || !grant.user_id || grant.revokedAt || grant.expiresAt <= new Date() || grant.resource !== urls().resource) return fail("invalid_grant");
  const [user, role, team] = await Promise.all([
    db.User.findByPk(grant.user_id, { attributes: ["id", "active"], transaction }),
    db.TeamRole.findOne({ where: { user_id: grant.user_id, team_id: grant.team_id }, transaction }),
    db.Team.findByPk(grant.team_id, { attributes: ["id", "name"], transaction }),
  ]);
  if (!user || user.active === false || !team || !role || ![...TEAM_WIDE_ROLES, ...PROJECT_ROLES].includes(role.role)) return fail("invalid_grant");
  const access = await buildDataApiAccess(db, grant, role);
  return { ...access, scopes: access.scopes.filter((scope) => allowedScopes(role.role).includes(scope)), teamName: team.name, oauthGrantId: grant.id };
}

// Separate signing key and token type: an MCP token can never become a Chartbrew login token.
function signingKey() { return createHmac("sha256", settings.encryptionKey).update("chartbrew-mcp-oauth").digest(); }
function decodeAccess(token) {
  if (!validString(token, 4096) || !token.startsWith("cbm_")) return fail("invalid_token", 401);
  const claims = jwt.verify(token.slice(4), signingKey(), { algorithms: ["HS256"], issuer: urls().issuer, audience: urls().resource });
  if (claims.tokenType !== "mcp_oauth" || !validString(claims.sub, 36)) return fail("invalid_token", 401);
  return claims;
}

async function verifyAccess(token) {
  const claims = decodeAccess(token);
  const grant = await db.McpOAuthGrant.findByPk(claims.sub);
  if (!grant?.exchangedAt) return fail("invalid_token", 401);
  return accessForGrant(grant);
}

async function issueTokens(grant, transaction) {
  const refresh = secret();
  await db.McpOAuthRefresh.create({ id: hash(refresh), grant_id: grant.id }, { transaction });
  return { token_type: "Bearer", expires_in: 600, scope: grant.scopes.join(" "), refresh_token: refresh,
    access_token: `cbm_${jwt.sign({ tokenType: "mcp_oauth" }, signingKey(), {
      algorithm: "HS256", subject: grant.id, issuer: urls().issuer, audience: grant.resource, expiresIn: 600,
    })}` };
}

async function exchange(req) {
  const client = await authenticateClient(req);
  const body = req.body;
  requestedResource(body.resource);
  if (!["authorization_code", "refresh_token"].includes(body.grant_type)) return fail("unsupported_grant_type");
  const credential = body.grant_type === "authorization_code" ? body.code : body.refresh_token;
  if (!validString(credential, 128)) return fail("invalid_grant");
  const result = await db.sequelize.transaction(async (transaction) => {
    const refresh = body.grant_type === "refresh_token"
      ? await db.McpOAuthRefresh.findByPk(hash(credential), { transaction }) : null;
    const grant = await db.McpOAuthGrant.findOne({ where: refresh ? { id: refresh.grant_id } : { codeHash: hash(credential) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!grant || grant.client_id !== client.id || (body.grant_type === "refresh_token" && !refresh)) return fail("invalid_grant");
    await accessForGrant(grant, transaction);
    if (body.grant_type === "authorization_code") {
      if (body.redirect_uri !== grant.redirectUri || !validString(body.code_verifier, 128)
        || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier)
        || !equal(createHash("sha256").update(body.code_verifier).digest("base64url"), grant.challenge)) return fail("invalid_grant");
      if (grant.exchangedAt) {
        await grant.update({ revokedAt: new Date() }, { transaction });
        return null;
      }
      if (grant.codeExpiresAt <= new Date()) return fail("invalid_grant");
      await grant.update({ exchangedAt: new Date() }, { transaction });
    } else {
      // Lock the grant first so every refresh in this authorization shares one rotation boundary.
      await refresh.reload({ transaction, lock: transaction.LOCK.UPDATE });
      if (refresh.usedAt) {
        await grant.update({ revokedAt: new Date() }, { transaction });
        return null;
      }
      if (body.scope !== undefined) {
        const requested = scopes(body.scope);
        if (requested.length !== grant.scopes.length || requested.some((scope) => !grant.scopes.includes(scope))) return fail("invalid_scope");
      }
      await refresh.update({ usedAt: new Date() }, { transaction });
    }
    return issueTokens(grant, transaction);
  });
  if (!result) return fail("invalid_grant");
  return result;
}

async function revoke(req) {
  const client = await authenticateClient(req);
  if (!validString(req.body.token, 4096)) return fail();
  let id;
  if (req.body.token.startsWith("cbm_")) {
    try { id = decodeAccess(req.body.token).sub; } catch { return; }
  } else {
    id = (await db.McpOAuthRefresh.findByPk(hash(req.body.token)))?.grant_id;
  }
  if (id) await db.McpOAuthGrant.update({ revokedAt: new Date() }, { where: { id, client_id: client.id } });
}

async function cleanupExpiredGrants({ dryRun = false } = {}) {
  const where = { expiresAt: { [Op.lt]: new Date() } };
  const matched = await db.McpOAuthGrant.count({ where });
  if (dryRun) return { matched, deleted: 0 };
  // One bounded batch per retention run. Refresh hashes stay until the grant expires, to detect reuse.
  const grants = await db.McpOAuthGrant.findAll({ attributes: ["id"], where, limit: 1000, order: [["expiresAt", "ASC"]] });
  const deleted = grants.length ? await db.McpOAuthGrant.destroy({ where: { id: { [Op.in]: grants.map((grant) => grant.id) } } }) : 0;
  return { matched, deleted };
}

module.exports = { urls, scopes, validRedirect, register, authorize, consentInfo, consent, exchange, revoke, verifyAccess, cleanupExpiredGrants };
