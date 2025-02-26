const fs = require("fs").promises;
const fsSync = require("fs");

const { encrypt, decrypt } = require("./cbCrypto");

/**
 * Encrypts a file and replaces the original with the encrypted version
 * @param {string} filePath - Path to the file to encrypt
 * @returns {Promise<string>} - Path to the encrypted file
 */
async function encryptFile(filePath) {
  try {
    // Read the file
    const fileContent = await fs.readFile(filePath);

    // Encrypt the content
    const encryptedContent = encrypt(fileContent.toString("base64"));

    // Write the encrypted content back to the file
    await fs.writeFile(filePath, encryptedContent);

    return filePath;
  } catch (error) {
    console.error(`Error encrypting file ${filePath}:`, error); // eslint-disable-line no-console
    throw error;
  }
}

/**
 * Decrypts a file and returns the content
 * Handles both encrypted and unencrypted (legacy) files
 * @param {string} filePath - Path to the file
 * @returns {Promise<Buffer>} - Decrypted file content as a Buffer
 */
async function decryptFile(filePath) {
  try {
    // Read the file
    const fileContent = await fs.readFile(filePath, "utf8");

    try {
      // Try to decrypt assuming it's encrypted
      const decryptedContent = decrypt(fileContent);
      return Buffer.from(decryptedContent, "base64");
    } catch (decryptError) {
      // If decryption fails, assume it's an unencrypted legacy file
      // and return the content directly as a buffer
      return Buffer.from(fileContent);
    }
  } catch (error) {
    console.error(`Error reading/decrypting file ${filePath}:`, error); // eslint-disable-line no-console
    throw error;
  }
}

/**
 * Synchronously decrypts a file and returns the content
 * Handles both encrypted and unencrypted (legacy) files
 * For use in places where async/await cannot be used
 * @param {string} filePath - Path to the file
 * @returns {Buffer} - Decrypted file content as a Buffer
 */
function decryptFileSync(filePath) {
  try {
    // Read the file
    const fileContent = fsSync.readFileSync(filePath, "utf8");

    try {
      // Try to decrypt assuming it's encrypted
      const decryptedContent = decrypt(fileContent);
      return Buffer.from(decryptedContent, "base64");
    } catch (decryptError) {
      // If decryption fails, assume it's an unencrypted legacy file
      // and return the content directly as a buffer
      return Buffer.from(fileContent);
    }
  } catch (error) {
    console.error(`Error reading/decrypting file ${filePath}:`, error); // eslint-disable-line no-console
    throw error;
  }
}

module.exports = {
  encryptFile,
  decryptFile,
  decryptFileSync
};
