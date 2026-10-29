const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const config = {
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
};

module.exports = {
  development: config,
  test: config,
  production: config,
};
