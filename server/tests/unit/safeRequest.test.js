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
});
