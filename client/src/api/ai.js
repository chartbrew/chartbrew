import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

export async function getChartPreview(chartId) {
  const response = await fetch(`${API_HOST}/chart-previews/${encodeURIComponent(chartId)}`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || "The preview could not load"), { status: response.status });
  return { ...data.chart, preview: data.parsed };
}

export async function requestAiMemory(teamId, { method = "GET", id, text } = {}) {
  const response = await fetch(`${API_HOST}/ai/memory${id ? `/${encodeURIComponent(id)}` : ""}?teamId=${teamId}`, {
    method,
    headers: { "Authorization": `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
    ...(["POST", "PATCH"].includes(method) ? { body: JSON.stringify({ teamId, text }) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not update memory. Try again.");
  return data;
}

export async function getAiAvailability(teamId) {
  const token = getAuthToken();
  const params = new URLSearchParams({ teamId: String(teamId) });
  const response = await fetch(`${API_HOST}/ai/availability?${params.toString()}`, {
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    }),
    method: "GET",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Chartbrew AI availability could not be checked");
  }
  return data;
}

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
    const error = new Error("Could not open this conversation. Try again.");
    error.status = response.status;
    throw error;
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

export async function searchAiContext(teamId, options = {}) {
  const token = getAuthToken();
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (options.query) params.set("query", options.query);
  if (options.type) params.set("type", options.type);
  if (options.limit) params.set("limit", String(options.limit));
  const response = await fetch(`${API_HOST}/ai/context?${params.toString()}`, {
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    }),
    method: "GET",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Context could not be loaded");
  }
  return data;
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
  persistence = "persistent",
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

export async function placeAiChartPreview({
  action,
  aiConversationId,
  persistence,
  sessionId,
  teamId,
}) {
  const token = getAuthToken();
  const response = await fetch(`${API_HOST}/ai/chart-previews/place`, {
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    method: "POST",
    body: JSON.stringify({
      action,
      aiConversationId,
      persistence,
      sessionId,
      teamId,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "The chart could not be added to the dashboard");
  }
  return data.chartPreview;
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

export async function getAiConnectionSetup({ teamId, conversationId, providerId, create = false }) {
  const payload = { teamId, conversationId, providerId };
  const query = create ? "" : `?${new URLSearchParams(payload)}`;
  const response = await fetch(`${API_HOST}/ai/connections/setup${query}`, {
    method: create ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    ...(create ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The connection could not be prepared. Try again.");
  return data;
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
