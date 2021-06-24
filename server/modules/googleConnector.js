const { google } = require("googleapis");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    settings.google.client_id,
    settings.google.client_secret,
    `http://${settings.client}${settings.google.redirect_url}`,
  );
};

module.exports.getAuthUrl = (project_id, connection_id) => {
  const oauth2Client = getOAuthClient();

  // generate a url that asks permissions for Google analytics and user email
  const scopes = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: `${project_id},${connection_id}`,
  });

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

module.exports.getAccounts = async (refreshToken) => {
  const oauth2Client = getOAuthClient();

  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    google.options({ auth: oauth2Client });

    const admin = google.analytics("v3");
    const accounts = await admin.management.accountSummaries.list();

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

module.exports.getAnalytics = async (refreshToken, dataRequest) => {
  const oauth2Client = getOAuthClient();

  const { configuration } = dataRequest;

  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    google.options({ auth: oauth2Client });

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

    rows.forEach((row) => {
      const newRow = {};
      if (row.dimensions) {
        [newRow[xAxis]] = row.dimensions;
      }
      [newRow[yAxis]] = row.metrics[0].values;

      newRows.push(newRow);
    });

    return newRows;
  } catch (error) {
    return Promise.reject(error);
  }
};
