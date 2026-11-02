const helmet = require("helmet");

module.exports = helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  // Preserve the existing HTTPS policy when upgrading Helmet.
  strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
});
