const simplecrypt = require("simplecrypt");

const { encrypt, decrypt } = require("./cbCrypto");

const settings = process.env.NODE_ENV === "production"
  ? require("../settings")
  : require("../settings-dev");

const legacyCrypto = simplecrypt({
  password: settings.secret,
  salt: "10",
});

function setEncryptedJson(instance, field, value) {
  if (value === undefined) return;
  if (value === null) {
    instance.setDataValue(field, null);
    return;
  }
  instance.setDataValue(field, encrypt(JSON.stringify(value)));
}

function getEncryptedJson(instance, field) {
  const value = instance.getDataValue(field);
  if (!value) return value;

  const candidates = [
    () => decrypt(value),
    () => legacyCrypto.decrypt(value),
    () => value,
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate());
    } catch (error) {
      // Try the next supported storage format.
    }
  }

  return value;
}

module.exports = {
  getEncryptedJson,
  setEncryptedJson,
};
