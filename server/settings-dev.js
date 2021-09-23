module.exports = {
  port: process.env.CB_API_PORT_DEV,
  secret: process.env.CB_SECRET_DEV,
  client: process.env.REACT_APP_CLIENT_HOST_DEV,
  api: process.env.CB_API_HOST_DEV,
  adminMail: process.env.CB_ADMIN_MAIL_DEV,
  mailSettings: {
    host: process.env.CB_MAIL_HOST_DEV,
    port: 465,
    secure: true,
    auth: {
      user: process.env.CB_MAIL_USER_DEV,
      pass: process.env.CB_MAIL_PASS_DEV,
    },
  },
  google: {
    client_id: process.env.CB_GOOGLE_CLIENT_ID_DEV,
    client_secret: process.env.CB_GOOGLE_CLIENT_SECRET_DEV,
    redirect_url: "/google-auth",
  },
  teamRestricted: process.env.CB_RESTRICT_TEAMS_DEV,
  chartbrewMainAPI: "https://api.chartbrew.com",
};
