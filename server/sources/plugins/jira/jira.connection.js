const request = require("request-promise");

const { FIELD_MAPPING_NAMES } = require("./jira.resources");

function normalizeSiteUrl(siteUrl = "") {
  const trimmed = String(siteUrl).trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+\.atlassian\.net$/i.test(trimmed)) {
    throw new Error("Enter a Jira Cloud site URL like https://example.atlassian.net");
  }
  return trimmed;
}

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toJSON === "function") return value.toJSON();
  return { ...value };
}

function getCredentials(connection) {
  const plainConnection = toPlainObject(connection);
  const siteUrl = normalizeSiteUrl(
    plainConnection.host
      || plainConnection.options?.jira?.siteUrl
      || plainConnection.authentication?.siteUrl
  );
  const email = plainConnection.authentication?.email
    || plainConnection.authentication?.user
    || plainConnection.username
    || "";
  const apiToken = plainConnection.authentication?.apiToken
    || plainConnection.authentication?.token
    || plainConnection.password
    || "";

  if (!email) throw new Error("Enter your Jira account email");
  if (!apiToken) throw new Error("Enter your Jira API token");

  return { siteUrl, email, apiToken };
}

function parseErrorBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;

  try {
    return JSON.parse(body);
  } catch (error) {
    return { message: String(body).slice(0, 500) };
  }
}

function getSafeJiraErrorMessage(error = {}) {
  const statusCode = error.statusCode || error.response?.statusCode || null;
  const body = parseErrorBody(error.error || error.response?.body);
  const messages = [];

  if (Array.isArray(body.errorMessages)) {
    messages.push(...body.errorMessages);
  }

  if (body.errors && typeof body.errors === "object") {
    messages.push(...Object.values(body.errors));
  }

  if (body.message) {
    messages.push(body.message);
  }

  const message = messages.filter(Boolean).join(" ");
  return `${statusCode ? `${statusCode} - ` : ""}${message || "Jira request failed"}`;
}

function toSafeJiraError(error) {
  const safeError = new Error(getSafeJiraErrorMessage(error));
  safeError.statusCode = error?.statusCode || error?.response?.statusCode || null;
  return safeError;
}

function jiraRequest(connection, route, options = {}) {
  const { siteUrl, email, apiToken } = getCredentials(connection);
  return request({
    method: options.method || "GET",
    uri: `${siteUrl}${route}`,
    auth: {
      user: email,
      pass: apiToken,
    },
    qs: options.qs || undefined,
    body: options.body || undefined,
    json: true,
    resolveWithFullResponse: false,
  }).catch((error) => {
    throw toSafeJiraError(error);
  });
}

function getMyself(connection) {
  return jiraRequest(connection, "/rest/api/3/myself");
}

function listProjects(connection) {
  return jiraRequest(connection, "/rest/api/3/project/search", {
    qs: { maxResults: 50 },
  }).then((response) => {
    return (response.values || []).map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      projectTypeKey: project.projectTypeKey,
    }));
  });
}

function listIssueTypes(connection) {
  return jiraRequest(connection, "/rest/api/3/issuetype")
    .then((issueTypes) => {
      return (issueTypes || []).map((issueType) => ({
        id: issueType.id,
        name: issueType.name,
        description: issueType.description || "",
        subtask: issueType.subtask === true,
      }));
    });
}

function listStatuses(connection) {
  return jiraRequest(connection, "/rest/api/3/status")
    .then((statuses) => {
      return (statuses || []).map((status) => ({
        id: status.id,
        name: status.name,
        statusCategory: status.statusCategory?.name || null,
        statusCategoryId: status.statusCategory?.id || null,
        statusCategoryKey: status.statusCategory?.key || null,
      }));
    });
}

function listUsers(connection, params = {}) {
  return jiraRequest(connection, "/rest/api/3/user/search", {
    qs: {
      query: params.query || "",
      maxResults: Math.min(Number(params.maxResults || 50), 50),
    },
  }).then((users) => {
    return (users || []).map((user) => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress || null,
      active: user.active,
    }));
  });
}

function listBoards(connection, params = {}) {
  return jiraRequest(connection, "/rest/agile/1.0/board", {
    qs: {
      maxResults: Math.min(Number(params.maxResults || 50), 50),
      projectKeyOrId: params.projectKeyOrId || undefined,
      type: params.type || undefined,
    },
  }).then((response) => {
    return (response.values || []).map((board) => ({
      id: board.id,
      name: board.name,
      type: board.type,
    }));
  });
}

function getBoardConfiguration(connection, params = {}) {
  if (!params.boardId) {
    throw new Error("boardId is required");
  }

  return jiraRequest(connection, `/rest/agile/1.0/board/${params.boardId}/configuration`);
}

function listSprints(connection, params = {}) {
  if (!params.boardId) {
    throw new Error("boardId is required");
  }

  return jiraRequest(connection, `/rest/agile/1.0/board/${params.boardId}/sprint`, {
    qs: {
      maxResults: Math.min(Number(params.maxResults || 50), 50),
      state: params.state || undefined,
    },
  }).then((response) => {
    return (response.values || []).map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null,
      completeDate: sprint.completeDate || null,
    }));
  });
}

function listVersions(connection, params = {}) {
  if (!params.projectIdOrKey) {
    throw new Error("projectIdOrKey is required");
  }

  return jiraRequest(connection, `/rest/api/3/project/${params.projectIdOrKey}/versions`)
    .then((versions) => {
      return (versions || []).map((version) => ({
        id: version.id,
        name: version.name,
        released: version.released === true,
        archived: version.archived === true,
        releaseDate: version.releaseDate || null,
      }));
    });
}

function listFields(connection) {
  return jiraRequest(connection, "/rest/api/3/field")
    .then((fields) => {
      return (fields || []).map((field) => ({
        id: field.id,
        key: field.key,
        name: field.name,
        custom: field.custom === true,
        schema: field.schema || {},
      }));
    });
}

function normalizeFieldName(name = "") {
  return String(name).trim().toLowerCase();
}

function detectFieldMappingsFromFields(fields = []) {
  const candidates = {};
  const fieldMappings = {};

  Object.entries(FIELD_MAPPING_NAMES).forEach(([semanticName, names]) => {
    const matches = fields.filter((field) => {
      const fieldName = normalizeFieldName(field.name);
      return names.some((name) => fieldName.includes(name));
    });

    candidates[semanticName] = matches.map((field) => ({
      id: field.id,
      name: field.name,
      schema: field.schema || {},
    }));

    if (matches[0]) {
      fieldMappings[semanticName] = matches[0].id;
    }
  });

  return { fieldMappings, candidates };
}

async function detectFieldMappings(connection) {
  const fields = await listFields(connection);
  return detectFieldMappingsFromFields(fields);
}

function validateJql(connection, params = {}) {
  const jql = String(params.jql || "").trim();
  if (!jql) {
    throw new Error("jql is required");
  }

  return jiraRequest(connection, "/rest/api/3/jql/parse", {
    method: "POST",
    qs: { validation: "strict" },
    body: { queries: [jql] },
  });
}

function previewJql(connection, params = {}) {
  const jql = String(params.jql || "").trim();
  if (!jql) {
    throw new Error("jql is required");
  }

  return jiraRequest(connection, "/rest/api/3/search/jql", {
    method: "POST",
    body: {
      jql,
      fields: Array.isArray(params.fields) ? params.fields : String(params.fields || "").split(",").filter(Boolean),
      maxResults: Math.min(Number(params.maxResults || 10), 50),
    },
  });
}

module.exports = {
  detectFieldMappings,
  detectFieldMappingsFromFields,
  getBoardConfiguration,
  getCredentials,
  getMyself,
  getSafeJiraErrorMessage,
  jiraRequest,
  listBoards,
  listFields,
  listIssueTypes,
  listProjects,
  listSprints,
  listStatuses,
  listUsers,
  listVersions,
  normalizeSiteUrl,
  previewJql,
  validateJql,
};
