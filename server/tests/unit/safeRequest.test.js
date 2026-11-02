import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const dns = require("dns");
const dnsPromises = dns.promises;
const http = require("http");

const safeRequest = require("../../modules/safeRequest");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("safeRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not re-resolve a validated hostname to a private address", async () => {
    let localhostReached = false;
    const server = http.createServer((req, res) => {
      localhostReached = true;
      res.end("private service reached");
    });
    const { port } = await listen(server);

    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
    ]);
    const originalLookup = dns.lookup;
    vi.spyOn(dns, "lookup").mockImplementation((hostname, options, callback) => {
      if (hostname === "rebind.chartbrew.test") {
        const opts = typeof options === "function" ? {} : options || {};
        const cb = typeof options === "function" ? options : callback;
        process.nextTick(() => {
          if (opts.all) {
            cb(null, [{ address: "127.0.0.1", family: 4 }]);
            return;
          }

          cb(null, "127.0.0.1", 4);
        });
        return undefined;
      }

      return originalLookup(hostname, options, callback);
    });

    try {
      await expect(safeRequest({
        url: `http://rebind.chartbrew.test:${port}/metadata-like-path`,
        method: "GET",
        timeout: 100,
      }, { allowPrivateHost: false })).rejects.toBeTruthy();
      expect(localhostReached).toBe(false);
    } finally {
      await close(server);
    }
  });

  it("preserves normal requests and the original host header with a pinned address", async () => {
    let receivedHost = null;
    const server = http.createServer((req, res) => {
      receivedHost = req.headers.host;
      res.end("ok");
    });
    const { port } = await listen(server);

    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ]);

    try {
      const body = await safeRequest({
        url: `http://api.chartbrew.test:${port}/health`,
        method: "GET",
      }, { allowPrivateHost: true });

      expect(body).toBe("ok");
      expect(receivedHost).toBe(`api.chartbrew.test:${port}`);
    } finally {
      await close(server);
    }
  });

  it("stops an outbound response after its byte limit", async () => {
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/plain");
      res.write("12345");
      res.end("67890");
    });
    const { port } = await listen(server);
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ]);
    try {
      await expect(safeRequest({
        url: `http://response.chartbrew.test:${port}/large`,
        method: "GET",
        maximumResponseBytes: 5,
      }, { allowPrivateHost: true })).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    } finally {
      await close(server);
    }
  });

  it("validates every redirect before following it", async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 302;
      res.setHeader("Location", "http://169.254.169.254/latest/meta-data");
      res.end();
    });
    const { port } = await listen(server);
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ]);
    try {
      await expect(safeRequest({
        url: `http://redirect.chartbrew.test:${port}/start`,
        method: "GET",
        followRedirect: true,
        resolveWithFullResponse: true,
        simple: false,
      }, { allowPrivateHost: true })).rejects.toMatchObject({
        code: "SSRF_BLOCKED",
        reason: "metadata_endpoint",
      });
    } finally {
      await close(server);
    }
  });

  it("preserves nested query values, JSON bodies and basic authentication", async () => {
    let received;
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received = { url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
      res.setHeader("Content-Type", "application/json");
      res.end('{"ok":true}');
    });
    const { port } = await listen(server);
    try {
      const result = await safeRequest({
        url: `http://127.0.0.1:${port}/records?existing=yes`,
        method: "POST",
        qs: { created: { gte: 123 }, fields: ["name", "value"] },
        auth: { user: "user", pass: "password" },
        body: { enabled: true },
        json: true,
      }, { allowPrivateHost: true });
      expect(result).toEqual({ ok: true });
      const query = new URL(received.url, "http://localhost").searchParams;
      expect(query.get("existing")).toBe("yes");
      expect(query.get("created[gte]")).toBe("123");
      expect(query.get("fields[0]")).toBe("name");
      expect(received.headers.authorization).toBe(`Basic ${Buffer.from("user:password").toString("base64")}`);
      expect(received.headers["content-type"]).toBe("application/json");
      expect(JSON.parse(received.body)).toEqual({ enabled: true });
    } finally {
      await close(server);
    }
  });

  it("preserves nested form encoding and bearer authentication", async () => {
    let received;
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received = { headers: req.headers, body: Buffer.concat(chunks).toString() };
      res.end("ok");
    });
    const { port } = await listen(server);
    try {
      await safeRequest({
        url: `http://127.0.0.1:${port}/form`,
        method: "POST",
        auth: { bearer: "token" },
        form: { name: "two words", series: { "2026-01-01": 42 } },
      }, { allowPrivateHost: true });
      expect(received.headers.authorization).toBe("Bearer token");
      expect(received.headers["content-type"]).toBe("application/x-www-form-urlencoded");
      expect(new URLSearchParams(received.body).get("series[2026-01-01]")).toBe("42");
      expect(received.body).toContain("name=two+words");
    } finally {
      await close(server);
    }
  });

  it("preserves HTTP error details and full responses when errors are allowed", async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 403;
      res.end('{"message":"Access denied"}');
    });
    const { port } = await listen(server);
    const options = { url: `http://127.0.0.1:${port}/error`, json: true };
    try {
      await expect(safeRequest(options, { allowPrivateHost: true })).rejects.toMatchObject({
        statusCode: 403, error: { message: "Access denied" },
      });
      await expect(safeRequest({ ...options, simple: false, resolveWithFullResponse: true }, {
        allowPrivateHost: true,
      })).resolves.toMatchObject({ statusCode: 403, body: { message: "Access denied" } });
    } finally {
      await close(server);
    }
  });

  it("follows redirects without repeating the original query or leaking credentials", async () => {
    let received;
    const destination = http.createServer((req, res) => {
      received = { url: req.url, headers: req.headers };
      res.end("ok");
    });
    const target = await listen(destination);
    const server = http.createServer((req, res) => {
      res.writeHead(302, { location: `http://127.0.0.1:${target.port}/next?page=2` });
      res.end();
    });
    const { port } = await listen(server);
    try {
      const result = await safeRequest({
        url: `http://127.0.0.1:${port}/start`,
        qs: { page: 1 },
        auth: { bearer: "secret" },
        headers: { Cookie: "session=secret" },
      }, { allowPrivateHost: true });
      expect(result).toBe("ok");
      expect(received.url).toBe("/next?page=2");
      expect(received.headers.authorization).toBeUndefined();
      expect(received.headers.cookie).toBeUndefined();
    } finally {
      await close(server);
      await close(destination);
    }
  });

  it("changes POST to GET for 303 redirects and removes body headers", async () => {
    let received;
    const server = http.createServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(303, { location: "/next" });
      } else {
        received = { method: req.method, headers: req.headers };
      }
      res.end();
    });
    const { port } = await listen(server);
    try {
      await safeRequest({
        url: `http://127.0.0.1:${port}/start`, method: "POST", body: { value: 1 }, json: true,
      }, { allowPrivateHost: true });
      expect(received.method).toBe("GET");
      expect(received.headers["content-type"]).toBeUndefined();
      expect(received.headers["content-length"]).toBeUndefined();
    } finally {
      await close(server);
    }
  });

  it("bounds redirects and preserves an explicitly disabled redirect", async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(302, { location: "/loop" });
      res.end();
    });
    const { port } = await listen(server);
    const options = { url: `http://127.0.0.1:${port}/loop` };
    try {
      await expect(safeRequest({ ...options, maxRedirects: 1 }, { allowPrivateHost: true }))
        .rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
      await expect(safeRequest({ ...options, followRedirect: false, simple: false, resolveWithFullResponse: true }, {
        allowPrivateHost: true,
      })).resolves.toMatchObject({ statusCode: 302 });
    } finally {
      await close(server);
    }
  });

  it("preserves binary responses and rejects advertised oversized responses", async () => {
    const payload = Buffer.from([0, 128, 255]);
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Length", payload.length);
      res.end(payload);
    });
    const { port } = await listen(server);
    const options = { url: `http://127.0.0.1:${port}/image`, encoding: null };
    try {
      expect(await safeRequest(options, { allowPrivateHost: true })).toEqual(payload);
      await expect(safeRequest({ ...options, maximumResponseBytes: 2 }, { allowPrivateHost: true }))
        .rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    } finally {
      await close(server);
    }
  });

  it("preserves URL credentials and an already serialized JSON body", async () => {
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      res.end(JSON.stringify({
        authorization: req.headers.authorization,
        contentType: req.headers["content-type"],
        body: Buffer.concat(chunks).toString(),
      }));
    });
    const { port } = await listen(server);
    try {
      expect(await safeRequest({
        url: `http://user:p%40ss@127.0.0.1:${port}/json`,
        method: "POST",
        body: '{"value":1}',
        json: true,
      }, { allowPrivateHost: true })).toEqual({
        authorization: `Basic ${Buffer.from("user:p@ss").toString("base64")}`,
        contentType: "application/json",
        body: '{"value":1}',
      });
    } finally {
      await close(server);
    }
  });

  it("cancels a response that does not finish before the timeout", async () => {
    const server = http.createServer((req, res) => {
      res.write("partial");
    });
    const { port } = await listen(server);
    try {
      await expect(safeRequest({ url: `http://127.0.0.1:${port}/slow`, timeout: 50 }, {
        allowPrivateHost: true,
      })).rejects.toMatchObject({ code: "ETIMEDOUT" });
    } finally {
      await close(server);
    }
  });
});
