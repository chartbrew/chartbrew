const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");

const CONNECTION_FILE_FIELDS = ["sslCa", "sslCert", "sslKey", "sshPrivateKey"];
const CONNECTION_FILES_DIRECTORY = path.resolve(".connectionFiles");

function resolveManagedConnectionFile(filePath) {
  if (typeof filePath !== "string" || !filePath) return null;

  try {
    const resolvedPath = path.resolve(filePath);
    const relativePath = path.relative(CONNECTION_FILES_DIRECTORY, resolvedPath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return null;
    }

    return resolvedPath;
  } catch (_error) {
    return null;
  }
}

function isManagedConnectionFile(filePath) {
  return Boolean(resolveManagedConnectionFile(filePath));
}

async function removeManagedConnectionFile(filePath) {
  const resolvedPath = resolveManagedConnectionFile(filePath);
  if (!resolvedPath) return false;

  try {
    await fs.unlink(resolvedPath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function copyManagedConnectionFile(filePath) {
  const sourcePath = resolveManagedConnectionFile(filePath);
  if (!sourcePath) return null;

  await fs.mkdir(CONNECTION_FILES_DIRECTORY, { recursive: true });
  const storedPath = path.join(".connectionFiles", crypto.randomBytes(16).toString("hex"));
  const destinationPath = resolveManagedConnectionFile(storedPath);

  try {
    await fs.copyFile(sourcePath, destinationPath);
    return storedPath;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

module.exports = {
  CONNECTION_FILE_FIELDS,
  CONNECTION_FILES_DIRECTORY,
  copyManagedConnectionFile,
  isManagedConnectionFile,
  removeManagedConnectionFile,
  resolveManagedConnectionFile,
};
