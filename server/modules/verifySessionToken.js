const jwt = require("jsonwebtoken");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (token) => {
  const decoded = jwt.verify(token, settings.encryptionKey, { algorithms: ["HS256"] });
  if (Object.hasOwn(decoded, "newEmail")) {
    throw new Error("Email-change tokens cannot authenticate a session");
  }

  return decoded;
};
