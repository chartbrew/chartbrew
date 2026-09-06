const TOOLS_PER_PAGE = 10;

export function getMcpToolsToAllow(tools, approvals = {}) {
  return tools.filter((tool) => tool.annotations?.destructiveHint !== true
    && (approvals[tool.name]?.ask !== true || approvals[tool.name]?.datasets !== true
      || approvals[tool.name]?.contractFingerprint !== tool.contractFingerprint
      || approvals[tool.name]?.riskFingerprint !== tool.riskFingerprint));
}

function toolMatchesHintFilter(tool, filterId) {
  const annotations = tool?.annotations || {};
  if (!filterId || filterId === "all") return true;
  if (filterId === "unmarked") {
    return !annotations.readOnlyHint
      && !annotations.destructiveHint
      && !annotations.idempotentHint
      && !annotations.openWorldHint;
  }
  return annotations[filterId] === true;
}

export function getMcpToolPage(tools, { search = "", hintFilter = "all", page = 1 } = {}) {
  const query = search.trim().toLowerCase();
  const matches = tools.filter((tool) => toolMatchesHintFilter(tool, hintFilter)
    && (!query || `${tool.name} ${tool.title || ""} ${tool.description || ""}`.toLowerCase().includes(query)));
  const totalPages = Math.max(1, Math.ceil(matches.length / TOOLS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * TOOLS_PER_PAGE;
  return {
    tools: matches.slice(start, start + TOOLS_PER_PAGE),
    page: currentPage,
    totalPages,
    total: matches.length,
    start: matches.length ? start + 1 : 0,
    end: Math.min(start + TOOLS_PER_PAGE, matches.length),
  };
}
