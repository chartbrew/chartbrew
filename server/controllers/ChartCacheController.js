const fs = require("fs");
const path = require("path");

const db = require("../models/models");

class ChartCacheController {
  create(userId, chartId, data) {
    return this.findLast(userId, chartId)
      .then((cache) => {
        const filePath = path.normalize(`${__dirname}/../.cache/chart-${chartId}.txt`);
        try {
          fs.writeFile(filePath, JSON.stringify(data), () => { });
        } catch (e) { /**/ }

        if (!cache) {
          return db.ChartCache.create({
            user_id: userId,
            chart_id: chartId,
            filePath,
          });
        }

        return this.update(data, userId, chartId);
      })
      .then((cache) => {
        return new Promise((resolve) => resolve(cache));
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }

  findLast(userId, chartId, includeData = true) {
    return db.ChartCache.findOne({
      where: { user_id: userId, chart_id: chartId },
      order: [["createdAt", "DESC"]],
    })
      .then(async (cache) => {
        if (!cache || !cache.filePath) {
          return new Promise((resolve) => resolve(false));
        }

        try {
          if (includeData) {
            if (fs.existsSync(cache.filePath)) {
              const rawData = await fs.promises.readFile(cache.filePath);
              const parsedData = JSON.parse(rawData);
              // console.log("parsedData", parsedData.chart.chartData.test.data);
              return new Promise((resolve) => resolve({ ...cache, data: parsedData }));
            }
          }
          return cache;
        } catch (e) {
          return new Promise((resolve) => resolve(false));
        }
      })
      .catch(() => {
        // this operation shouldn't stop what else is running
        return new Promise((resolve) => resolve(false));
      });
  }

  update(data, userId, chartId) {
    return db.ChartCache.update(data, { where: { user_id: userId, chart_id: chartId } })
      .then(() => {
        return this.findLast(userId, chartId);
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }

  remove(userId, chartId) {
    return this.findLast(userId, chartId)
      .then((cache) => {
        if (cache.filePath) {
          fs.unlink(cache.filePath, () => {});
        }

        return db.ChartCache.destroy({ where: { user_id: userId, chart_id: chartId } });
      })
      .catch((e) => {
        return new Promise((resolve, reject) => reject(e));
      });
  }
}

module.exports = ChartCacheController;
