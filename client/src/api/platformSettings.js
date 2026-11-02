import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

async function settingsRequest(path, options = {}) {
  const response = await fetch(`${API_HOST}${path}`, {
    ...options,
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "The request could not be completed");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function getPlatformSettings() {
  return settingsRequest("/platform/settings");
}

export function getPlatformAnalytics(days, signal) {
  return settingsRequest(`/platform/analytics?days=${encodeURIComponent(days)}`, { signal });
}

export function getTeamAnalytics(teamId, days, signal) {
  return settingsRequest(`/team/${encodeURIComponent(teamId)}/analytics?days=${encodeURIComponent(days)}`, { signal });
}

export function updatePlatformSettings(settings) {
  return settingsRequest("/platform/settings", {
    body: JSON.stringify({ settings }),
    method: "PUT",
  });
}

export function resetPlatformSettings(keys) {
  return settingsRequest("/platform/settings/reset", {
    body: JSON.stringify({ keys }),
    method: "POST",
  });
}
