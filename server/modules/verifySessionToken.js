const jwt = require("jsonwebtoken");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (token) => {
  return jwt.verify(token, settings.encryptionKey, { algorithms: ["HS256"] });
};

module.exports.isCurrentSession = (decoded, user) => {
  return (decoded.sessionVersion ?? 0) === (user.sessionVersion ?? 0);
};
