const rateLimit = require("express-rate-limit");
const { McpServer, createMcpHandler, fromJsonSchema } = require("@modelcontextprotocol/server");
const { toNodeHandler } = require("@modelcontextprotocol/node");
const { verifyMcpAuth } = require("./McpOAuthRoute");
const { getDataApiLimits } = require("../modules/dataApiLimits");
const { DataApiError, ensureRequestId, sendDataApiError } = require("../modules/dataApiResponse");
const { TOOLS } = require("../modules/mcp/tools");
const { callMcpTool } = require("../modules/mcp/execute");

module.exports = (app) => {
  const authLimit = rateLimit({
    windowMs: 60000,
    limit: () => getDataApiLimits().authRateLimitMax,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req) => Boolean(req.apiKeyAccess),
    legacyHeaders: false,
  });
  const keyLimit = rateLimit({
    windowMs: 60000,
    limit: () => getDataApiLimits().rateLimitMax,
    keyGenerator: (req) => req.apiKeyAccess.apiKeyId,
    legacyHeaders: false,
  });
  app.all(
    "/mcp",
    (req, res, next) => {
      ensureRequestId(req);
      res.set("Cache-Control", "private, no-store").vary("Authorization");
      const clientHost =
        process.env.NODE_ENV === "production"
          ? process.env.VITE_APP_CLIENT_HOST
          : process.env.VITE_APP_CLIENT_HOST_DEV;
      if (
        req.headers.origin &&
        (!URL.canParse(clientHost) || req.headers.origin !== new URL(clientHost).origin)
      ) {
        return res.status(403).end();
      }
      if (req.method !== "POST") return res.status(405).set("Allow", "POST").end();
      if (!req.is("application/json"))
        return sendDataApiError(req, res, new DataApiError("UNSUPPORTED_MEDIA_TYPE"));
      if (
        Buffer.byteLength(req.rawBody || JSON.stringify(req.body || {})) >
        getDataApiLimits().maxRequestBytes
      ) {
        return sendDataApiError(req, res, new DataApiError("REQUEST_TOO_LARGE"));
      }
      return next();
    },
    authLimit,
    verifyMcpAuth,
    keyLimit,
    async (req, res) => {
      const handler = createMcpHandler(
        () => {
          const server = new McpServer({ name: "Chartbrew", version: "1.0.0" });
          for (const { inputSchema, outputSchema, name, description, annotations } of TOOLS.filter(
            (tool) => req.apiKeyAccess.scopes.includes(tool.scope)
          )) {
            server.registerTool(
              name,
              {
                description,
                annotations,
                inputSchema: fromJsonSchema(inputSchema),
                outputSchema: fromJsonSchema(outputSchema),
              },
              (args) => callMcpTool(req, name, args)
            );
          }
          return server;
        },
        { responseMode: "json" }
      );
      try {
        await toNodeHandler(handler)(req, res, req.body);
      } catch (error) {
        if (!res.headersSent) sendDataApiError(req, res, new DataApiError("INTERNAL_ERROR"));
      } finally {
        await handler.close();
      }
    }
  );
  return (req, res, next) => next();
};
