import jwt from "jsonwebtoken";

/**
 * Authentication helper functions for tests
 */

/**
 * Generate a JWT token for testing
 */
export function generateTestToken(payload = {}, options = {}) {
  const defaultPayload = {
    id: 1,
    email: "test@example.com",
    name: "Test User",
    ...payload
  };

  const defaultOptions = {
    expiresIn: "1h",
    ...options
  };

  const secret = process.env.CB_SECRET || "test-secret-key-for-testing-only";
  return jwt.sign(defaultPayload, secret, defaultOptions);
}

/**
 * Generate auth headers for testing
 */
export function getAuthHeaders(token = null) {
  const testToken = token || generateTestToken();
  return {
    Authorization: `Bearer ${testToken}`,
    "Content-Type": "application/json"
  };
}

/**
 * Generate admin token for testing
 */
export function generateAdminToken(overrides = {}) {
  return generateTestToken({
    id: 1,
    email: "admin@example.com",
    name: "Admin User",
    admin: true,
    ...overrides
  });
}

/**
 * Get admin auth headers
 */
export function getAdminAuthHeaders() {
  return getAuthHeaders(generateAdminToken());
}

/**
 * Verify a JWT token (for testing token generation)
 */
export function verifyTestToken(token) {
  const secret = process.env.CB_SECRET || "test-secret-key-for-testing-only";
  return jwt.verify(token, secret);
}
