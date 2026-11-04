const CryptoJS = require("crypto-js");
const { encrypt, decrypt: decryptCurrent } = require("../../modules/cbCrypto");

const settings = require("../../settings");

function decrypt(ciphertext, secretKey) {
  if (!ciphertext) return ciphertext;
  if (ciphertext.includes(":")) return decryptCurrent(ciphertext);
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
        return this.setDataValue("secret", encrypt(val));
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
        return this.setDataValue("backup", encrypt(val));
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
