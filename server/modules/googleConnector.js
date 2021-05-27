const { google } = require("googleapis");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const oauth2Client = new google.auth.OAuth2(
  settings.google.client_id,
  settings.google.client_secret,
  `http://${settings.client}${settings.google.redirect_url}`,
);

module.exports.getAuthUrl = () => {
  // generate a url that asks permissions for Google analytics
  const scopes = [
    "https://www.googleapis.com/auth/analytics.readonly"
  ];

  const url = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: "offline",

    // If you only need one scope you can pass it as a string
    scope: scopes,
    state: "connection_id",
  });

  return url;
};

module.exports.getToken = async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return Promise.resolve(tokens);
  } catch (err) {
    return Promise.reject(err);
  }
};
