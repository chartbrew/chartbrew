const fs = require("fs");
const path = require("path");

const db = require("../models/models");

const findLast = (drId, includeData = true) => {
  return db.DataRequestCache.findOne({
    where: { dr_id: drId },
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
            return new Promise((resolve) => resolve({ ...cache, ...parsedData }));
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
};

const update = (data, drId) => {
  return db.DataRequestCache.update(data, { where: { dr_id: drId } })
    .then(() => {
      return findLast(drId);
    })
    .catch((e) => {
      return new Promise((resolve, reject) => reject(e));
    });
};

const create = (drId, data) => {
  return findLast(drId)
    .then((cache) => {
      const filePath = path.normalize(`${__dirname}/../.cache/dr-${drId}.txt`);
      try {
        fs.writeFile(filePath, JSON.stringify(data), () => { });
      } catch (e) { /**/ }

      if (!cache) {
        return db.DataRequestCache.create({
          dr_id: drId,
          filePath,
        });
      }

      return update(data, drId);
    })
    .then((cache) => {
      return new Promise((resolve) => resolve(cache));
    })
    .catch((e) => {
      return new Promise((resolve, reject) => reject(e));
    });
};

const remove = (drId) => {
  return findLast(drId)
    .then((cache) => {
      if (cache.filePath) {
        fs.unlink(cache.filePath, () => {});
      }

      return db.DataRequestCache.destroy({ where: { dr_id: drId } });
    })
    .catch((e) => {
      return new Promise((resolve, reject) => reject(e));
    });
};

module.exports = {
  create,
  findLast,
  update,
  remove,
};
