/* This module gets the user information from the token, but doesn't fail in any way */
const db = require("../models/models");
const userResponse = require("./userResponse");
const verifySessionToken = require("./verifySessionToken");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";
  if (!token) return next();

  let decoded;
  try {
    decoded = verifySessionToken(token);
  } catch (err) {
    //
  }

  if (!decoded?.id) return next();

  return db.User.findByPk(decoded.id)
    .then((user) => {
      if (!user) return next();

      const userObj = userResponse(user);
      userObj.token = token;
      userObj.admin = user.admin;

      req.user = userObj;
      return next();
    })
    .catch((error) => { return res.status(400).send(error); });
};
