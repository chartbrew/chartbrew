const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("Connection", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Project",
          key: "id",
          onDelete: "cascade",
        },
      },
      name: {
        type: Sequelize.STRING,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      host: {
        type: Sequelize.STRING,
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
        type: Sequelize.STRING,
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
        type: Sequelize.STRING,
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
        type: Sequelize.STRING,
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
        type: Sequelize.STRING,
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
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      options: {
        type: Sequelize.TEXT,
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
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("Connection");
  }
};
