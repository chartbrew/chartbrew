module.exports = (sequelize, DataTypes) => {
  const UpdateRunEvent = sequelize.define("UpdateRunEvent", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    runId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stage: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    durationMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payload: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      set(value) {
        if (value === undefined) {
          return;
        }

        if (value === null) {
          this.setDataValue("payload", null);
          return;
        }

        this.setDataValue("payload", JSON.stringify(value));
      },
      get() {
        const value = this.getDataValue("payload");
        if (!value) {
          return null;
        }

        try {
          return JSON.parse(value);
        } catch (error) {
          return value;
        }
      },
    },
  }, {
    freezeTableName: true,
  });

  UpdateRunEvent.associate = (models) => {
    models.UpdateRunEvent.belongsTo(models.UpdateRun, {
      foreignKey: "runId",
      constraints: false,
    });
  };

  return UpdateRunEvent;
};
