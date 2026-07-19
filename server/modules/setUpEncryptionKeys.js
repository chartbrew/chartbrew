const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const envPath = path.join(__dirname, "..", "..", ".env");

// Generates a 32-byte random key for AES-256 and returns its hexadecimal representation
function generateAESKey() {
  return crypto.randomBytes(32).toString("hex");
}

function generatePassword() {
  return crypto.randomBytes(24).toString("base64url");
}

function setEnvDefault(data, envVar, value) {
  const keyRegex = new RegExp(`^${envVar}=(.*)$`, "m");
  const match = data.match(keyRegex);

  if (match?.[1]) {
    return { data, value: match[1], updated: false };
  }

  if (match) {
    return {
      data: data.replace(keyRegex, `${envVar}=${value}`),
      value,
      updated: true,
    };
  }

  return {
    data: `${data.trim()}\n${envVar}=${value}\n`,
    value,
    updated: true,
  };
}

// Populate generated secrets before dotenv loads so they are available on the first startup.
function setUpEncryptionKeys(targetEnvPath = envPath) {
  try {
    let data = fs.readFileSync(targetEnvPath, "utf8");
    const defaults = [
      ["CB_ENCRYPTION_KEY_DEV", generateAESKey],
      ["CB_ENCRYPTION_KEY", generateAESKey],
      ["CB_BULLMQ_USERNAME", () => "chartbrew"],
      ["CB_BULLMQ_PASSWORD", generatePassword],
    ];

    defaults.forEach(([envVar, generateValue]) => {
      const result = setEnvDefault(data, envVar, generateValue());
      data = result.data;

      if (result.updated) {
        console.log(`Set up ${envVar}`); // eslint-disable-line
      }
    });

    fs.writeFileSync(targetEnvPath, data, "utf8");
  } catch (e) {
    console.error("Application secrets could not be set up. Please configure the encryption keys and BullMQ dashboard credentials in your environment."); // eslint-disable-line
  }
}

module.exports = setUpEncryptionKeys;
module.exports.generatePassword = generatePassword;
module.exports.setEnvDefault = setEnvDefault;
