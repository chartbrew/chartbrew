const {
  getEncryptedJson,
  setEncryptedJson,
} = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const OrchestratorActionAudit = sequelize.define("OrchestratorActionAudit", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    action_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    project_id: DataTypes.INTEGER,
    actor_user_id: DataTypes.INTEGER,
    action_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    authority_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resource_id: DataTypes.STRING,
    changed_fields: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const value = this.getDataValue("changed_fields");
        try {
          return JSON.parse(value);
        } catch (error) {
          return [];
        }
      },
      set(value) {
        this.setDataValue("changed_fields", JSON.stringify(value || []));
      },
    },
    before_values: {
      type: DataTypes.TEXT("long"),
      get() {
        return getEncryptedJson(this, "before_values");
      },
      set(value) {
        setEncryptedJson(this, "before_values", value);
      },
    },
    after_values: {
      type: DataTypes.TEXT("long"),
      get() {
        return getEncryptedJson(this, "after_values");
      },
      set(value) {
        setEncryptedJson(this, "after_values", value);
      },
    },
    proposal_hash: DataTypes.STRING,
    session_binding_hash: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    failure_code: DataTypes.STRING,
    completed_at: DataTypes.DATE,
  }, {
    freezeTableName: true,
    indexes: [{
      fields: ["action_id"],
      unique: true,
    }, {
      fields: ["team_id", "createdAt"],
    }, {
      fields: ["project_id", "createdAt"],
    }, {
      fields: ["actor_user_id", "createdAt"],
    }],
  });

  OrchestratorActionAudit.associate = (models) => {
    models.OrchestratorActionAudit.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.OrchestratorActionAudit.belongsTo(models.Project, {
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
    models.OrchestratorActionAudit.belongsTo(models.User, {
      as: "actor",
      foreignKey: "actor_user_id",
      onDelete: "SET NULL",
    });
  };

  return OrchestratorActionAudit;
};
