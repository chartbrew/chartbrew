const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("ChartCache", "filePath", {
      type: Sequelize.STRING,
    });
    await queryInterface.removeColumn("ChartCache", "data");
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ChartChache", "filePath");
    await queryInterface.addColumn("ChartCache", "data", {
      type: Sequelize.TEXT("long"),
      allowNull: false,
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("data")));
        } catch (e) {
          return this.getDataValue("data");
        }
      },
      set(val) {
        return this.setDataValue("data", sc.encrypt(JSON.stringify(val)));
      },
    });
  }
};
