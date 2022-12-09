const Sequelize = require("sequelize");
const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("Alert", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      dataset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Dataset",
          key: "id",
          onDelete: "cascade",
        },
      },
      rules: {
        type: Sequelize.TEXT("long"),
        set(val) {
          return this.setDataValue("rules", sc.encrypt(JSON.stringify(val)));
        },
        get() {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("rules")));
          } catch (e) {
            return this.getDataValue("rules");
          }
        }
      },
      recipients: {
        type: Sequelize.TEXT,
        set(val) {
          return this.setDataValue("recipients", sc.encrypt(JSON.stringify(val)));
        },
        get() {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("recipients")));
          } catch (e) {
            return this.getDataValue("recipients");
          }
        },
      },
      active: {
        type: Sequelize.BOOLEAN,
        required: true,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Alert");
  }
};
