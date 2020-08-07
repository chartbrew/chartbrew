const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (connection) => {
  // TODO: get the connection URL depending on the connection type - at a later stage
  let url = "mongodb://";
  if (connection.srv) {
    url = "mongodb+srv://";
  }

  // add the username and password
  if (connection.username && connection.password) {
    url += `${encodeURIComponent(sc.decrypt(connection.username))}:${encodeURIComponent(sc.decrypt(connection.password))}@`;
  }

  // add the host
  url += `${sc.decrypt(connection.host)}`;

  // add the port
  if (connection.port) {
    url += `:${sc.decrypt(connection.port)}`;
  }

  // add the database name
  url += `/${sc.decrypt(connection.dbName)}`;

  // lastly, add the options
  if (connection.options) {
    const { options } = connection;
    if (options.length > 0) {
      url += "?";
      for (const option of options) {
        url += `${Object.keys(option)[0]}=${option[Object.keys(option)[0]]}&`;
      }
      // remove the last &
      url = url.slice(0, -1);
    }
  }

  return url;
};
