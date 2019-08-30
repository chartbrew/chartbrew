module.exports = {
  port: 3210,
  secret: process.env.CB_SECRET_DEV,
  client: "http://localhost:3000",
  api: "http://localhost:3210",
  adminMail: process.env.CB_ADMIN_MAIL,
  db: {
    dbName: process.env.CB_DB_NAME_DEV,
    dbUsername: process.env.CB_DB_USERNAME_DEV,
    dbPassword: process.env.CB_DB_PASSWORD_DEV,
    dbHost: process.env.CB_DB_HOST_DEV,
  },
  mailSettings: {
    host: process.env.CB_MAIL_HOST_DEV,
    port: 465,
    secure: true,
    auth: {
      user: process.env.CB_MAIL_USER_DEV,
      pass: process.env.CB_MAIL_PASS_DEV,
    },
  },
};
