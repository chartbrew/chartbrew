const { google } = require("googleapis");
const { formatISO } = require("date-fns");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const analyticsAdmin = require("@google-analytics/admin");

const oauthController = require("../../../controllers/OAuthController");

const settings = process.env.NODE_ENV === "production" ? require("../../../settings") : require("../../../settings-dev");

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    settings.google.client_id,
    settings.google.client_secret,
    `${settings.client}${settings.google.redirect_url}`,
  );
};

const persistNewRefreshToken = (oauth2Client, oauthId) => {
  if (!oauthId) return;

  oauth2Client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      oauthController.update(oauthId, { refreshToken: tokens.refresh_token });
    }
  });
};

const getGoogleOAuthError = (error) => {
  const message = error?.details || error?.message || error;
  if (typeof message === "string" && message.includes("invalid_grant")) {
    return new Error(
      "Google Analytics OAuth refresh token is invalid or expired. Reconnect Google Analytics so Chartbrew can store a new offline access token."
    );
  }

  return error;
};

module.exports.getAuthUrl = (team_id, connection_id, type) => {
  const oauth2Client = getOAuthClient();

  // generate a url that asks permissions for Google analytics and user email
  const scopes = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  const authParams = {
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: scopes,
    state: `${team_id},${connection_id}`,
  };
  if (type) authParams.state = `${authParams.state},${type}`;

  const url = oauth2Client.generateAuthUrl(authParams);

  return url;
};

module.exports.getToken = async (code) => {
  const oauth2Client = getOAuthClient();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Reconnect Google Analytics and approve offline access."
      );
    }

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });
    const { data } = await oauth2.userinfo.get({});

    return {
      user: data,
      tokens,
    };
  } catch (err) {
    return Promise.reject(err);
  }
};

module.exports.getAccounts = async (refreshToken, oauth_id) => {
  const oauth2Client = getOAuthClient();

  try {
    if (!refreshToken) {
      throw new Error("Google Analytics OAuth refresh token is missing. Reconnect Google Analytics.");
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    persistNewRefreshToken(oauth2Client, oauth_id);
    google.options({ auth: oauth2Client });

    const analyticsAdminClient = new analyticsAdmin.AnalyticsAdminServiceClient({
      authClient: oauth2Client
    });
    const [ga4Accounts] = await analyticsAdminClient.listAccountSummaries();

    const accountSummaries = [];
    if (ga4Accounts) {
      ga4Accounts.forEach((a) => {
        if (a) {
          accountSummaries.push(a);
        }
      });
    }

    return accountSummaries;
  } catch (e) {
    return Promise.reject(getGoogleOAuthError(e));
  }
};

module.exports.getMetadata = async (refreshToken, propertyId) => {
  const oauth2Client = getOAuthClient();

  try {
    if (!refreshToken) {
      throw new Error("Google Analytics OAuth refresh token is missing. Reconnect Google Analytics.");
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    google.options({ auth: oauth2Client });

    const analyticsDataClient = new BetaAnalyticsDataClient({ authClient: oauth2Client });
    const ga4Metadata = await analyticsDataClient.getMetadata({ name: `${propertyId}/metadata` });

    if (ga4Metadata?.[0]) return ga4Metadata[0];

    return ga4Metadata;
  } catch (e) {
    return Promise.reject(getGoogleOAuthError(e));
  }
};

module.exports.getAnalytics = async (oauth, dataRequest) => {
  const oauth2Client = getOAuthClient();

  const { configuration = {} } = dataRequest;

  try {
    if (!oauth.refreshToken) {
      throw new Error("Google Analytics OAuth refresh token is missing. Reconnect Google Analytics.");
    }
    if (!configuration.propertyId) {
      throw new Error("Google Analytics propertyId is required. Choose a GA4 property before running this report.");
    }
    if (!configuration.metrics) {
      throw new Error("Google Analytics metrics is required. Choose a GA4 metric before running this report.");
    }

    oauth2Client.setCredentials({ refresh_token: oauth.refreshToken });
    persistNewRefreshToken(oauth2Client, oauth.id);
    google.options({ auth: oauth2Client });

    const analyticsDataClient = new BetaAnalyticsDataClient({ authClient: oauth2Client });

    const getOptions = {
      property: `${configuration.propertyId}`,
      dateRanges: [{
        startDate: configuration.startDate,
        endDate: configuration.endDate,
      }],
      metrics: [{
        name: configuration.metrics,
      }],
    };

    if (configuration.dimensions) {
      getOptions.dimensions = [{
        name: configuration.dimensions,
      }];
    }

    const [response] = await analyticsDataClient.runReport(getOptions);

    return this.formatGaData(response);
  } catch (e) {
    return Promise.reject(getGoogleOAuthError(e));
  }
};

module.exports.formatGaData = (data) => {
  try {
    const { rows } = data;
    const newRows = [];

    const xAxis = data?.dimensionHeaders?.[0] && data?.dimensionHeaders?.[0].name;
    const yAxis = data?.metricHeaders?.[0] && data?.metricHeaders?.[0].name;

    if (!rows) return Promise.reject("No data found");

    rows.forEach((row) => {
      const newRow = {};
      if (row.dimensionValues?.length > 0) {
        let dimension = row.dimensionValues?.[0]?.value;
        if (xAxis === "date") {
          dimension = new Date(
            dimension.substring(0, 4),
            parseInt(dimension.substring(4, 6), 10) - 1,
            dimension.substring(6, 8)
          );
          dimension = formatISO(dimension);
        }
        if (xAxis === "dateHour") {
          dimension = new Date(
            dimension.substring(0, 4),
            parseInt(dimension.substring(4, 6), 10) - 1,
            dimension.substring(6, 8),
            dimension.substring(8, 10),
          );
          dimension = formatISO(dimension);
        }
        if (xAxis === "dateHourMinute") {
          dimension = new Date(
            dimension.substring(0, 4),
            parseInt(dimension.substring(4, 6), 10) - 1,
            dimension.substring(6, 8),
            dimension.substring(8, 10),
            dimension.substring(10, 12),
          );
          dimension = formatISO(dimension);
        }
        newRow[xAxis] = dimension;
      }

      if (row.metricValues?.length > 0) {
        newRow[yAxis] = row.metricValues[0].value;
      }

      newRows.push(newRow);
    });

    return newRows;
  } catch (error) {
    return Promise.reject(error);
  }
};
