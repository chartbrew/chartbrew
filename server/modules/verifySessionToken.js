const jwt = require("jsonwebtoken");

const settings = require("../settings");

module.exports = (token) => {
  const decoded = jwt.verify(token, settings.encryptionKey, { algorithms: ["HS256"] });
  if (Object.hasOwn(decoded, "newEmail")) {
    throw new Error("Email-change tokens cannot authenticate a session");
  }
  if (Object.hasOwn(decoded, "tokenType")) {
    throw new Error("Purpose-specific tokens cannot authenticate a session");
  }

  return decoded;
};

module.exports.isCurrentSession = (decoded, user) => {
  return (decoded.sessionVersion ?? 0) === (user.sessionVersion ?? 0);
};
