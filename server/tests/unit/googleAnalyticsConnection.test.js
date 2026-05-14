import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const googleMocks = {
  generateAuthUrl: vi.fn((params) => params),
  getToken: vi.fn(),
  latestOAuthClient: null,
  oauth2: vi.fn(),
  options: vi.fn(),
};

const adminMocks = {
  clientConstructor: vi.fn(),
  listAccountSummaries: vi.fn(),
};

const dataMocks = {
  clientConstructor: vi.fn(),
  getMetadata: vi.fn(),
  runReport: vi.fn(),
};

function OAuth2(clientId, clientSecret, redirectUrl) {
  this.clientId = clientId;
  this.clientSecret = clientSecret;
  this.redirectUrl = redirectUrl;
  this.handlers = {};
  this.generateAuthUrl = googleMocks.generateAuthUrl;
  this.getToken = googleMocks.getToken;
  this.setCredentials = vi.fn();
  this.on = vi.fn((event, handler) => {
    this.handlers[event] = handler;
  });
  this.emitTokens = (tokens) => {
    if (this.handlers.tokens) this.handlers.tokens(tokens);
  };
  googleMocks.latestOAuthClient = this;
}

const googleApisPath = require.resolve("googleapis");
require.cache[googleApisPath] = {
  id: googleApisPath,
  filename: googleApisPath,
  loaded: true,
  exports: {
    google: {
      auth: { OAuth2 },
      oauth2: googleMocks.oauth2,
      options: googleMocks.options,
    },
  },
};

const analyticsAdminPath = require.resolve("@google-analytics/admin");
require.cache[analyticsAdminPath] = {
  id: analyticsAdminPath,
  filename: analyticsAdminPath,
  loaded: true,
  exports: {
    AnalyticsAdminServiceClient: class AnalyticsAdminServiceClient {
      constructor(options) {
        adminMocks.clientConstructor(options);
      }

      listAccountSummaries() {
        return adminMocks.listAccountSummaries();
      }
    },
  },
};

const analyticsDataPath = require.resolve("@google-analytics/data");
require.cache[analyticsDataPath] = {
  id: analyticsDataPath,
  filename: analyticsDataPath,
  loaded: true,
  exports: {
    BetaAnalyticsDataClient: class BetaAnalyticsDataClient {
      constructor(options) {
        dataMocks.clientConstructor(options);
      }

      getMetadata(request) {
        return dataMocks.getMetadata(request);
      }

      runReport(request) {
        return dataMocks.runReport(request);
      }
    },
  },
};

const oauthController = require("../../controllers/OAuthController.js");
const googleAnalyticsConnectionPath = require.resolve(
  "../../sources/plugins/googleAnalytics/googleAnalytics.connection.js"
);
delete require.cache[googleAnalyticsConnectionPath];
const googleAnalyticsConnection = require(googleAnalyticsConnectionPath);

describe("googleAnalytics.connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleMocks.latestOAuthClient = null;
    googleMocks.generateAuthUrl.mockImplementation((params) => params);
    googleMocks.oauth2.mockReturnValue({
      userinfo: {
        get: vi.fn().mockResolvedValue({ data: { email: "user@example.com" } }),
      },
    });
    adminMocks.listAccountSummaries.mockResolvedValue([[{ account: "accounts/1" }]]);
  });

  it("requests offline consent so Google returns a refresh token during re-auth", () => {
    const authUrl = googleAnalyticsConnection.getAuthUrl(1, 2, "googleAnalytics");

    expect(authUrl).toMatchObject({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      state: "1,2,googleAnalytics",
    });
    expect(authUrl.scope).toContain("https://www.googleapis.com/auth/analytics.readonly");
    expect(authUrl.scope).toContain("https://www.googleapis.com/auth/userinfo.email");
  });

  it("rejects callback tokens that cannot be used for offline API calls", async () => {
    googleMocks.getToken.mockResolvedValue({ tokens: { access_token: "access-token" } });

    await expect(googleAnalyticsConnection.getToken("auth-code"))
      .rejects.toThrow("Google did not return a refresh token");
  });

  it("stores a new refresh token emitted while listing account summaries", async () => {
    const updateSpy = vi.spyOn(oauthController, "update").mockResolvedValue({});
    adminMocks.listAccountSummaries.mockImplementation(async () => {
      googleMocks.latestOAuthClient.emitTokens({ refresh_token: "fresh-refresh-token" });
      return [[{ account: "accounts/1" }]];
    });

    const accounts = await googleAnalyticsConnection.getAccounts("old-refresh-token", "oauth-1");

    expect(accounts).toEqual([{ account: "accounts/1" }]);
    expect(updateSpy).toHaveBeenCalledWith("oauth-1", { refreshToken: "fresh-refresh-token" });
    expect(adminMocks.clientConstructor).toHaveBeenCalledWith({
      authClient: googleMocks.latestOAuthClient,
    });
  });

  it("returns an actionable error for invalid Google refresh tokens", async () => {
    adminMocks.listAccountSummaries.mockRejectedValue({
      details: "Getting metadata from plugin failed with error: invalid_grant",
    });

    await expect(googleAnalyticsConnection.getAccounts("revoked-refresh-token", "oauth-1"))
      .rejects.toThrow("refresh token is invalid or expired");
  });

  it("rejects reports without a GA4 property before calling the API", async () => {
    await expect(googleAnalyticsConnection.getAnalytics(
      { id: "oauth-1", refreshToken: "refresh-token" },
      { configuration: { metrics: "sessions" } }
    )).rejects.toThrow("Google Analytics propertyId is required");

    expect(dataMocks.runReport).not.toHaveBeenCalled();
  });
});
