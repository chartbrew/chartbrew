const sshSecretFields = ["sshPassword", "sshPrivateKey", "sshPassphrase"];

export function stripEmptySshSecrets(connection = {}) {
  const sanitizedConnection = { ...connection };

  sshSecretFields.forEach((field) => {
    if (
      sanitizedConnection[field] === null
      || sanitizedConnection[field] === undefined
      || sanitizedConnection[field] === ""
    ) {
      delete sanitizedConnection[field];
    }
  });

  return sanitizedConnection;
}

export function hasSshCredential(connection = {}, sshFiles = {}) {
  return Boolean(
    connection.sshPassword
    || connection.sshPrivateKey
    || connection.hasSshPassword
    || connection.hasSshPrivateKey
    || sshFiles.sshPrivateKey
  );
}
