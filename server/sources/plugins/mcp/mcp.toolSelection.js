const { MCP_LIMITS } = require("./mcp.constants");
const { createMcpError } = require("./mcp.policy");
const providers = require("./mcp.providers");

function tokenize(value) {
  return new Set(String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function scoreTool(tool, question) {
  const query = String(question || "").trim().toLowerCase();
  const haystack = `${tool.name} ${tool.title || ""} ${tool.description || ""}`.toLowerCase();
  const questionTokens = tokenize(question);
  const nameTokens = tokenize(`${tool.name} ${tool.title || ""}`);
  const descriptionTokens = tokenize(tool.description || "");
  let descriptionScore = 0;
  let nameScore = 0;
  questionTokens.forEach((token) => {
    if (nameTokens.has(token)) nameScore += 1;
    if (descriptionTokens.has(token)) descriptionScore += 1;
  });
  const phraseScore = query && haystack.includes(query) ? 8 : 0;
  return { score: (nameScore * 4) + descriptionScore + phraseScore, strongMatch: nameScore > 0 };
}

function selectTools(tools, { question = "", allowedTools = {}, limit = 24 } = {}) {
  if (tools.length <= MCP_LIMITS.maxTools) return tools;
  const approved = tools.filter((tool) => allowedTools[tool.name]?.ask || allowedTools[tool.name]?.datasets);
  if (approved.length > MCP_LIMITS.maxTools) {
    throw createMcpError("MCP_TOO_MANY_TOOLS", "Too many tools are approved. Remove unused approvals before reloading tools.");
  }
  const selected = new Map(approved.map((tool) => [tool.name, tool]));
  const candidates = tools.filter((tool) => tool.annotations?.destructiveHint !== true);
  const helpers = candidates.filter((tool) => tool.annotations?.readOnlyHint === true
    && /schema|docs|search|execute[-_]sql|query|list[-_]projects/i.test(tool.name)).slice(0, 4);
  helpers.forEach((tool) => selected.set(tool.name, tool));
  // ponytail: lexical matching can miss synonyms; add semantic ranking if real queries need it.
  const ranked = candidates.map((tool) => ({ tool, ...scoreTool(tool, question) }))
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  for (const { tool, score } of ranked) {
    if (selected.size >= Math.max(limit, approved.length)) break;
    if (!question || score > 0) selected.set(tool.name, tool);
  }
  // A small starter set is still useful when provider vocabulary does not match the question.
  if (!selected.size) ranked.slice(0, 4).forEach(({ tool }) => selected.set(tool.name, tool));
  return [...selected.values()].slice(0, MCP_LIMITS.maxTools);
}

function getMcpEndpoint(connection, { discoverTools = false } = {}) {
  const url = new URL(connection.host);
  if (discoverTools || !(connection.schema?.mcp?.omittedToolCount > 0)) return url.toString();
  const provider = providers.find((entry) => {
    const endpoint = new URL(entry.url);
    return url.origin === endpoint.origin && url.pathname.replace(/\/$/, "") === endpoint.pathname;
  });
  const filter = provider?.toolFilter;
  // URL filters are provider extensions, not MCP. Never invent them or replace a user's filter.
  if (!filter || [filter.parameter, ...(filter.preserveParameters || [])].some((name) => url.searchParams.has(name))) return url.toString();
  const tools = (connection.schema?.mcp?.tools || []).map((tool) => tool.name);
  const approvals = connection.schema?.mcp?.allowedTools || {};
  Object.keys(approvals).forEach((name) => {
    if ((approvals[name]?.ask || approvals[name]?.datasets) && !tools.includes(name)) tools.push(name);
  });
  if (tools.length) url.searchParams.set(filter.parameter, tools.join(","));
  return url.toString();
}

module.exports = { getMcpEndpoint, scoreTool, selectTools };
