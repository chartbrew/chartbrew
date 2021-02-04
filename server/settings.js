module.exports = {
  port: process.env.CB_API_PORT,
  secret: process.env.CB_SECRET,
  client: process.env.REACT_APP_CLIENT_HOST,
  api: process.env.CB_API_HOST,
  adminMail: process.env.CB_ADMIN_MAIL,
  mailSettings: {
    host: process.env.CB_MAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.CB_MAIL_USER,
      pass: process.env.CB_MAIL_PASS,
    },
  },
  teamRestricted: process.env.CB_RESTRICT_TEAMS,
};
