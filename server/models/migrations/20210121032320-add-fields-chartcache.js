const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ChartCache", "fields", {
      type: Sequelize.TEXT("long"),
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("fields")));
        } catch (e) {
          return this.getDataValue("fields");
        }
      },
      set(val) {
        return this.setDataValue("fields", sc.encrypt(JSON.stringify(val)));
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ChartCache", "fields");
  }
};
