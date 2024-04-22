const crypto = require("crypto");

// Assuming your secret key is stored in an environment variable for security reasons.
const SECRET_KEY = process.env.NODE_ENV === "production" ? process.env.CB_ENCRYPTION_KEY : process.env.CB_ENCRYPTION_KEY_DEV;
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size in bytes

function encrypt(text) {
  // console.log("text", text);
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, "hex"), iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(text) {
  if (!text) return text;
  // console.log("text decrypt", text);

  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, "hex"), iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

module.exports = { encrypt, decrypt };
