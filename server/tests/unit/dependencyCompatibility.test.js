import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import cors from "cors";
import request from "supertest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const securityHeaders = require("../../middlewares/securityHeaders");
const multer = require("multer");
const { v4, v5, validate, version } = require("uuid");

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

describe("dependency compatibility", () => {
  it("preserves the Helmet 7 headers without adding cross-origin asset restrictions", () => {
    const headers = {};
    securityHeaders({}, {
      setHeader: (name, value) => { headers[name] = value; },
      removeHeader: (name) => { delete headers[name]; },
    }, () => {});

    expect(headers).toEqual({
      "Content-Security-Policy": "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Origin-Agent-Cluster": "?1",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-DNS-Prefetch-Control": "off",
      "X-Download-Options": "noopen",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Permitted-Cross-Domain-Policies": "none",
      "X-XSS-Protection": "0",
    });
  });

  it("serves static assets to another origin with CORS enabled", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chartbrew-assets-"));
    temporaryDirectories.push(directory);
    await fs.writeFile(path.join(directory, "logo.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
    const app = express();
    app.use(securityHeaders);
    app.use(cors());
    app.use("/uploads", express.static(directory));

    const response = await request(app).get("/uploads/logo.svg").set("Origin", "https://dashboard.example.com");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.headers["cross-origin-resource-policy"]).toBeUndefined();
    expect(response.headers["cross-origin-embedder-policy"]).toBeUndefined();
  });

  it("keeps disk uploads and size errors compatible with the connection routes", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chartbrew-multer-"));
    temporaryDirectories.push(directory);
    const app = express();
    const upload = multer({ dest: directory, limits: { fileSize: 1024 * 1024 } });
    app.post("/files", upload.any(), (req, res) => res.json(req.files));
    app.use((error, req, res, next) => {
      if (error instanceof multer.MulterError) return res.status(400).json({ code: error.code });
      return next(error);
    });

    const accepted = await request(app).post("/files").attach("file", Buffer.from("test"), "test.txt");
    expect(accepted.status).toBe(200);
    expect(await fs.readFile(accepted.body[0].path, "utf8")).toBe("test");

    const rejected = await request(app).post("/files").attach("file", Buffer.alloc(1024 * 1024 + 1), "large.txt");
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe("LIMIT_FILE_SIZE");
    expect(await fs.readdir(directory)).toEqual([accepted.body[0].filename]);
  });

  it("preserves CommonJS UUID creation, validation and deterministic chart IDs", () => {
    const id = v4();
    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(4);
    expect(validate("not-a-uuid")).toBe(false);
    expect(v5("42:operation-1", v5.URL)).toBe("bff1fcfb-f6f9-5329-bc4d-6a487374647a");
  });
});
