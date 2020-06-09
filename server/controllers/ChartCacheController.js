const db = require("../models/models");

class ChartCacheController {
  create(userId, chartId, data, type = "CHART_CACHE") {
    return db.ChartCache.create({
      user_id: userId,
      chart_id: chartId,
      data,
      type,
    })
      .then((cache) => {
        return new Promise((resolve) => resolve(cache));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }

  findLast(userId, chartId) {
    return db.ChartCache.findAll({
      where: { user_id: userId, chart_id: chartId },
      order: [["createdAt", "DESC"]],
    })
      .then((cache) => {
        if (!cache || cache.length < 1) {
          return new Promise((resolve) => resolve(false));
        }

        // return only the last one
        return new Promise((resolve) => resolve(cache[0]));
      })
      .catch(() => {
        // this operation shouldn't stop what else is running
        return new Promise((resolve) => resolve(false));
      });
  }

  deleteAll(userId) {
    return db.ChartCache.destroy({ where: { user_id: userId } })
      .then((result) => {
        return new Promise((resolve) => resolve(result));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }
}

module.exports = ChartCacheController;
