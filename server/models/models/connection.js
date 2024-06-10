const simplecrypt = require("simplecrypt");

const assembleMongoUrl = require("../../modules/assembleMongoUrl");
const { encrypt, decrypt } = require("../../modules/cbCrypto");

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
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    project_ids: {
      type: DataTypes.TEXT,
      set(val) {
        try {
          return this.setDataValue("project_ids", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("project_ids", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("project_ids"));
        } catch (e) {
          return this.getDataValue("project_ids");
        }
      },
    },
    oauth_id: {
      type: DataTypes.UUID,
      allowNull: true,
      reference: {
        model: "OAuth",
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
    subType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    host: {
      type: DataTypes.TEXT("long"),
      set(val) {
        if (!val) return val;
        return this.setDataValue("host", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("host"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("host"));
          } catch (e) {
            return this.getDataValue("host");
          }
        }
      },
    },
    dbName: {
      type: DataTypes.TEXT,
      set(val) {
        if (!val) return val;
        return this.setDataValue("dbName", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("dbName"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("dbName"));
          } catch (e) {
            return this.getDataValue("dbName");
          }
        }
      },
    },
    port: {
      type: DataTypes.TEXT,
      set(val) {
        if (!val) return val;
        return this.setDataValue("port", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("port"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("port"));
          } catch (e) {
            return this.getDataValue("port");
          }
        }
      },
    },
    username: {
      type: DataTypes.TEXT,
      set(val) {
        if (!val) return val;
        return this.setDataValue("username", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("username"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("username"));
          } catch (e) {
            return this.getDataValue("username");
          }
        }
      },
    },
    password: {
      type: DataTypes.TEXT,
      set(val) {
        if (!val) return val;
        return this.setDataValue("password", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("password"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("password"));
          } catch (e) {
            return this.getDataValue("password");
          }
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
          return this.setDataValue("options", encrypt(JSON.stringify(val)));
        } catch (e) {
          return this.setDataValue("options", encrypt(val));
        }
      },
      get() {
        try {
          return JSON.parse(decrypt(this.getDataValue("options")));
        } catch (e) {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("options")));
          } catch (e) {
            return this.getDataValue("options");
          }
        }
      },
    },
    connectionString: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("connectionString", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("connectionString"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("connectionString"));
          } catch (e) {
            return this.getDataValue("connectionString");
          }
        }
      },
    },
    authentication: {
      type: DataTypes.TEXT,
      set(val) {
        try {
          return this.setDataValue("authentication", encrypt(JSON.stringify(val)));
        } catch (e) {
          return this.setDataValue("authentication", val);
        }
      },
      get() {
        try {
          return JSON.parse(decrypt(this.getDataValue("authentication")));
        } catch (e) {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("authentication")));
          } catch (e) {
            return this.getDataValue("authentication");
          }
        }
      },
    },
    firebaseServiceAccount: {
      type: DataTypes.TEXT("long"),
      set(val) {
        let newVal = val;
        try {
          newVal = JSON.stringify(val);
        } catch (e) {
          //
        }

        try {
          const parsedString = newVal.replace(/\r?\n|\r/, "");
          return this.setDataValue("firebaseServiceAccount", encrypt(parsedString));
        } catch (e) {
          return this.setDataValue("firebaseServiceAccount", newVal);
        }
      },
      get() {
        try {
          return JSON.parse(decrypt(this.getDataValue("firebaseServiceAccount")));
        } catch (e) {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("firebaseServiceAccount")));
          } catch (e) {
            return this.getDataValue("firebaseServiceAccount");
          }
        }
      },
    },
    ssl: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sslMode: {
      type: DataTypes.STRING,
      defaultValue: "require",
    },
    sslCa: {
      type: DataTypes.STRING,
    },
    sslCert: {
      type: DataTypes.STRING,
    },
    sslKey: {
      type: DataTypes.STRING,
    },
    schema: {
      type: DataTypes.TEXT("long"),
      set(val) {
        try {
          return this.setDataValue("schema", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("schema", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("schema"));
        } catch (e) {
          return this.getDataValue("schema");
        }
      },
    },
  }, {
    freezeTableName: true,
  });

  Connection.associate = (models) => {
    models.Connection.hasMany(models.Dataset, { foreignKey: "connection_id" });
    models.Connection.belongsTo(models.OAuth, { foreignKey: "oauth_id" });
  };

  Connection.prototype.decryptField = (val) => {
    try {
      return decrypt(val);
    } catch (e) {
      try {
        return sc.decrypt(val);
      } catch (e) {
        return val;
      }
    }
  };

  Connection.prototype.getMongoConnectionUrl = (connection) => {
    if (connection.connectionString) return connection.connectionString;
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

    if (connection.authentication && connection.authentication.type === "bearer_token") {
      const auth = {
        "Authorization": `Bearer ${connection.authentication.token}`,
      };

      try {
        headers = JSON.parse(headers);
        headers.push(auth);
      } catch (error) {
        if (headers === "null" || headers === "[]") {
          headers = [auth];
        }
      }
    }

    if (headers === "null") return [];
    if (typeof headers === "object") return headers;

    try {
      return JSON.parse(headers);
    } catch (e) {
      return [];
    }
  };

  return Connection;
};
