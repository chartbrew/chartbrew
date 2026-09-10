import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const settings = require("../../settings-dev");
const resource = "http://localhost:3210/mcp";
const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("MCP OAuth", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  async function fixture() {
    vi.stubEnv("CB_MCP_PUBLIC_URL", resource);
    const user = await db.User.create({
      name: "Owner",
      email: "oauth@example.com",
      password: "password",
      active: true,
    });
    const team = await db.Team.create({ name: "Selected team" });
    const other = await db.Team.create({ name: "Other team" });
    const role = await db.TeamRole.create({
      team_id: team.id,
      user_id: user.id,
      role: "teamOwner",
      projects: [],
    });
    await db.TeamRole.create({
      team_id: other.id,
      user_id: user.id,
      role: "teamOwner",
      projects: [],
    });
    await db.Project.create({
      team_id: team.id,
      name: "Selected dashboard",
      brewName: "oauth-selected",
    });
    await db.Project.create({
      team_id: other.id,
      name: "Private other dashboard",
      brewName: "oauth-other",
    });
    const session = jwt.sign({ id: user.id }, settings.encryptionKey, { expiresIn: "1h" });
    const app = express();
    app.use(express.json());
    require("../../api/McpOAuthRoute")(app);
    require("../../api/McpRoute")(app);
    const registration = await request(app)
      .post("/oauth/register")
      .send({ client_name: "Test harness", redirect_uris: ["http://127.0.0.1:9999/callback"] });
    expect(registration.status).toBe(201);
    const client = registration.body;
    const authQuery = {
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource,
      state: "client-state",
      scope: "data:read data:refresh charts:preview datasets:write",
    };
    const begin = async (overrides = {}) =>
      request(app)
        .get("/oauth/authorize")
        .query({ ...authQuery, ...overrides });
    const approve = async (teamId = team.id, overrides = {}) => {
      const started = await begin();
      expect(started.status).toBe(302);
      const id = new URL(started.headers.location).searchParams.get("request");
      const info = await request(app).get(`/oauth/consent/${id}`).auth(session, { type: "bearer" });
      expect(info.status).toBe(200);
      const response = await request(app)
        .post(`/oauth/consent/${id}`)
        .auth(session, { type: "bearer" })
        .send({ allow: true, teamId, scopes: authQuery.scope.split(" "), ...overrides });
      return {
        id,
        info: info.body,
        response,
        code: response.body.redirect
          ? new URL(response.body.redirect).searchParams.get("code")
          : null,
      };
    };
    const exchange = (code, overrides = {}) =>
      request(app)
        .post("/oauth/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          client_id: client.client_id,
          redirect_uri: authQuery.redirect_uri,
          resource,
          code,
          code_verifier: verifier,
          ...overrides,
        });
    const refresh = (token, overrides = {}) =>
      request(app)
        .post("/oauth/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          client_id: client.client_id,
          resource,
          refresh_token: token,
          ...overrides,
        });
    const rpc = (
      token,
      method = "tools/call",
      params = { name: "search_workspace", arguments: {} }
    ) =>
      request(app)
        .post("/mcp")
        .auth(token, { type: "bearer" })
        .set("Accept", "application/json, text/event-stream")
        .set("Mcp-Method", method)
        .set("Mcp-Name", params?.name || "")
        .set("MCP-Protocol-Version", "2026-07-28")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method,
          params: {
            ...params,
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        });
    return {
      app,
      user,
      team,
      other,
      role,
      session,
      client,
      begin,
      approve,
      exchange,
      refresh,
      rpc,
    };
  }

  it("discovers OAuth and authorizes exactly one team with no login-token reuse", async () => {
    const f = await fixture();
    const denied = await request(f.app).post("/mcp").send({});
    expect(denied.status).toBe(401);
    expect(denied.headers["www-authenticate"]).toContain(
      "/.well-known/oauth-protected-resource/mcp"
    );
    expect(
      (await request(f.app).get("/.well-known/oauth-protected-resource/mcp")).body.resource
    ).toBe(resource);
    const metadata = (await request(f.app).get("/.well-known/oauth-authorization-server")).body;
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    const approved = await f.approve();
    expect(approved.info.teams).toHaveLength(2);
    const callback = new URL(approved.response.body.redirect);
    expect(callback.searchParams.get("state")).toBe("client-state");
    expect(callback.searchParams.get("iss")).toBe("http://localhost:3210");
    const issued = await f.exchange(approved.code);
    expect(issued.status).toBe(200);
    expect(issued.body.expires_in).toBe(600);
    const result = await f.rpc(issued.body.access_token);
    expect(result.status).toBe(200);
    expect(result.body.result.structuredContent.result.team.name).toBe("Selected team");
    expect(JSON.stringify(result.body)).not.toContain("Private other dashboard");
    const audit = await db.UpdateRun.findOne({ where: { triggerType: "mcp" } });
    expect(JSON.stringify(audit.summary)).toContain(approved.id);
    expect((await f.rpc(f.session)).status).toBe(401);
    expect(
      (await request(f.app).get("/oauth/apps").auth(issued.body.access_token, { type: "bearer" }))
        .status
    ).toBe(401);
    const grant = await db.McpOAuthGrant.findByPk(approved.id);
    expect(grant.codeHash).not.toBe(approved.code);
    expect(JSON.stringify(await db.McpOAuthRefresh.findAll())).not.toContain(
      issued.body.refresh_token
    );
  });

  it("rejects unsafe callbacks, weak PKCE, unknown scopes, and wrong resource", async () => {
    const f = await fixture();
    for (const uri of [
      "javascript:alert(1)",
      "http://evil.example/callback",
      "https://a.example/*",
      "https://a.example/#fragment",
      "https://user:pass@a.example/callback",
    ]) {
      expect(
        (
          await request(f.app)
            .post("/oauth/register")
            .send({ redirect_uris: [uri] })
        ).status
      ).toBe(400);
    }
    for (const query of [
      { redirect_uri: "https://evil.example" },
      { resource: "https://other.example/mcp" },
      { scope: "data:read admin" },
      { code_challenge_method: "plain" },
      { code_challenge: "short" },
      { response_type: "token" },
      { client_id: ["a", "b"] },
    ]) {
      const rejected = await f.begin(query);
      expect(rejected.status).toBe(400);
      expect(rejected.headers.location).toBeUndefined();
    }
    const { code } = await f.approve();
    for (const body of [
      { code_verifier: "b".repeat(43) },
      { redirect_uri: "https://evil.example" },
      { resource: "https://other.example/mcp" },
    ]) {
      expect((await f.exchange(code, body)).status).toBe(400);
    }
    expect((await f.exchange(code)).status).toBe(200);
  });

  it("requests all permissions by default but grants only the user's selection", async () => {
    const f = await fixture();
    const allScopes = ["data:read", "data:refresh", "charts:preview", "datasets:write"];
    const denied = await request(f.app).post("/mcp").send({});
    expect(denied.headers["www-authenticate"]).toContain(`scope="${allScopes.join(" ")}"`);
    const metadata = await request(f.app).get("/.well-known/oauth-protected-resource/mcp");
    expect(metadata.body.scopes_supported).toEqual(allScopes);
    for (const scope of [undefined, "data:read"]) {
      const started = await f.begin({ scope });
      expect(started.status).toBe(302);
      const id = new URL(started.headers.location).searchParams.get("request");
      const info = await request(f.app)
        .get(`/oauth/consent/${id}`)
        .auth(f.session, { type: "bearer" });
      expect(info.body.scopes).toEqual(scope ? [scope] : allScopes);
      const approved = await request(f.app)
        .post(`/oauth/consent/${id}`)
        .auth(f.session, { type: "bearer" })
        .send({ allow: true, teamId: f.team.id, scopes: ["data:read"] });
      expect(approved.status).toBe(200);
      const issued = await f.exchange(new URL(approved.body.redirect).searchParams.get("code"));
      expect(issued.status).toBe(200);
      expect(issued.body.scope).toBe("data:read");
      const list = await f.rpc(issued.body.access_token, "tools/list", {});
      expect(list.status).toBe(200);
      expect(list.body.result.tools.some((tool) => tool.name === "create_chart_preview")).toBe(
        false
      );
    }
    const narrow = await f.begin({ scope: "data:read" });
    const id = new URL(narrow.headers.location).searchParams.get("request");
    await request(f.app).get(`/oauth/consent/${id}`).auth(f.session, { type: "bearer" });
    const expanded = await request(f.app)
      .post(`/oauth/consent/${id}`)
      .auth(f.session, { type: "bearer" })
      .send({ allow: true, teamId: f.team.id, scopes: allScopes });
    expect(expanded.status).toBe(403);
  });

  it("accepts repeated identical resources for authorization, exchange, and refresh only", async () => {
    const f = await fixture();
    const duplicates = [resource, resource];
    const invalid = [
      undefined,
      "",
      [resource, "https://other.example/mcp"],
      ["https://other.example/mcp", resource],
      [resource, ""],
    ];
    for (const value of invalid) {
      const rejected = await f.begin({ resource: value });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error).toBe("invalid_target");
    }
    const started = await f.begin({ resource: duplicates });
    expect(started.status).toBe(302);
    const id = new URL(started.headers.location).searchParams.get("request");
    expect((await db.McpOAuthGrant.findByPk(id)).resource).toBe(resource);
    await request(f.app).get(`/oauth/consent/${id}`).auth(f.session, { type: "bearer" });
    const approved = await request(f.app)
      .post(`/oauth/consent/${id}`)
      .auth(f.session, { type: "bearer" })
      .send({ allow: true, teamId: f.team.id, scopes: ["data:read"] });
    expect(approved.status).toBe(200);
    const code = new URL(approved.body.redirect).searchParams.get("code");
    for (const value of invalid) {
      const rejected = await f.exchange(code, { resource: value });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error).toBe("invalid_target");
    }
    const issued = await f.exchange(code, { resource: duplicates });
    expect(issued.status).toBe(200);
    expect(jwt.decode(issued.body.access_token.slice(4)).aud).toBe(resource);
    for (const value of invalid) {
      const rejected = await f.refresh(issued.body.refresh_token, { resource: value });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error).toBe("invalid_target");
    }
    const refreshed = await f.refresh(issued.body.refresh_token, { resource: duplicates });
    expect(refreshed.status).toBe(200);
    expect((await f.rpc(refreshed.body.access_token)).status).toBe(200);
  });

  it("binds consent to the signed-in user and requires current team permission", async () => {
    const f = await fixture();
    const started = await f.begin();
    const id = new URL(started.headers.location).searchParams.get("request");
    expect(
      (
        await request(f.app)
          .post(`/oauth/consent/${id}`)
          .auth(f.session, { type: "bearer" })
          .send({ allow: true, teamId: f.team.id, scopes: ["data:read"] })
      ).status
    ).toBe(403);
    await request(f.app).get(`/oauth/consent/${id}`).auth(f.session, { type: "bearer" });
    const outsider = await db.User.create({
      name: "Other",
      email: "other-oauth@example.com",
      password: "password",
      active: true,
    });
    const otherSession = jwt.sign({ id: outsider.id }, settings.encryptionKey);
    expect(
      (await request(f.app).get(`/oauth/consent/${id}`).auth(otherSession, { type: "bearer" }))
        .status
    ).toBe(400);
    expect(
      (
        await request(f.app)
          .post(`/oauth/consent/${id}`)
          .auth(f.session, { type: "bearer" })
          .set("Origin", "https://evil.example")
          .send({ allow: true, teamId: f.team.id, scopes: ["data:read"] })
      ).status
    ).toBe(401);
    expect((await f.approve(999999)).response.status).toBe(403);
    await f.role.update({ role: "projectViewer" });
    expect((await f.approve()).response.status).toBe(403);
    expect((await f.approve(f.team.id, { scopes: ["data:read"] })).response.status).toBe(200);
    const canceled = await request(f.app)
      .post(`/oauth/consent/${id}`)
      .auth(f.session, { type: "bearer" })
      .send({ allow: false });
    expect(new URL(canceled.body.redirect).searchParams.get("error")).toBe("access_denied");
    expect(
      (await request(f.app).get(`/oauth/consent/${id}`).auth(f.session, { type: "bearer" })).status
    ).toBe(400);
  });

  it("rotates refresh tokens, revokes the whole grant on reuse, and serializes parallel exchanges", async () => {
    const f = await fixture();
    const { code } = await f.approve();
    const first = (await f.exchange(code)).body;
    expect((await f.refresh(first.refresh_token, { scope: "data:read admin" })).status).toBe(400);
    const refreshed = await f.refresh(first.refresh_token, {
      scope: "datasets:write charts:preview data:refresh data:read",
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refresh_token).not.toBe(first.refresh_token);
    expect((await f.refresh(first.refresh_token)).status).toBe(400);
    expect((await f.rpc(refreshed.body.access_token)).status).toBe(401);
    expect((await f.refresh(refreshed.body.refresh_token)).status).toBe(400);
    const next = await f.approve();
    const issued = (await f.exchange(next.code)).body;
    const parallel = await Promise.all([
      f.refresh(issued.refresh_token),
      f.refresh(issued.refresh_token),
    ]);
    expect(parallel.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(
      (await f.rpc(parallel.find((response) => response.status === 200).body.access_token)).status
    ).toBe(401);
  });

  it("rejects expired codes and grants, replayed codes, and changed membership", async () => {
    const f = await fixture();
    const first = await f.approve();
    await db.McpOAuthGrant.update({ codeExpiresAt: new Date(0) }, { where: { id: first.id } });
    expect((await f.exchange(first.code)).status).toBe(400);
    const second = await f.approve();
    const issued = (await f.exchange(second.code)).body;
    expect((await f.exchange(second.code)).status).toBe(400);
    expect((await f.rpc(issued.access_token)).status).toBe(401);
    const third = await f.approve();
    const active = (await f.exchange(third.code)).body;
    await f.role.update({ role: "projectViewer" });
    const list = await f.rpc(active.access_token, "tools/list", {});
    expect(list.body.result.tools.some((tool) => tool.name === "create_chart_preview")).toBe(false);
    await f.role.destroy();
    expect((await f.rpc(active.access_token)).status).toBe(401);
    expect((await f.refresh(active.refresh_token)).status).toBe(400);
  });

  it("lists and revokes only the user's grants and supports confidential clients", async () => {
    const f = await fixture();
    const approved = await f.approve();
    const issued = (await f.exchange(approved.code)).body;
    const apps = await request(f.app).get("/oauth/apps").auth(f.session, { type: "bearer" });
    expect(apps.body).toMatchObject([
      { id: approved.id, name: "Test harness", team: "Selected team" },
    ]);
    expect(JSON.stringify(apps.body)).not.toContain("codeHash");
    await request(f.app).delete(`/oauth/apps/${approved.id}`).auth(f.session, { type: "bearer" });
    expect((await f.rpc(issued.access_token)).status).toBe(401);
    expect(
      (await request(f.app).get("/oauth/apps").auth(f.session, { type: "bearer" })).body
    ).toEqual([]);
    for (const method of ["client_secret_post", "client_secret_basic"]) {
      const client = (
        await request(f.app)
          .post("/oauth/register")
          .send({ redirect_uris: [f.client.redirect_uris[0]], token_endpoint_auth_method: method })
      ).body;
      const started = await f.begin({ client_id: client.client_id, scope: "data:read" });
      const id = new URL(started.headers.location).searchParams.get("request");
      await request(f.app).get(`/oauth/consent/${id}`).auth(f.session, { type: "bearer" });
      const response = await request(f.app)
        .post(`/oauth/consent/${id}`)
        .auth(f.session, { type: "bearer" })
        .send({ allow: true, teamId: f.team.id, scopes: ["data:read"] });
      const code = new URL(response.body.redirect).searchParams.get("code");
      expect((await f.exchange(code, { client_id: client.client_id })).status).toBe(401);
      const tokenRequest = request(f.app).post("/oauth/token").type("form");
      if (method === "client_secret_basic")
        tokenRequest.auth(client.client_id, client.client_secret);
      const token = await tokenRequest.send({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        resource,
        redirect_uri: f.client.redirect_uris[0],
        ...(method === "client_secret_post"
          ? { client_id: client.client_id, client_secret: client.client_secret }
          : {}),
      });
      expect(token.status).toBe(200);
      const revoke = request(f.app).post("/oauth/revoke").type("form");
      if (method === "client_secret_basic") revoke.auth(client.client_id, client.client_secret);
      expect(
        (
          await revoke.send({
            token: token.body.refresh_token,
            ...(method === "client_secret_post"
              ? { client_id: client.client_id, client_secret: client.client_secret }
              : {}),
          })
        ).status
      ).toBe(200);
      expect((await f.rpc(token.body.access_token)).status).toBe(401);
    }
  });

  it("enforces token expiry and audience, prevents cross-client refresh, and cleans expired grants", async () => {
    const f = await fixture();
    const approved = await f.approve();
    const issued = (await f.exchange(approved.code)).body;
    const stranger = (
      await request(f.app)
        .post("/oauth/register")
        .send({ redirect_uris: [f.client.redirect_uris[0]] })
    ).body;
    expect((await f.refresh(issued.refresh_token, { client_id: stranger.client_id })).status).toBe(
      400
    );
    expect((await f.rpc(issued.access_token)).status).toBe(200);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 601000);
    expect((await f.rpc(issued.access_token)).status).toBe(401);
    vi.restoreAllMocks();
    vi.stubEnv("CB_MCP_PUBLIC_URL", "http://localhost:3211/mcp");
    expect((await f.rpc(issued.access_token)).status).toBe(401);
    vi.stubEnv("CB_MCP_PUBLIC_URL", resource);
    await db.McpOAuthGrant.update({ expiresAt: new Date(0) }, { where: { id: approved.id } });
    expect((await f.refresh(issued.refresh_token)).status).toBe(400);
    const { cleanupExpiredGrants } = require("../../modules/mcp/oauth");
    expect(await cleanupExpiredGrants({ dryRun: true })).toMatchObject({ matched: 1, deleted: 0 });
    expect(await cleanupExpiredGrants()).toMatchObject({ matched: 1, deleted: 1 });
    expect(await db.McpOAuthRefresh.count({ where: { grant_id: approved.id } })).toBe(0);
    expect((await f.rpc(issued.access_token)).status).toBe(401);
  });

  it("reads JSON arrays returned as text without weakening callback matching", async () => {
    const grant = db.McpOAuthGrant.build();
    grant.setDataValue("scopes", '["data:read"]');
    grant.setDataValue("project_ids", "[1,2]");
    expect(grant.scopes).toEqual(["data:read"]);
    expect(grant.project_ids).toEqual([1, 2]);
    const client = db.McpOAuthClient.build();
    client.setDataValue("redirectUris", '["https://app.example/callback"]');
    expect(client.redirectUris).toEqual(["https://app.example/callback"]);
    expect(client.redirectUris.includes("https://app.example")).toBe(false);
  });
});
