const { google } = require("googleapis");
const { formatISO } = require("date-fns");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const analyticsAdmin = require("@google-analytics/admin");

const oauthController = require("../controllers/OAuthController");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    settings.google.client_id,
    settings.google.client_secret,
    `${settings.client}${settings.google.redirect_url}`,
  );
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
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    google.options({ auth: oauth2Client });

    const analyticsAdminClient = new analyticsAdmin.AnalyticsAdminServiceClient({
      authClient: oauth2Client
    });
    const [ga4Accounts] = await analyticsAdminClient.listAccountSummaries();

    // record the new refresh token in the DB as it's created
    if (oauth_id) {
      oauth2Client.on("tokens", (tokens) => {
        if (tokens.refresh_token) {
          oauthController.update(oauth_id, { refreshToken: tokens.refresh_token });
        }
      });
    }

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
    return Promise.reject(e);
  }
};

module.exports.getMetadata = async (refreshToken, propertyId) => {
  const oauth2Client = getOAuthClient();

  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    google.options({ auth: oauth2Client });

    const analyticsDataClient = new BetaAnalyticsDataClient({ authClient: oauth2Client });
    const ga4Metadata = await analyticsDataClient.getMetadata({ name: `${propertyId}/metadata` });

    if (ga4Metadata?.[0]) return ga4Metadata[0];

    return ga4Metadata;
  } catch (e) {
    return Promise.reject(e);
  }
};

module.exports.getAnalytics = async (oauth, dataRequest) => {
  const oauth2Client = getOAuthClient();

  const { configuration } = dataRequest;

  try {
    oauth2Client.setCredentials({ refresh_token: oauth.refreshToken });
    google.options({ auth: oauth2Client });

    // record the new refresh token in the DB as it's created
    if (oauth && oauth.id) {
      oauth2Client.on("tokens", (tokens) => {
        if (tokens.refresh_token) {
          oauthController.update(oauth.id, { refreshToken: tokens.refresh_token });
        }
      });
    }

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
    return Promise.reject(e);
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
