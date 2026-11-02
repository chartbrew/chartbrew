import { findSourceForConnection, getSourceLogo } from "../sources";

export default function getConnectionLogo(connection, isDark) {
  const mcpIcon = connection?.schema?.mcp?.server?.icon;
  if (mcpIcon) return mcpIcon;

  const source = findSourceForConnection(connection);

  return getSourceLogo(source, isDark);
}
