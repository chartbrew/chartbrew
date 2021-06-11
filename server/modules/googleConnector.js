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
