import { describe, it, expect } from "vitest";
import {
  generateTestToken,
  getAuthHeaders,
  generateAdminToken,
  getAdminAuthHeaders,
  verifyTestToken
} from "../helpers/authHelpers.js";

describe("Auth Helpers", () => {
  describe("generateTestToken", () => {
    it("should generate a valid JWT token", () => {
      const token = generateTestToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts separated by dots
    });

    it("should include default payload", () => {
      const token = generateTestToken();
      const decoded = verifyTestToken(token);

      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe("test@example.com");
      expect(decoded.name).toBe("Test User");
      expect(decoded.exp).toBeDefined(); // Expiration time
    });

    it("should allow payload overrides", () => {
      const token = generateTestToken({
        id: 999,
        email: "custom@example.com",
        customField: "test"
      });

      const decoded = verifyTestToken(token);
      expect(decoded.id).toBe(999);
      expect(decoded.email).toBe("custom@example.com");
      expect(decoded.customField).toBe("test");
    });

    it("should allow options overrides", () => {
      const token = generateTestToken({}, { expiresIn: "2h" });
      const decoded = verifyTestToken(token);

      // Check that expiration is roughly 2 hours from now
      const now = Math.floor(Date.now() / 1000);
      const twoHours = 2 * 60 * 60;
      expect(decoded.exp).toBeGreaterThan(now + twoHours - 60); // Allow 1 minute tolerance
    });
  });

  describe("getAuthHeaders", () => {
    it("should return proper auth headers", () => {
      const headers = getAuthHeaders();

      expect(headers).toHaveProperty("Authorization");
      expect(headers).toHaveProperty("Content-Type");
      expect(headers.Authorization).toMatch(/^Bearer /);
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should use custom token when provided", () => {
      const customToken = "custom-token-123";
      const headers = getAuthHeaders(customToken);

      expect(headers.Authorization).toBe(`Bearer ${customToken}`);
    });
  });

  describe("generateAdminToken", () => {
    it("should generate admin token with admin privileges", () => {
      const token = generateAdminToken();
      const decoded = verifyTestToken(token);

      expect(decoded.admin).toBe(true);
      expect(decoded.email).toBe("admin@example.com");
      expect(decoded.name).toBe("Admin User");
    });

    it("should allow admin token overrides", () => {
      const token = generateAdminToken({
        email: "superadmin@example.com",
        customPerm: true
      });

      const decoded = verifyTestToken(token);
      expect(decoded.admin).toBe(true);
      expect(decoded.email).toBe("superadmin@example.com");
      expect(decoded.customPerm).toBe(true);
    });
  });

  describe("getAdminAuthHeaders", () => {
    it("should return admin auth headers", () => {
      const headers = getAdminAuthHeaders();

      expect(headers).toHaveProperty("Authorization");
      expect(headers.Authorization).toMatch(/^Bearer /);

      // Extract and verify the token
      const token = headers.Authorization.replace("Bearer ", "");
      const decoded = verifyTestToken(token);
      expect(decoded.admin).toBe(true);
    });
  });

  describe("verifyTestToken", () => {
    it("should verify valid tokens", () => {
      const token = generateTestToken({ testField: "value" });
      const decoded = verifyTestToken(token);

      expect(decoded.testField).toBe("value");
    });

    it("should throw on invalid tokens", () => {
      expect(() => {
        verifyTestToken("invalid-token");
      }).toThrow();
    });
  });
});
