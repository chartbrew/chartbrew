import { createRequire } from "module";
import {
  afterEach, beforeEach, describe, expect, it,
} from "vitest";

const require = createRequire(import.meta.url);
const express = require("express");
const request = require("supertest");

const bullBoardAuth = require("../../middlewares/bullBoardAuth");

describe("bullBoardAuth", () => {
  let app;

  beforeEach(() => {
    process.env.CB_BULLMQ_USERNAME = "queue-admin";
    process.env.CB_BULLMQ_PASSWORD = "a-strong-test-password";

    app = express();
    app.use("/apps/queues", bullBoardAuth, (req, res) => res.status(200).send("Bull Board"));
  });

  afterEach(() => {
    delete process.env.CB_BULLMQ_USERNAME;
    delete process.env.CB_BULLMQ_PASSWORD;
  });

  it("rejects requests without credentials", async () => {
    const response = await request(app).get("/apps/queues");

    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toContain("Basic");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("rejects invalid credentials", async () => {
    const response = await request(app)
      .get("/apps/queues/api/queues")
      .auth("queue-admin", "wrong-password");

    expect(response.status).toBe(401);
  });

  it("protects the full route and accepts valid credentials", async () => {
    const response = await request(app)
      .get("/apps/queues/api/queues")
      .auth("queue-admin", "a-strong-test-password");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Bull Board");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("fails closed when credentials are not configured", async () => {
    delete process.env.CB_BULLMQ_PASSWORD;

    const response = await request(app).get("/apps/queues");

    expect(response.status).toBe(503);
  });
});
