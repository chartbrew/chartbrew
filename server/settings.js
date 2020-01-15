module.exports = {
  port: 3210,
  secret: process.env.CB_SECRET,
  client: process.env.CB_CLIENT,
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
};
