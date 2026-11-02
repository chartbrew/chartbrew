import { afterEach, describe, expect, it, vi } from "vitest";
import { testDbManager } from "../helpers/testDbManager.js";

afterEach(() => vi.unstubAllEnvs());

describe("reusable test database", () => {
  it("rejects application databases before connecting or clearing tables", () => {
    vi.stubEnv("CB_TEST_DB_REUSE", "1");
    vi.stubEnv("CB_DB_NAME", "chartbrew");
    vi.stubEnv("CB_DB_PORT", "3306");
    expect(() => testDbManager.getReusableConnectionDetails()).toThrow("test segment");
  });

  it("accepts an explicitly selected test database", () => {
    vi.stubEnv("CB_TEST_DB_REUSE", "1");
    vi.stubEnv("CB_DB_NAME", "chartbrew_test");
    vi.stubEnv("CB_DB_PORT", "3306");
    expect(testDbManager.getReusableConnectionDetails()).toMatchObject({
      database: "chartbrew_test", port: 3306,
    });
  });

  it("uses a container unless reuse is explicitly enabled", () => {
    vi.stubEnv("CB_TEST_DB_REUSE", "0");
    vi.stubEnv("CB_DB_NAME", "chartbrew");
    expect(testDbManager.getReusableConnectionDetails()).toBeNull();
  });
});
