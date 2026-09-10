const db = require("../../../../models/models");
const {
  getOrchestratorSources,
  getSupportedConnectionTypes,
  getSupportedSourceForConnection,
} = require("../sourceSupport");
const { createHttpError, getObservationAccess } = require("../../../observations/access");
const mcpProviders = require("../../../../sources/plugins/mcp/mcp.providers");
const { normalizeTeamId, requireProjectForTeam } = require("./teamScope");

const normalizeName = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function matchesProvider(provider, ...names) {
  return !provider || names.some((name) => normalizeName(name) === normalizeName(provider));
}

function getMcpProvider(host) {
  try {
    const url = new URL(host);
    return mcpProviders.find((entry) => {
      const endpoint = new URL(entry.url);
      return url.origin === endpoint.origin && url.pathname.replace(/\/$/, "") === endpoint.pathname;
    });
  } catch (_) {
    return null;
  }
}

function supportsCapability(source, capability) {
  if (capability === "query") return source.capabilities.data?.supportsQuery;
  if (capability === "schema") return source.capabilities.data?.supportsSchema;
  if (capability === "tools") return source.capabilities.ai?.hasTools;
  return true;
}

function getSetupOptions(provider, capability, sources) {
  const nativeSources = sources.filter((source) => source.id !== "mcp"
    && matchesProvider(provider, source.id, source.name, source.type, source.subType)
    && supportsCapability(source, capability));
  if (nativeSources.length) {
    return nativeSources.slice(0, 5).map((source) => ({
      state: "native_setup",
      source_id: source.id,
      name: source.name,
      setup_url: `/connections/new?type=${encodeURIComponent(source.id)}`,
    }));
  }
  if (sources.some((source) => source.id === "mcp")) {
    const providers = mcpProviders.filter((entry) => matchesProvider(provider, entry.id, entry.name)
      && (!capability || entry.capabilities.includes(capability)));
    if (providers.length) {
      return providers.slice(0, 5).map((entry) => ({
        state: "mcp_oauth_setup",
        source_id: "mcp",
        provider_id: entry.id,
        name: entry.name,
        server_url: entry.url,
        setup_url: "/connections/new?type=mcp",
        documentation_url: entry.documentationUrl,
        note: entry.note,
      }));
    }
    return [{ state: "manual_mcp_setup", name: provider || "MCP server", setup_url: "/connections/new?type=mcp" }];
  }
  return [{ state: "unsupported", name: provider || "Data source" }];
}

async function listConnections(payload) {
  const { project_id, team_id, user_id, provider, capability } = payload;
  const normalizedTeamId = normalizeTeamId(team_id);
  if ((provider != null && (typeof provider !== "string" || !normalizeName(provider) || provider.length > 100))
    || (capability != null && !["query", "schema", "tools"].includes(capability))) {
    throw createHttpError("Specify a provider name and a supported data capability.", 400);
  }
  if (!Number.isInteger(Number(user_id)) || Number(user_id) <= 0) {
    throw createHttpError("Access denied", 403);
  }
  const access = await getObservationAccess(normalizedTeamId, user_id);
  // Connection configuration is restricted to team owners and admins, as in context selection.
  // Other roles can still search and run datasets from their permitted dashboards.
  if (!access.canConfigureTeam) {
    return { connections: [], options: [{ state: "admin_required", name: provider || "Data source" }] };
  }
  const sources = getOrchestratorSources();
  const whereClause = {
    team_id: normalizedTeamId,
  };

  // If project_id is provided, filter by connections used in that project
  if (project_id) {
    await requireProjectForTeam(project_id, normalizedTeamId);

    const datasets = await db.Dataset.findAll({
      where: {
        team_id: normalizedTeamId,
      },
      attributes: ["connection_id", "project_ids"],
      include: [{
        model: db.DataRequest,
        attributes: ["connection_id"],
      }],
    });

    const connectionIds = new Set();
    datasets.forEach((ds) => {
      const datasetProjectIds = Array.isArray(ds.project_ids) ? ds.project_ids : [];
      const isProjectDataset = datasetProjectIds.some((id) => String(id) === String(project_id));

      if (!isProjectDataset) {
        return;
      }

      if (ds.connection_id) connectionIds.add(ds.connection_id);
      if (ds.DataRequests) {
        ds.DataRequests.forEach((dr) => {
          if (dr.connection_id) connectionIds.add(dr.connection_id);
        });
      }
    });

    if (connectionIds.size > 0) {
      whereClause.id = Array.from(connectionIds);
    } else {
      whereClause.id = [];
    }
  }

  const connections = await db.Connection.findAll({
    where: {
      ...whereClause,
      type: getSupportedConnectionTypes()
    },
    attributes: ["id", "type", "subType", "name", "active", "host", "schema"],
    order: [["createdAt", "DESC"]],
  });

  const filteredConnections = connections
    .map((conn) => ({
      connection: conn,
      source: getSupportedSourceForConnection(conn),
    }))
    .filter(({ connection, source }) => source
      && supportsCapability(source, capability)
      && matchesProvider(provider, connection.name, source.id, source.name, source.type, source.subType,
        source.id === "mcp" ? getMcpProvider(connection.host)?.name : null));

  const usableConnections = filteredConnections.filter(({ connection, source }) => connection.active
    && (source.id !== "mcp" || source.backend.ai.getCapabilities({ connection }).approvedToolCount > 0));
  // Existing sources win over new setup. Do not claim metric coverage from a provider match alone.
  let options;
  if (usableConnections.length) {
    options = usableConnections.slice(0, 5).map(({ connection, source }) => ({
      state: "connected", connection_id: connection.id, source_id: source.id, name: connection.name,
    }));
  } else if (filteredConnections.length) {
    options = filteredConnections.slice(0, 5).map(({ connection, source }) => {
      const providerEntry = source.id === "mcp" ? getMcpProvider(connection.host) : null;
      let state = "native_setup";
      if (connection.active) state = "admin_required";
      else if (providerEntry) state = "mcp_oauth_setup";
      return {
        state,
        connection_id: connection.id,
        source_id: source.id,
        name: connection.name,
        setup_url: `/connections/${connection.id}`,
        ...(providerEntry ? { provider_id: providerEntry.id } : {}),
        ...(connection.active ? { reason: "Review and approve read-only tools before using this connection." } : {}),
      };
    });
  } else {
    options = getSetupOptions(provider, capability, sources);
  }

  return {
    connections: usableConnections.slice(0, 5).map(({ connection, source }) => ({
      id: connection.id,
      type: connection.type,
      subType: connection.subType,
      source_id: source.id,
      source_name: source.name,
      name: connection.name,
    })),
    options,
    ...(usableConnections.length > 5 ? { has_more: true } : {}),
  };
}

module.exports = listConnections;
