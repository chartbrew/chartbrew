const ChartCache = require("../models/ChartCache");

class ChartCacheController {
  constructor() {
    this.chartCache = ChartCache;
  }

  create(userId, data, type = "CHART_CACHE") {
    return this.chartCache.create({
      user_id: userId,
      data,
      type,
    })
      .then((cache) => {
        return new Promise(resolve => resolve(cache));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }

  findLast(userId) {
    return this.chartCache.findAll({
      where: { user_id: userId },
      order: [["createdAt", "DESC"]],
    })
      .then((cache) => {
        if (!cache || cache.length < 1) {
          return new Promise(resolve => resolve([]));
        }

        // return only the last one
        return new Promise(resolve => resolve(cache[0]));
      })
      .catch(() => {
        // this operation shouldn't stop what else is running
        return new Promise(resolve => resolve([]));
      });
  }

  deleteAll(userId) {
    return this.chartCache.destroy({ where: { user_id: userId } })
      .then((result) => {
        return new Promise(resolve => resolve(result));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }
}

module.exports = ChartCacheController;
