import { describe, expect, it } from "vitest";

const { normalizeSqlQuery } = require("../../sources/shared/sql/readOnlyQuery");

const externalFunctions = ["file", "url", "urlCluster", "s3", "s3Cluster", "remote", "remoteSecure", "mysql", "postgresql"];

describe("read-only SQL external access", () => {
  it.each(externalFunctions)("blocks %s, including quoted names and mixed case", (name) => {
    for (const identifier of [name, name.toUpperCase(), `"${name}"`, `\`${name}\``]) {
      expect(() => normalizeSqlQuery(`SELECT * FROM ${identifier} ('169.254.169.254', 'db', 'table', 'user', 'password')`))
        .toThrow("Query contains blocked operations");
    }
  });

  it("allows ordinary reads and columns with similar names", () => {
    const query = "SELECT remote, mysql_version, sum(amount) FROM orders GROUP BY remote, mysql_version";
    expect(normalizeSqlQuery(query)).toBe(query);
    expect(normalizeSqlQuery("SELECT * FROM numbers(10)")).toBe("SELECT * FROM numbers(10)");
  });
});
