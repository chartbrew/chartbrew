import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dns = require("dns").promises;
const net = require("net");
const Sequelize = require("sequelize");
const { once } = require("events");
const { SocksClient } = require("socks");
const externalDbConnection = require("../../sources/shared/sql/externalDbConnection");
const getMongoOutboundOptions = require("../../sources/plugins/mongodb/mongodb.outbound");
const createClickHouseClient = require("../../sources/plugins/clickhouse/clickhouse.client");
const { resolveDatabaseTarget } = require("../../sources/shared/databaseTarget");

describe("database outbound policy", () => {
  beforeEach(() => vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "false"));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    () => externalDbConnection({ type: "mysql", host: "127.0.0.1", allowPrivateHost: true }),
    () => externalDbConnection({ type: "postgres", connectionString: "postgres://localhost/data" }),
    () => externalDbConnection({ type: "mysql", host: "8.8.8.8", useSsh: true, sshHost: "10.0.0.1" }),
    () => externalDbConnection({ type: "postgres", host: "10.0.0.1", useSsh: true, sshHost: "8.8.8.8" }),
    () => getMongoOutboundOptions("mongodb://8.8.8.8,192.168.1.1/data"),
    () => createClickHouseClient({ host: "[::1]" }),
  ])("rejects private destinations before the driver connects", async (connect) => {
    await expect(connect()).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
  });

  it("rejects a DNS answer that contains both public and private addresses", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "8.8.8.8" }, { address: "10.0.0.1" }]);
    await expect(resolveDatabaseTarget("db.example")).rejects.toMatchObject({ reason: "private_network" });
  });

  it("applies the operator setting and always blocks cloud metadata", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    expect(await resolveDatabaseTarget("10.0.0.1")).toBe("10.0.0.1");
    await expect(resolveDatabaseTarget("fd00:ec2:0:0:0:0:0:254")).rejects.toMatchObject({ reason: "metadata_endpoint" });
  });

  it.each(["postgres", "mysql"])("pins %s sockets and preserves the TLS hostname", async (type) => {
    const lookup = vi.spyOn(dns, "lookup").mockResolvedValueOnce([{ address: "8.8.8.8" }]);
    vi.spyOn(Sequelize.prototype, "authenticate").mockResolvedValue();
    const db = await externalDbConnection({ type, host: "db.example", port: 1234 });
    try {
      expect(db.config.host).toBe("db.example");
      const connect = vi.spyOn(net.Socket.prototype, "connect").mockReturnThis();
      const socket = db.config.dialectOptions.stream();
      if (type === "postgres") socket.connect(1234, "db.example");
      const [args] = connect.mock.calls[0];
      expect(Array.isArray(args) ? args[0] : args).toMatchObject({ host: "8.8.8.8", port: 1234 });
      socket.destroy();
      expect(lookup).toHaveBeenCalledTimes(1);
    } finally {
      await db.close();
    }
  });

  it("checks MongoDB replica destinations in the proxy before forwarding", async () => {
    const options = await getMongoOutboundOptions("mongodb+srv://cluster.example/data");
    await expect(SocksClient.createConnection({
      command: "connect",
      proxy: {
        host: options.proxyHost,
        port: options.proxyPort,
        type: 5,
        userId: options.proxyUsername,
        password: options.proxyPassword,
      },
      destination: { host: "10.0.0.1", port: 27017 },
      timeout: 2000,
    })).rejects.toThrow(/notallowed/i);
  });

  it("forwards data to an approved MongoDB destination", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "true");
    const server = net.createServer((socket) => socket.end("approved destination"));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const options = await getMongoOutboundOptions("mongodb://127.0.0.1/data");
      const { socket } = await SocksClient.createConnection({
        command: "connect",
        proxy: {
          host: options.proxyHost,
          port: options.proxyPort,
          type: 5,
          userId: options.proxyUsername,
          password: options.proxyPassword,
        },
        destination: { host: "127.0.0.1", port: server.address().port },
        timeout: 2000,
      });
      const [data] = await once(socket, "data");
      expect(data.toString()).toBe("approved destination");
      socket.destroy();
    } finally {
      server.close();
    }
  });

  it("rejects alternate transports in connection URLs", async () => {
    await expect(externalDbConnection({
      type: "mysql", connectionString: "mysql://db.example/data?socketPath=/tmp/mysql.sock",
    })).rejects.toThrow("Unsupported");
    await expect(getMongoOutboundOptions("mongodb://db.example/data?proxyHost=localhost")).rejects.toThrow("Unsupported");
  });
});
