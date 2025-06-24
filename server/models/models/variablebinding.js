module.exports = (sequelize, DataTypes) => {
  const VariableBinding = sequelize.define("VariableBinding", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entity_type: {
      type: DataTypes.ENUM("Project", "Connection", "Dataset", "DataRequest", "Template"),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      required: true,
    },
    type: {
      type: DataTypes.ENUM("string", "number", "boolean", "date"),
      allowNull: false,
    },
    default_value: {
      type: DataTypes.TEXT,
    },
    required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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

  return VariableBinding;
};
