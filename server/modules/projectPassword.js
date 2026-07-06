const bcrypt = require("bcrypt");
const crypto = require("crypto");

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_HASH_PATTERN.test(value);
}

async function hashProjectPassword(password) {
  if (password === null || password === undefined || password === "") {
    return password;
  }

  const passwordString = `${password}`;
  if (isBcryptHash(passwordString)) {
    return passwordString;
  }

  return bcrypt.hash(passwordString, BCRYPT_ROUNDS);
}

function timingSafeStringEqual(input, storedPassword) {
  const inputBuffer = Buffer.from(`${input}`);
  const storedBuffer = Buffer.from(`${storedPassword}`);

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
}

async function verifyProjectPassword(input, storedPassword) {
  if (input === null || input === undefined || input === "" || !storedPassword) {
    return false;
  }

  const storedPasswordString = `${storedPassword}`;
  if (isBcryptHash(storedPasswordString)) {
    return bcrypt.compare(`${input}`, storedPasswordString);
  }

  return timingSafeStringEqual(input, storedPasswordString);
}

module.exports = {
  hashProjectPassword,
  isBcryptHash,
  verifyProjectPassword,
};
