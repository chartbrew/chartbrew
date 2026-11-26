const encodeDatabaseUrlPassword = require("./encodeDatabaseUrlPassword");
const { decrypt } = require("./cbCrypto");

module.exports = (data) => {
  const connection = data;

  if (connection.connectionString) {
    return encodeDatabaseUrlPassword(connection.connectionString);
  }

  try {
    connection.dbName = decrypt(connection.dbName);
    connection.host = decrypt(connection.host);
    connection.port = decrypt(connection.port);
    connection.username = decrypt(connection.username);
    connection.password = decrypt(connection.password);
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
