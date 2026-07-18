const jwt = require("jsonwebtoken");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (token) => {
  return jwt.verify(token, settings.encryptionKey, { algorithms: ["HS256"] });
};
