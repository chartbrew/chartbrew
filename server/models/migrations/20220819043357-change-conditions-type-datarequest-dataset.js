const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn("Dataset", "conditions", {
      type: Sequelize.TEXT("long"),
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      }
    });

    await queryInterface.changeColumn("DataRequest", "conditions", {
      type: Sequelize.TEXT("long"),
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn("Dataset", "conditions", {
      type: Sequelize.TEXT,
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      }
    });

    await queryInterface.changeColumn("DataRequest", "configuration", {
      type: Sequelize.TEXT,
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      }
    });
  }
};
