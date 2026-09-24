export async function saveAndStartMcpOAuth({ existingConnection, save, startOAuth }) {
  const connection = existingConnection?.id ? existingConnection : await save();
  if (!connection?.id) {
    throw new Error("The connection could not be saved. Try again.");
  }
  const result = await startOAuth(connection.id);
  if (!result?.url) {
    throw new Error(result?.error || "The connection was saved, but OAuth could not start. Try again.");
  }
  return result.url;
}
