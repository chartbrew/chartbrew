module.exports = {
  port: 3210,
  secret: process.env.CB_SECRET,
  client: "https://chartbrew.com",
  api: "https://api.chartbrew.com",
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
};
