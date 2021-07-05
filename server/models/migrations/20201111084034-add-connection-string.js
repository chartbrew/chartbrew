const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Connection", "connectionString", {
      type: Sequelize.TEXT,
      set(val) {
        return this.setDataValue("connectionString", sc.encrypt(val));
      },
      get() {
        try {
          return sc.decrypt(this.getDataValue("connectionString"));
        } catch (e) {
          return this.getDataValue("connectionString");
        }
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Connection", "connectionString");
  }
};
