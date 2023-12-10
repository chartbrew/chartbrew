const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "layout", {
      type: Sequelize.TEXT,
      defaultValue: JSON.stringify({
        "lg": [0, 0, 12, 2],
        "md": [0, 0, 10, 2],
        "sm": [0, 0, 8, 2],
        "xs": [0, 0, 6, 2],
        "xxs": [0, 0, 4, 2]
      }),
      set(val) {
        return this.setDataValue("layout", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("layout"));
        } catch (e) {
          return this.getDataValue("layout");
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "layout");
  }
};
