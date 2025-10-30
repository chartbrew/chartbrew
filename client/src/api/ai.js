import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

export async function getAiConversations(teamId, userId) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/conversations?teamId=${teamId}&userId=${userId}`;
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

export async function getAiConversation(conversationId, teamId, userId) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/conversations/${conversationId}?teamId=${teamId}&userId=${userId}`;
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

export async function orchestrateAi(teamId, userId, question, conversationHistory = [], aiConversationId) {
  const token = getAuthToken();
  const url = `${API_HOST}/ai/orchestrate`;
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  const body = {
    teamId,
    userId,
    question,
    conversationHistory,
    aiConversationId
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
