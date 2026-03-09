const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("UpdateRun", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      traceId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      rootTraceId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      parentRunId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      triggerType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      entityType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      teamId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      projectId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      chartId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      datasetId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      dataRequestId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      connectionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      queueName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      jobId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      finishedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      durationMs: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      errorStage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      errorClass: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      errorCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      summary: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("UpdateRun", ["traceId"], {
      unique: true,
      name: "update_run_trace_id_unique",
    });
    await queryInterface.addIndex("UpdateRun", ["rootTraceId"], {
      name: "update_run_root_trace_id_idx",
    });
    await queryInterface.addIndex("UpdateRun", ["chartId", "startedAt"], {
      name: "update_run_chart_started_at_idx",
    });
    await queryInterface.addIndex("UpdateRun", ["projectId", "startedAt"], {
      name: "update_run_project_started_at_idx",
    });
    await queryInterface.addIndex("UpdateRun", ["status", "startedAt"], {
      name: "update_run_status_started_at_idx",
    });
    await queryInterface.addIndex("UpdateRun", ["teamId", "startedAt"], {
      name: "update_run_team_started_at_idx",
    });
    await queryInterface.addIndex("UpdateRun", ["datasetId", "startedAt"], {
      name: "update_run_dataset_started_at_idx",
    });

    await queryInterface.createTable("UpdateRunEvent", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      runId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      sequence: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      stage: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      finishedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      durationMs: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      payload: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("UpdateRunEvent", ["runId", "sequence"], {
      unique: true,
      name: "update_run_event_run_sequence_unique",
    });
    await queryInterface.addIndex("UpdateRunEvent", ["stage", "startedAt"], {
      name: "update_run_event_stage_started_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("UpdateRunEvent");
    await queryInterface.dropTable("UpdateRun");
  },
};
