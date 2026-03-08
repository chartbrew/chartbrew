module.exports = (sequelize, DataTypes) => {
  const UpdateRun = sequelize.define("UpdateRun", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    traceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rootTraceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parentRunId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    triggerType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    chartId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    datasetId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    dataRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    connectionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    queueName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    jobId: {
      type: DataTypes.STRING,
      allowNull: true,
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
    errorStage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    errorClass: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    errorCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      set(value) {
        if (value === undefined) {
          return;
        }

        if (value === null) {
          this.setDataValue("summary", null);
          return;
        }

        this.setDataValue("summary", JSON.stringify(value));
      },
      get() {
        const value = this.getDataValue("summary");
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

  UpdateRun.associate = (models) => {
    models.UpdateRun.belongsTo(models.UpdateRun, {
      as: "parentRun",
      foreignKey: "parentRunId",
      constraints: false,
    });
    models.UpdateRun.hasMany(models.UpdateRun, {
      as: "childRuns",
      foreignKey: "parentRunId",
      constraints: false,
    });
    models.UpdateRun.hasMany(models.UpdateRunEvent, {
      as: "events",
      foreignKey: "runId",
      constraints: false,
    });
    models.UpdateRun.belongsTo(models.Team, {
      foreignKey: "teamId",
      constraints: false,
    });
    models.UpdateRun.belongsTo(models.Project, {
      foreignKey: "projectId",
      constraints: false,
    });
    models.UpdateRun.belongsTo(models.Chart, {
      foreignKey: "chartId",
      constraints: false,
    });
    models.UpdateRun.belongsTo(models.Dataset, {
      foreignKey: "datasetId",
      constraints: false,
    });
    models.UpdateRun.belongsTo(models.DataRequest, {
      foreignKey: "dataRequestId",
      constraints: false,
    });
    models.UpdateRun.belongsTo(models.Connection, {
      foreignKey: "connectionId",
      constraints: false,
    });
  };

  return UpdateRun;
};
