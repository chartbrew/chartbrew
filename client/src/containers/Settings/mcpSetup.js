export function getMcpClientType(name) {
  const normalizedName = typeof name === "string" ? name.replace(/[_-]/g, " ") : "";

  // Client names are self-reported. Use this only for the display icon.
  if (/\b(codex|chatgpt|openai)\b/i.test(normalizedName)) {
    return "openai";
  }
  if (/\bclaude\b/i.test(normalizedName)) {
    return "claude";
  }
  if (/\bcursor\b/i.test(normalizedName)) {
    return "cursor";
  }

  return "mcp";
}

export function getMcpSetup(resource) {
  const url = new URL(resource);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.pathname !== "/mcp" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  ) {
    throw new Error("The MCP server URL is not valid.");
  }
  const quoted = `'${url.href}'`;
  return {
    url: url.href,
    local,
    codex: `codex mcp add chartbrew --url ${quoted} --oauth-resource ${quoted} --oauth-client-registration dcr`,
    claudeCode: `claude mcp add --transport http --scope user chartbrew ${quoted}`,
    cursor: JSON.stringify({ mcpServers: { chartbrew: { url: url.href } } }, null, 2),
  };
}
