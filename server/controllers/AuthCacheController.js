const moment = require("moment");
const db = require("../models/models");

class AuthCacheController {
  set(key, user, type = "AUTH_CACHE") {
    return db.AuthCache.upsert({
      key,
      user,
      type,
    }, { returning: ["*"] })
      .then((created) => {
        return new Promise((resolve) => resolve(created));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }

  get(key) {
    return db.AuthCache.findOne({
      where: { key },
    })
      .then((cache) => {
        if (!cache || !cache.createdAt) {
          return new Promise((resolve) => resolve({}));
        }
        this.delete(key);
        const timeDiff = moment().diff(cache.createdAt, "minutes");
        // update this to match updateInterval from oneaccount library
        // if it is changed (default value is 1 minute)
        if (timeDiff > 1) {
          return new Promise((resolve) => resolve({}));
        }
        return new Promise((resolve) => resolve(cache.toJSON().user));
      })
      .catch(() => {
        // this operation shouldn't stop what else is running
        return new Promise((resolve) => resolve({}));
      });
  }

  delete(key) {
    return db.AuthCache.destroy({ where: { key } })
      .then((result) => {
        return new Promise((resolve) => resolve(result));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }
}

module.exports = AuthCacheController;
