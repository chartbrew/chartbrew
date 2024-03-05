const CryptoJS = require("crypto-js");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

function encrypt(text, secretKey) {
  return CryptoJS.AES.encrypt(text, secretKey).toString();
}

function decrypt(ciphertext, secretKey) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = (sequelize, DataTypes) => {
  const User2fa = sequelize.define("User2fa", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "User",
        key: "id",
        onDelete: "cascade",
      },
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: false,
      set(val) {
        return this.setDataValue("secret", encrypt(val, settings.secret));
      },
      get() {
        return decrypt(this.getDataValue("secret"), settings.secret);
      },
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    backup: {
      type: DataTypes.TEXT,
      allowNull: true,
      set(val) {
        return this.setDataValue("backup", encrypt(val, settings.secret));
      },
      get() {
        return decrypt(this.getDataValue("backup"), settings.secret);
      },
    },
  }, {
    freezeTableName: true,
  });

  User2fa.associate = (models) => {
    User2fa.belongsTo(models.User, {
      foreignKey: "user_id",
    });
  };

  return User2fa;
};
