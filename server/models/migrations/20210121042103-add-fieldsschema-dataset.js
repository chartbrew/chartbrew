const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Dataset", "fieldsSchema", {
      type: Sequelize.TEXT("long"),
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("fieldsSchema")));
        } catch (e) {
          return this.getDataValue("fieldsSchema");
        }
      },
      set(val) {
        return this.setDataValue("fieldsSchema", sc.encrypt(JSON.stringify(val)));
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Dataset", "fieldsSchema");
  }
};
