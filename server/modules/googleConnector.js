const { google } = require("googleapis");
const { formatISO } = require("date-fns");

const oauthController = require("../controllers/OAuthController");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    settings.google.client_id,
    settings.google.client_secret,
    `${settings.client}${settings.google.redirect_url}`,
  );
};

module.exports.getAuthUrl = (project_id, connection_id, type) => {
  const oauth2Client = getOAuthClient();

  // generate a url that asks permissions for Google analytics and user email
  const scopes = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  const authParams = {
    access_type: "offline",
    scope: scopes,
    state: `${project_id},${connection_id}`,
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

    const admin = google.analytics("v3");
    const accounts = await admin.management.accountSummaries.list();

    // record the new refresh token in the DB as it's created
    if (oauth_id) {
      oauth2Client.on("tokens", (tokens) => {
        if (tokens.refresh_token) {
          oauthController.update(oauth_id, { refreshToken: tokens.refresh_token });
        }
      });
    }

    return accounts.data;
  } catch (e) {
    return Promise.reject(e);
  }
};

module.exports.getMetadata = async (refreshToken) => {
  const oauth2Client = getOAuthClient();

  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    google.options({ auth: oauth2Client });

    const admin = google.analytics("v3");
    const metadata = await admin.metadata.columns.list({ reportType: "ga" });

    return metadata.data;
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

    const reporting = google.analyticsreporting("v4");

    const getOptions = {
      requestBody: {
        reportRequests: [{
          viewId: configuration.viewId,
          dateRanges: [{
            startDate: configuration.startDate,
            endDate: configuration.endDate,
          }],
          metrics: [{
            expression: configuration.metrics,
          }],
        }],
      },
    };
    if (configuration.dimensions) {
      getOptions.requestBody.reportRequests[0].dimensions = [{
        name: configuration.dimensions,
      }];
    }
    const res = await reporting.reports.batchGet(getOptions);

    return this.formatGaData(res.data);
  } catch (e) {
    return Promise.reject(e);
  }
};

module.exports.formatGaData = (data) => {
  try {
    const { rows } = data.reports[0].data;
    const newRows = [];

    const headers = data.reports[0].columnHeader;
    const xAxis = headers.dimensions && headers.dimensions[0];
    const yAxis = headers.metricHeader.metricHeaderEntries[0].name;

    if (!rows) return Promise.reject("No data found");

    rows.forEach((row) => {
      const newRow = {};
      if (row.dimensions) {
        let [dimension] = row.dimensions;
        if (xAxis === "ga:date") {
          dimension = new Date(
            dimension.substring(0, 4),
            parseInt(dimension.substring(4, 6), 10) - 1,
            dimension.substring(6, 8)
          );
          dimension = formatISO(dimension);
        }
        if (xAxis === "ga:dateHour") {
          dimension = new Date(
            dimension.substring(0, 4),
            parseInt(dimension.substring(4, 6), 10) - 1,
            dimension.substring(6, 8),
            dimension.substring(8, 10),
          );
          dimension = formatISO(dimension);
        }
        if (xAxis === "ga:dateHourMinute") {
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
      [newRow[yAxis]] = row.metrics[0].values;

      newRows.push(newRow);
    });

    return newRows;
  } catch (error) {
    return Promise.reject(error);
  }
};
