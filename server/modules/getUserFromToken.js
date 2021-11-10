/* This module gets the user information from the token, but doesn't fail in any way */
const jwt = require("jsonwebtoken");

const db = require("../models/models");
const userResponse = require("./userResponse");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";

  if (token) {
    return jwt.verify(token, settings.secret, (err, decoded) => {
      if (err) return next();
      return db.User.findByPk(decoded.id).then((user) => {
        if (!user) return next();

        const userObj = userResponse(user);
        userObj.token = token;
        userObj.admin = user.admin;

        req.user = userObj;
        return next();
      })
        .catch((error) => { return res.status(400).send(error); });
    });
  }

  return next();
};
