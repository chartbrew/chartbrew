module.exports = (sequelize, DataTypes) => {
  const TeamBusinessProfile = sequelize.define("TeamBusinessProfile", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    websiteUrl: DataTypes.TEXT,
    domain: DataTypes.STRING(253),
    businessName: DataTypes.STRING,
    description: DataTypes.TEXT,
    logoMimeType: DataTypes.STRING(100),
    logoData: DataTypes.BLOB("medium"),
    metadata: {
      type: DataTypes.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("metadata")) || {};
        } catch (error) {
          return {};
        }
      },
      set(value) {
        this.setDataValue("metadata", JSON.stringify(value || {}));
      },
    },
    aiContextAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    freezeTableName: true,
  });

  TeamBusinessProfile.associate = (models) => {
    models.TeamBusinessProfile.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
  };

  return TeamBusinessProfile;
};
