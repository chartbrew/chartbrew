import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

export async function getAiConversations(teamId, options = {}) {
  const token = getAuthToken();
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  const url = `${API_HOST}/ai/conversations?${params.toString()}`;
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });
  const response = await fetch(url, { headers, method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to fetch AI conversations");
  }

  return response.json();
}

export async function getAiConversation(conversationId, teamId) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/conversations/${conversationId}?teamId=${teamId}`;
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  const response = await fetch(url, { headers, method: "GET" });

  if (!response.ok) {
    throw new Error("Failed to fetch AI conversation");
  }

  return response.json();
}

export async function getAiTools(teamId) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/tools?teamId=${teamId}`;
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  const response = await fetch(url, { headers, method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to fetch AI tools");
  }

  return response.json();
}

export async function orchestrateAi(teamId, question, conversationHistory = [], aiConversationId, context = null) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/orchestrate`;
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  const body = {
    teamId,
    question,
    conversationHistory,
    aiConversationId,
    context
  };

  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to orchestrate AI");
  }

  return response.json();
}

export async function respondAi({
  action,
  aiConversationId,
  context = null,
  message,
  persistence = "ephemeral",
  sessionId,
  teamId,
}) {
  const token = getAuthToken();
  const response = await fetch(`${API_HOST}/ai/respond`, {
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    method: "POST",
    body: JSON.stringify({
      action,
      aiConversationId,
      context,
      message,
      persistence,
      sessionId,
      teamId,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Chartbrew could not answer right now");
  }
  return response.json();
}

export async function promoteAiSession(teamId, sessionId) {
  const token = getAuthToken();
  const response = await fetch(`${API_HOST}/ai/sessions/${sessionId}/promote`, {
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    method: "POST",
    body: JSON.stringify({ teamId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "This chat could not be saved");
  }
  return response.json();
}

export async function deleteAiConversation(conversationId, teamId) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/conversations/${conversationId}?teamId=${teamId}`;
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  const response = await fetch(url, {
    headers,
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }

  return response.json();
}

export async function getAiUsage(teamId, startDate, endDate) {
  const token = getAuthToken();
  let url = new URL(`${API_HOST}/ai/usage/${teamId}`);
  if (startDate) {
    url.searchParams.set("startDate", startDate);
  }
  if (endDate) {
    url.searchParams.set("endDate", endDate);
  }
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  const response = await fetch(url.toString(), { headers, method: "GET" });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch AI usage");
  }

  return response.json();
}
