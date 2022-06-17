const jwt = require("jsonwebtoken");

const db = require("../models/models");
const userResponse = require("./userResponse");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";

  if (token) {
    try {
      const blacklisted = await db.TokenBlacklist.findOne({ where: { token } });
      if (blacklisted) return res.status(401).send("Unauthorized access.");
    } catch (e) { /** */ }

    return jwt.verify(token, settings.secret, (err, decoded) => {
      if (err) return res.status(401).send("Unauthorized access.");
      return db.User.findByPk(decoded.id).then((user) => {
        if (!user) return res.status(400).send("Could not process the request. Please try again.");

        const userObj = userResponse(user);
        userObj.token = token;
        userObj.admin = user.admin;

        req.user = userObj;
        return next();
      })
        .catch((error) => { return res.status(400).send(error); });
    });
  } else {
    return res.status(400).send("Token is missing.");
  }
};
