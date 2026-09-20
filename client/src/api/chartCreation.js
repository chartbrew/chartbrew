import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

export async function chartCreationRequest(projectId, path = "", body, signal) {
  const response = await fetch(`${API_HOST}/project/${projectId}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Authorization": `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || "The chart could not be loaded. Try again."), { status: response.status });
  return data;
}
