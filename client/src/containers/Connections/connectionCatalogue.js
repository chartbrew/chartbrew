import mcpCatalogue from "../../sources/mcp/mcp-catalogue.js";

function getCatalogueOrder(item) {
  if (item.category === "database") return 0;
  if (item.id === "mcp") return 1;
  if (item.id === "api") return 2;
  return item.method === "MCP" ? 4 : 3;
}

export function getConnectionCatalogue(sources) {
  return sources.flatMap((source) => {
    const item = {
      ...source,
      sourceId: source.id,
      method: source.category === "database" ? "Database" : "API",
    };
    if (source.id !== "mcp") return [item];

    return [
      ...mcpCatalogue.map((entry) => ({
        ...item,
        ...entry,
        method: "MCP",
        assets: source.providers?.[entry.provider]?.assets || source.assets,
        connectionDefaults: {
          name: `${entry.name} MCP`,
          host: entry.host,
          authentication: { type: "oauth" },
        },
      })),
      { ...item, name: "Custom MCP server", method: "MCP" },
    ];
  }).sort((a, b) => getCatalogueOrder(a) - getCatalogueOrder(b));
}

export function filterConnectionCatalogue(items, category, search) {
  const query = search.trim().toLowerCase();
  return items.filter((item) => {
    const matchesCategory = category === "all"
      || category === "database" && item.category === "database"
      || category === "services" && item.category !== "database" && item.id !== "mcp"
      || category === "mcp" && item.method === "MCP";
    return matchesCategory && `${item.name} ${item.description || ""} ${item.method}`.toLowerCase().includes(query);
  });
}
