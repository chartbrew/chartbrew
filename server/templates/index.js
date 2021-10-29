/* Community templates */
const simpleanalytics = require("./simpleanalytics/model");
const chartmogul = require("./chartmogul/model");
const mailgun = require("./mailgun/model");
const googleAnalytics = require("./googleAnalytics/model");
const plausible = require("./plausible/model");

/* Custom template */
const custom = require("./custom/model");

module.exports = {
  simpleanalytics,
  chartmogul,
  mailgun,
  googleAnalytics,
  plausible,
  custom,
};
