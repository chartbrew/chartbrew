export function getMcpConnectionPayload(connection, { includeApprovals = true } = {}) {
  return {
    id: connection.id,
    name: connection.name,
    type: "mcp",
    subType: "mcp",
    host: connection.host.trim(),
    authentication: connection.authentication,
    options: { mcp: { toolQuery: connection.options?.mcp?.toolQuery || "" } },
    ...(includeApprovals ? {
      schema: { mcp: { allowedTools: connection.schema?.mcp?.allowedTools || {} } },
    } : {}),
  };
}
