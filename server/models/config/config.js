const path = require("path");
// require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });
require("dotenv").config();

module.exports = {
  development: {
    username: process.env.CB_DB_USERNAME_DEV,
    password: process.env.CB_DB_PASSWORD_DEV,
    database: process.env.CB_DB_NAME_DEV,
    host: process.env.CB_DB_HOST_DEV,
    dialect: process.env.CB_DB_DIALECT_DEV || "mysql",
    port: process.env.CB_DB_PORT_DEV || 3306,
    cert: process.env.CB_DB_CERT_DEV,
    ssl: process.env.CB_DB_SSL_DEV || false,
    sslKey: process.env.CB_DB_SSL_KEY_DEV,
    sslCert: process.env.CB_DB_SSL_CERT_DEV,
  },
  test: {
    username: process.env.CB_DB_USERNAME_DEV,
    password: process.env.CB_DB_PASSWORD_DEV,
    database: process.env.CB_DB_NAME_DEV,
    host: process.env.CB_DB_HOST_DEV,
    dialect: process.env.CB_DB_DIALECT_DEV || "mysql",
    port: process.env.CB_DB_PORT_DEV || 3306,
    cert: process.env.CB_DB_CERT_DEV,
    ssl: process.env.CB_DB_SSL_DEV || false,
    sslKey: process.env.CB_DB_SSL_KEY_DEV,
    sslCert: process.env.CB_DB_SSL_CERT_DEV,
  },
  production: {
    username: process.env.CB_DB_USERNAME,
    password: process.env.CB_DB_PASSWORD,
    database: process.env.CB_DB_NAME,
    host: process.env.CB_DB_HOST,
    dialect: process.env.CB_DB_DIALECT || "mysql",
    port: process.env.CB_DB_PORT || 3306,
    cert: process.env.CB_DB_CERT,
    ssl: process.env.CB_DB_SSL || false,
    sslKey: process.env.CB_DB_SSL_KEY,
    sslCert: process.env.CB_DB_SSL_CERT,
  }
};
