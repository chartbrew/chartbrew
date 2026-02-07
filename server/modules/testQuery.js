const mongoose = require("mongoose");
const ConnectionController = require("../controllers/ConnectionController");
const validateMongoQuery = require("./validateMongoQuery");

module.exports = ({ connection_id, query }) => {
  const connectionController = new ConnectionController();
  let formattedQuery = query;
  if (formattedQuery.indexOf("connection.") === 0) {
    formattedQuery = formattedQuery.replace("connection.", "");
  }
  const validation = validateMongoQuery(formattedQuery);
  if (!validation.valid) {
    return Promise.reject(new Error(`Invalid MongoDB query: ${validation.message}`));
  }

  return connectionController.getConnectionUrl(connection_id)
    .then((url) => {
      const options = {
        connectTimeoutMS: 30000,
      };
      return mongoose.connect(url, options);
    })
    .then(() => {
      return Function(`'use strict';return (mongoose) => mongoose.${formattedQuery}.toArray()`)()(mongoose); // eslint-disable-line
    })
    .catch(() => {
      return Function(`'use strict';return (mongoose) => mongoose.${formattedQuery}`)()(mongoose); // eslint-disable-line
    })
    .then((data) => {
      return new Promise((resolve) => resolve(data));
    })
    .catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
};
