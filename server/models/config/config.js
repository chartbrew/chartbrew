const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });

module.exports = {
  development: {
    username: process.env.CB_DB_USERNAME_DEV,
    password: process.env.CB_DB_PASSWORD_DEV,
    database: process.env.CB_DB_NAME_DEV,
    host: process.env.CB_DB_HOST_DEV,
    dialect: "mysql"
  },
  test: {
    username: process.env.CB_DB_USERNAME_DEV,
    password: process.env.CB_DB_PASSWORD_DEV,
    database: process.env.CB_DB_NAME_DEV,
    host: process.env.CB_DB_HOST_DEV,
    dialect: "mysql"
  },
  production: {
    username: process.env.CB_DB_USERNAME,
    password: process.env.CB_DB_PASSWORD,
    database: process.env.CB_DB_NAME,
    host: process.env.CB_DB_HOST,
    dialect: "mysql",
  }
};
