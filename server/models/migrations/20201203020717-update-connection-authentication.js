const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Connection", "authentication", {
      type: Sequelize.TEXT,
      set(val) {
        try {
          return this.setDataValue("authentication", sc.encrypt(JSON.stringify(val)));
        } catch (e) {
          return this.setDataValue("authentication", val);
        }
      },
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("authentication")));
        } catch (e) {
          return this.getDataValue("authentication");
        }
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Connection", "authentication");
  }
};
