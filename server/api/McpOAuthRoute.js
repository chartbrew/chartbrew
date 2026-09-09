const express = require("express");
const rateLimit = require("express-rate-limit");
const { Op } = require("sequelize");
const { buildOAuthProtectedResourceMetadata, getOAuthProtectedResourceMetadataUrl } = require("@modelcontextprotocol/server");
const db = require("../models/models");
const verifyToken = require("../modules/verifyToken");
const verifyDataApiKey = require("../modules/verifyDataApiKey");
const { DATA_API_SCOPES } = require("../modules/dataApiAccess");
const oauth = require("../modules/mcp/oauth");

const handle = (action) => async (req, res) => {
  try { await action(req, res); } catch (error) {
    if (error.oauthCode === "invalid_client" && req.headers.authorization) res.set("WWW-Authenticate", 'Basic realm="Chartbrew"');
    res.status(error.oauthCode ? error.status : 500).json({ error: error.oauthCode || "server_error" });
  }
};

module.exports = (app) => {
  const { issuer, resource, client } = oauth.urls();
  const metadata = {
    issuer, authorization_endpoint: `${issuer}/oauth/authorize`, token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`, revocation_endpoint: `${issuer}/oauth/revoke`,
    scopes_supported: [...DATA_API_SCOPES], response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"], authorization_response_iss_parameter_supported: true,
  };
  const resourceMetadata = buildOAuthProtectedResourceMetadata({ oauthMetadata: metadata, resourceServerUrl: new URL(resource),
    scopesSupported: [...DATA_API_SCOPES], resourceName: "Chartbrew" });
  app.get("/.well-known/oauth-authorization-server", (req, res) => res.json(metadata));
  app.get(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"], (req, res) => res.json(resourceMetadata));
  app.use("/oauth", (req, res, next) => {
    res.set({ "Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer" });
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 16384) return res.status(413).json({ error: "invalid_request" });
    return next();
  }, express.urlencoded({ extended: false, limit: "16kb", parameterLimit: 30 }),
  rateLimit({ windowMs: 60000, limit: 60, legacyHeaders: false }));
  app.use("/oauth", (req, res, next) => {
    if (req.method === "POST" && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) return res.status(400).json({ error: "invalid_request" });
    return next();
  });
  app.post("/oauth/register", rateLimit({ windowMs: 3600000, limit: 20, legacyHeaders: false }),
    handle(async (req, res) => res.status(201).json(await oauth.register(req.body))));
  app.get("/oauth/authorize", handle(async (req, res) => res.redirect(await oauth.authorize(req.query))));
  app.post("/oauth/token", handle(async (req, res) => res.json(await oauth.exchange(req))));
  app.post("/oauth/revoke", handle(async (req, res) => { await oauth.revoke(req); res.status(200).end(); }));

  const signedIn = [
    (req, res, next) => {
      if (!verifyDataApiKey.readBearerToken(req) || (req.headers.origin && req.headers.origin !== new URL(client).origin)) return res.status(401).json({ error: "Sign in to Chartbrew to continue." });
      return next();
    },
    verifyToken.withErrorHandler((req, res) => res.status(401).json({ error: "Sign in to Chartbrew to continue." }), {
      validateToken: (claims) => !claims.tokenType && !claims.aud && !claims.newEmail,
    }),
  ];
  app.get("/oauth/consent/:id", ...signedIn, handle(async (req, res) => res.json(await oauth.consentInfo(req.params.id, req.user.id))));
  app.post("/oauth/consent/:id", ...signedIn, handle(async (req, res) => res.json(await oauth.consent(req.params.id, req.user.id, req.body))));
  app.get("/oauth/apps", ...signedIn, handle(async (req, res) => {
    const apps = await db.McpOAuthGrant.findAll({ where: { user_id: req.user.id, revokedAt: null, exchangedAt: { [Op.ne]: null }, expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: db.McpOAuthClient, attributes: ["name"] }, { model: db.Team, attributes: ["name"] }], order: [["createdAt", "DESC"]] });
    res.json(apps.map((grant) => ({ id: grant.id, name: grant.McpOAuthClient.name, team: grant.Team.name, scopes: grant.scopes,
      allProjects: grant.all_projects, createdAt: grant.createdAt, expiresAt: grant.expiresAt })));
  }));
  app.delete("/oauth/apps/:id", ...signedIn, handle(async (req, res) => {
    await db.McpOAuthGrant.update({ revokedAt: new Date() }, { where: { id: req.params.id, user_id: req.user.id } });
    res.json({ success: true });
  }));
  return (req, res, next) => next();
};

module.exports.verifyMcpAuth = async (req, res, next) => {
  const { resource } = oauth.urls();
  res.set("WWW-Authenticate", `Bearer resource_metadata="${getOAuthProtectedResourceMetadataUrl(new URL(resource))}", scope="${[...DATA_API_SCOPES].join(" ")}"`);
  res.set("Access-Control-Expose-Headers", "WWW-Authenticate, MCP-Protocol-Version");
  const token = verifyDataApiKey.readBearerToken(req);
  if (!token?.startsWith("cbm_")) return verifyDataApiKey()(req, res, () => { res.removeHeader("WWW-Authenticate"); next(); });
  try {
    req.apiKeyAccess = await oauth.verifyAccess(token);
    res.removeHeader("WWW-Authenticate");
    return next();
  } catch {
    res.set("WWW-Authenticate", `${res.get("WWW-Authenticate")}, error="invalid_token"`);
    return res.status(401).json({ error: "invalid_token" });
  }
};
