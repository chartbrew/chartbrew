const mongoose = require("mongoose");
const ConnectionController = require("../controllers/ConnectionController");

module.exports = ({ connection_id, query }) => {
  const connectionController = new ConnectionController();

  return connectionController.getConnectionUrl(connection_id)
    .then((url) => {
      const options = {
        keepAlive: 1,
        connectTimeoutMS: 30000,
      };
      return mongoose.connect(url, options);
    })
    .then(() => {
      return Function(`'use strict';return (mongoose) => mongoose.${query}.toArray()`)()(mongoose); // eslint-disable-line
    })
    .catch(() => {
      return Function(`'use strict';return (mongoose) => mongoose.${query}`)()(mongoose); // eslint-disable-line
    })
    .then((data) => {
      return new Promise((resolve) => resolve(data));
    })
    .catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
};
