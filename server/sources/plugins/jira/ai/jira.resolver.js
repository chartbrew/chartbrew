const jiraConnection = require("../jira.connection");

const PROJECT_TOKEN_IGNORE = new Set(["JIRA", "SCRUM", "SPRINT", "STATUS", "DONE", "OPEN"]);

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function firstOverrideValue(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : null;
  return String(value).split(",")[0].trim();
}

function extractProjectKey(question = "", overrides = {}) {
  const explicitProject = firstOverrideValue(overrides.project || overrides.projects || overrides.projectIdOrKey);
  if (explicitProject) return explicitProject;

  const matches = String(question || "").match(/\b[A-Z][A-Z0-9_]{1,12}\b/g) || [];
  return matches.find((match) => !PROJECT_TOKEN_IGNORE.has(match)) || null;
}

function extractAssigneeQuery(question = "", overrides = {}) {
  const explicitAssignee = firstOverrideValue(overrides.assigneeName || overrides.assignee);
  if (explicitAssignee) return explicitAssignee;

  const directMatch = String(question || "").match(/\b(?:assigned\s+to|assignee|by)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)/);
  if (directMatch) return directMatch[1].trim();

  const currentWorkMatch = String(question || "").match(/\b(?:is|are)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)\s+(?:working|doing)/);
  if (currentWorkMatch) return currentWorkMatch[1].trim();

  const completedWorkMatch = String(question || "").match(/\b(?:did|has|have)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)\s+(?:complete|completed|finish|finished|close|closed|resolve|resolved)\b/);
  if (completedWorkMatch) return completedWorkMatch[1].trim();

  const possessiveMatch = String(question || "").match(/\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)'s\s+(?:tasks|issues|work)\b/);
  return possessiveMatch ? possessiveMatch[1].trim() : null;
}

function extractVersionName(question = "", overrides = {}) {
  const explicitVersion = firstOverrideValue(overrides.fixVersion || overrides.version);
  if (explicitVersion) return explicitVersion;

  const match = String(question || "").match(/\bv?\d+(?:\.\d+){1,3}(?:[-_][A-Za-z0-9]+)?\b/i);
  return match ? match[0] : null;
}

function shouldResolveSprints(question = "", intent = {}) {
  return intent.resource === "sprint_issues"
    || intent.needsSprint === true
    || normalizeText(question).includes("sprint");
}

function shouldResolveUser(question = "", intent = {}) {
  const normalizedQuestion = normalizeText(question);
  return intent.needsUser === true
    || normalizedQuestion.includes("assignee")
    || normalizedQuestion.includes("assigned to")
    || normalizedQuestion.includes("workload for")
    || normalizedQuestion.includes("workload by")
    || normalizedQuestion.includes("working on")
    || /\b(?:did|has|have)\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?\s+(?:complete|completed|finish|finished|close|closed|resolve|resolved)\b/.test(String(question || ""))
    || /\bfor\s+[A-Z][a-zA-Z]+/.test(String(question || ""))
    || /\bby\s+[A-Z][a-zA-Z]+/.test(String(question || ""));
}

function shouldResolveVersion(question = "", intent = {}) {
  const normalizedQuestion = normalizeText(question);
  return intent.needsVersion === true
    || normalizedQuestion.includes("release")
    || normalizedQuestion.includes("version")
    || normalizedQuestion.includes("fix version");
}

async function resolveProject(connection, question, overrides) {
  const inferredKey = extractProjectKey(question, overrides);
  if (!inferredKey) return null;

  try {
    const projects = await jiraConnection.listProjects(connection);
    const projectList = Array.isArray(projects) ? projects : [];
    const exactProject = projectList.find((project) => project.key === inferredKey);
    if (exactProject) {
      return {
        id: String(exactProject.id),
        key: exactProject.key,
        name: exactProject.name,
        confidence: 0.98,
      };
    }

    const normalizedKey = normalizeText(inferredKey);
    const fuzzyProject = projectList.find((project) => normalizeText(project.name).includes(normalizedKey));
    if (fuzzyProject) {
      return {
        id: String(fuzzyProject.id),
        key: fuzzyProject.key,
        name: fuzzyProject.name,
        confidence: 0.75,
      };
    }
  } catch (error) {
    // If Jira discovery is unavailable, keep the user's explicit project token.
  }

  return {
    key: inferredKey,
    confidence: 0.9,
  };
}

function buildSprintOption(sprint) {
  return {
    label: `Use ${sprint.name}${sprint.boardName ? ` on ${sprint.boardName}` : ""}`,
    value: `sprint:${sprint.id}`,
  };
}

function assignBoardAndSprint(entities, sprint, confidence) {
  entities.board = {
    id: String(sprint.boardId),
    name: sprint.boardName,
    type: sprint.boardType,
    confidence: 0.9,
  };
  entities.sprint = {
    id: String(sprint.id),
    name: sprint.name,
    state: sprint.state,
    confidence,
  };
}

async function resolveBoardAndSprint({ connection, entities, overrides = {}, mode = "preview" }) {
  if (overrides.sprintId) {
    entities.sprint = {
      id: String(overrides.sprintId),
      confidence: 1,
    };
    if (overrides.boardId) {
      entities.board = {
        id: String(overrides.boardId),
        confidence: 1,
      };
    }
    return { needsDisambiguation: false, options: [] };
  }

  if (!connection || !entities.project?.key) return { needsDisambiguation: false, options: [] };

  let boards = [];
  if (overrides.boardId) {
    boards = [{
      id: overrides.boardId,
      name: `Board ${overrides.boardId}`,
      type: "scrum",
    }];
  } else {
    try {
      const listedBoards = await jiraConnection.listBoards(connection, {
        projectKeyOrId: entities.project.key,
        maxResults: 50,
      });
      boards = Array.isArray(listedBoards) ? listedBoards : [];
    } catch (error) {
      return { needsDisambiguation: false, options: [] };
    }
  }

  const candidateBoards = boards
    .filter((board) => ["scrum", "kanban"].includes(board.type))
    .slice(0, 10);
  if (candidateBoards.length === 0) return { needsDisambiguation: false, options: [] };

  const sprintResults = await Promise.all(candidateBoards.map(async (board) => {
    try {
      const sprints = await jiraConnection.listSprints(connection, {
        boardId: board.id,
        maxResults: 50,
        state: "active",
      });
      return (Array.isArray(sprints) ? sprints : [])
        .filter((sprint) => sprint.state === "active")
        .map((sprint) => ({
          ...sprint,
          id: String(sprint.id),
          boardId: String(board.id),
          boardName: board.name,
          boardType: board.type,
        }));
    } catch (error) {
      return [];
    }
  }));

  const activeSprints = sprintResults.flat();

  const options = activeSprints.slice(0, 4).map(buildSprintOption);

  if (activeSprints.length === 1) {
    assignBoardAndSprint(entities, activeSprints[0], 0.95);
  } else if (activeSprints.length > 1 && mode === "persist") {
    return { needsDisambiguation: true, options };
  } else if (activeSprints.length > 1) {
    assignBoardAndSprint(entities, activeSprints[0], 0.7);
  }

  return { needsDisambiguation: false, options };
}

async function resolveUser({ connection, question, overrides, intent, entities, warnings }) {
  if (!connection || !shouldResolveUser(question, intent)) return;

  const query = extractAssigneeQuery(question, overrides);
  if (!query) return;

  let users = [];
  try {
    const listedUsers = await jiraConnection.listUsers(connection, {
      query,
      maxResults: 20,
    });
    users = Array.isArray(listedUsers) ? listedUsers : [];
  } catch (error) {
    entities.user = null;
    warnings.push("Could not resolve Jira user.");
    return;
  }

  const exactUser = users.find((user) => normalizeText(user.displayName) === normalizeText(query));
  const selectedUser = exactUser || users[0];

  if (selectedUser) {
    entities.user = {
      accountId: String(selectedUser.accountId),
      displayName: selectedUser.displayName,
      confidence: exactUser ? 0.95 : 0.8,
    };
  }
}

async function resolveVersion({ connection, question, overrides, intent, entities, warnings }) {
  if (!connection || !entities.project?.key || !shouldResolveVersion(question, intent)) return;

  const versionName = extractVersionName(question, overrides);
  if (!versionName) return;

  let versions = [];
  try {
    const listedVersions = await jiraConnection.listVersions(connection, {
      projectIdOrKey: entities.project.key,
    });
    versions = Array.isArray(listedVersions) ? listedVersions : [];
  } catch (error) {
    entities.version = null;
    warnings.push("Could not resolve Jira version.");
    return;
  }

  const exactVersion = versions.find((version) => normalizeText(version.name) === normalizeText(versionName));
  const fuzzyVersion = versions.find((version) => normalizeText(version.name).includes(normalizeText(versionName)));
  const selectedVersion = exactVersion || fuzzyVersion;

  if (selectedVersion) {
    entities.version = {
      id: String(selectedVersion.id),
      name: selectedVersion.name,
      confidence: exactVersion ? 0.95 : 0.8,
    };
  }
}

async function resolveContext({
  connection,
  question = "",
  overrides = {},
  intent = {},
  mode = "preview",
} = {}) {
  const entities = {};
  const warnings = [];
  const project = await resolveProject(connection, question, overrides);
  if (project) entities.project = project;

  let needsDisambiguation = false;
  let options = [];
  if (shouldResolveSprints(question, intent)) {
    const sprintResolution = await resolveBoardAndSprint({
      connection,
      entities,
      overrides,
      mode,
    });
    needsDisambiguation = sprintResolution.needsDisambiguation;
    options = sprintResolution.options;
  }

  await resolveUser({ connection, question, overrides, intent, entities, warnings });
  await resolveVersion({ connection, question, overrides, intent, entities, warnings });

  return {
    needsDisambiguation,
    entities,
    options,
    warnings,
  };
}

module.exports = {
  extractProjectKey,
  resolveContext,
};
