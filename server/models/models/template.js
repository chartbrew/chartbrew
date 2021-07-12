const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define("Template", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    name: {
      type: DataTypes.STRING,
      required: true,
    },
    model: {
      type: DataTypes.TEXT("long"),
      set(val) {
        try {
          return this.setDataValue("model", sc.encrypt(JSON.stringify(val)));
        } catch (e) {
          return this.setDataValue("model", val);
        }
      },
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("model")));
        } catch (e) {
          return this.getDataValue("model");
        }
      }
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
  }, {
    freezeTableName: true,
  });

  Template.associate = (models) => {
    models.Template.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return Template;
};
