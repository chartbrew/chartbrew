const simplecrypt = require("simplecrypt");

const { encrypt, decrypt } = require("../../modules/cbCrypto");

const settings = require("../../settings");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

function setEncryptedJson(field, value) {
  if (value === undefined) return;
  if (value === null) {
    this.setDataValue(field, null);
    return;
  }
  this.setDataValue(field, encrypt(JSON.stringify(value)));
}

function getEncryptedJson(field) {
  const value = this.getDataValue(field);
  if (!value) return value;

  try {
    return JSON.parse(decrypt(value));
  } catch (error) {
    try {
      return JSON.parse(sc.decrypt(value));
    } catch (legacyError) {
      try {
        return JSON.parse(value);
      } catch (parseError) {
        return value;
      }
    }
  }
}

module.exports = (sequelize, DataTypes) => {
  const DatasetIntelligence = sequelize.define("DatasetIntelligence", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    dataset_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "Dataset",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Team",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    fingerprint: {
      type: DataTypes.STRING,
    },
    profile: {
      type: DataTypes.TEXT("long"),
      set(value) {
        setEncryptedJson.call(this, "profile", value);
      },
      get() {
        return getEncryptedJson.call(this, "profile");
      },
    },
    overrides: {
      type: DataTypes.TEXT("long"),
      set(value) {
        setEncryptedJson.call(this, "overrides", value);
      },
      get() {
        return getEncryptedJson.call(this, "overrides");
      },
    },
    generated_at: {
      type: DataTypes.DATE,
    },
    expires_at: {
      type: DataTypes.DATE,
    },
    last_error: {
      type: DataTypes.TEXT,
    },
  }, {
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["dataset_id"] },
      { fields: ["team_id", "status"] },
      { fields: ["expires_at"] },
    ],
  });

  DatasetIntelligence.associate = (models) => {
    models.DatasetIntelligence.belongsTo(models.Dataset, {
      foreignKey: "dataset_id",
      onDelete: "CASCADE",
    });
    models.DatasetIntelligence.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
  };

  return DatasetIntelligence;
};
