/* Community templates */
const simpleanalytics = require("./simpleanalytics/model");
const chartmogul = require("./chartmogul/model");
const mailgun = require("./mailgun/model");
const googleAnalytics = require("./googleAnalytics/model");

/* Custom template */
const custom = require("./custom/model");

module.exports = {
  simpleanalytics,
  chartmogul,
  mailgun,
  googleAnalytics,
  custom,
};
