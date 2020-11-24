const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (data) => {
  const connection = data;

  if (connection.connectionString) {
    const cs = connection.connectionString;
    let newConnectionString = "";

    const protocol = cs.substring(0, cs.indexOf("//") + 2);
    newConnectionString = cs.replace(protocol, "");

    const username = newConnectionString.substring(0, newConnectionString.indexOf(":"));
    newConnectionString = cs.replace(protocol + username, "");

    const password = encodeURIComponent(newConnectionString.substring(1, newConnectionString.lastIndexOf("@")));

    const hostAndOpt = cs.substring(cs.lastIndexOf("@"));

    newConnectionString = `${protocol}${username}:${password}${hostAndOpt}`;

    return newConnectionString;
  }

  try {
    connection.dbName = sc.decrypt(connection.dbName);
    connection.host = sc.decrypt(connection.host);
    connection.port = sc.decrypt(connection.port);
    connection.username = sc.decrypt(connection.username);
    connection.password = sc.decrypt(connection.password);
  } catch (e) {
    // info is not encrypted, must be a test
  }

  let url = "mongodb://";
  if (connection.srv) {
    url = "mongodb+srv://";
  }

  // add the username and password
  if (connection.username && connection.password) {
    url += `${encodeURIComponent(connection.username)}:${encodeURIComponent(connection.password)}@`;
  }

  // add the host
  url += `${connection.host}`;

  // add the port
  if (connection.port) {
    url += `:${connection.port}`;
  }

  // add the database name
  url += `/${connection.dbName}`;

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
