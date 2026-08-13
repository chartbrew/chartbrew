import cookies from "react-cookies";

import { API_HOST } from "../config/settings";

async function workspaceLearningRequest(path) {
  const response = await fetch(`${API_HOST}${path}`, {
    headers: { Authorization: `Bearer ${cookies.load("brewToken")}` },
    method: "GET",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "The request could not be completed");
  }
  return body;
}

export function getWorkspaceLearningExport(teamId) {
  return workspaceLearningRequest(`/team/${teamId}/workspace-learning/export`);
}

export function getOrchestratorActionAudit(teamId, limit = 100) {
  return workspaceLearningRequest(`/team/${teamId}/orchestrator-audit?limit=${limit}`);
}

export function getOrchestratorEgressAudit(teamId, limit = 100) {
  return workspaceLearningRequest(`/team/${teamId}/orchestrator-egress-audit?limit=${limit}`);
}
