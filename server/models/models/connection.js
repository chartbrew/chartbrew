const simplecrypt = require("simplecrypt");
const assembleMongoUrl = require("../../modules/assembleMongoUrl");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const Connection = sequelize.define("Connection", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Project",
        key: "id",
        onDelete: "cascade",
      },
    },
    name: {
      type: DataTypes.STRING,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    host: {
      type: DataTypes.STRING,
      set(val) {
        if (!val) return val;
        return this.setDataValue("host", sc.encrypt(val));
      },
      get() {
        try {
          return sc.decrypt(this.getDataValue("host"));
        } catch (e) {
          return this.getDataValue("host");
        }
      },
    },
    dbName: {
      type: DataTypes.STRING,
      set(val) {
        if (!val) return val;
        return this.setDataValue("dbName", sc.encrypt(val));
      },
      get() {
        try {
          return sc.decrypt(this.getDataValue("dbName"));
        } catch (e) {
          return this.getDataValue("dbName");
        }
      },
    },
    port: {
      type: DataTypes.STRING,
      set(val) {
        if (!val) return val;
        return this.setDataValue("port", sc.encrypt(val));
      },
      get() {
        try {
          return sc.decrypt(this.getDataValue("port"));
        } catch (e) {
          return this.getDataValue("port");
        }
      },
    },
    username: {
      type: DataTypes.STRING,
      set(val) {
        if (!val) return val;
        return this.setDataValue("username", sc.encrypt(val));
      },
      get() {
        try {
          return sc.decrypt(this.getDataValue("username"));
        } catch (e) {
          return this.getDataValue("username");
        }
      },
    },
    password: {
      type: DataTypes.STRING,
      set(val) {
        if (!val) return val;
        return this.setDataValue("password", sc.encrypt(val));
      },
      get() {
        try {
          return sc.decrypt(this.getDataValue("password"));
        } catch (e) {
          return this.getDataValue("password");
        }
      },
    },
    srv: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    options: {
      type: DataTypes.TEXT,
      set(val) {
        try {
          return this.setDataValue("options", sc.encrypt(JSON.stringify(val)));
        } catch (e) {
          return this.setDataValue("options", sc.encrypt(val));
        }
      },
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("options")));
        } catch (e) {
          return this.getDataValue("options");
        }
      },
    },
  }, {
    freezeTableName: true,
  });

  Connection.associate = (models) => {
    models.Connection.hasMany(models.Dataset, { foreignKey: "connection_id" });
  };

  Connection.prototype.decryptField = (val) => {
    return sc.decrypt(val);
  };

  Connection.prototype.getMongoConnectionUrl = (connection) => {
    return assembleMongoUrl(connection);
  };

  Connection.prototype.getApiUrl = (connection) => {
    let url = connection.decryptField(connection.getDataValue("host"));
    // remove the last "/" if present
    if (url[url.length - 1] === "/") url = url.slice(0, -1);

    // add the port if present
    if (connection.getDataValue("port")) {
      url += connection.decryptField(connection.getDataValue("port"));
    }

    return url;
  };

  Connection.prototype.getHeaders = (connection) => {
    let headers = [];

    if (connection.getDataValue("options")) {
      headers = connection.decryptField(connection.getDataValue("options"));
    }

    if (headers === "null") return [];

    try {
      return JSON.parse(headers);
    } catch (e) {
      return [];
    }
  };

  return Connection;
};
