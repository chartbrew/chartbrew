import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

async function observationRequest(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_HOST}${path}`, {
    ...options,
    headers: new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const retryAfterSeconds = payload.retryAfterSeconds
      || Number(response.headers.get("Retry-After"))
      || null;
    const retryAfterMinutes = retryAfterSeconds
      ? Math.max(1, Math.ceil(retryAfterSeconds / 60))
      : null;
    const rateLimitMessage = response.status === 429
      ? `You have sent too many test Activity digests. Try again in ${retryAfterMinutes || 60} minutes.`
      : null;
    const error = new Error(payload.error || rateLimitMessage || "The request could not be completed");
    error.code = payload.code;
    error.retryAfterSeconds = retryAfterSeconds;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function getHome(teamId) {
  return observationRequest(`/team/${teamId}/home`);
}

export function getActivity(teamId, filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  return observationRequest(`/team/${teamId}/activity?${query.toString()}`);
}

export function getDataHealth(teamId) {
  return observationRequest(`/team/${teamId}/data-health`);
}

export function getAlerts(teamId) {
  return observationRequest(`/team/${teamId}/alerts`);
}

export function getObservation(teamId, observationId) {
  return observationRequest(`/team/${teamId}/observations/${observationId}`);
}

export function updateObservationPreference(teamId, observationId, preference) {
  return observationRequest(`/team/${teamId}/observations/${observationId}/preference`, {
    body: JSON.stringify(preference),
    method: "PUT",
  });
}

export function sendObservationFeedback(teamId, observationId, feedback) {
  return observationRequest(`/team/${teamId}/observations/${observationId}/feedback`, {
    body: JSON.stringify(feedback),
    method: "POST",
  });
}

export function resolveObservation(teamId, observationId, resolved = true) {
  const action = resolved ? "resolve" : "reopen";
  return observationRequest(`/team/${teamId}/observations/${observationId}/${action}`, {
    body: JSON.stringify({}),
    method: "POST",
  });
}

export function exploreObservationDrivers(teamId, observationId) {
  return observationRequest(`/team/${teamId}/observations/${observationId}/drivers`, {
    body: JSON.stringify({}),
    method: "POST",
  });
}

export function getMonitors(teamId) {
  return observationRequest(`/team/${teamId}/monitors`);
}

export function getMonitorOptions(teamId, chartId) {
  return observationRequest(`/team/${teamId}/charts/${chartId}/monitor-options`);
}

export function getRecordCountOptions(teamId) {
  return observationRequest(`/team/${teamId}/record-count-options`);
}

export function createRecordCountMonitor(teamId, monitor) {
  return observationRequest(`/team/${teamId}/record-count-monitors`, {
    body: JSON.stringify(monitor),
    method: "POST",
  });
}

export function createMonitor(teamId, monitor) {
  return observationRequest(`/team/${teamId}/monitors`, {
    body: JSON.stringify(monitor),
    method: "POST",
  });
}

export function updateMonitor(teamId, monitorId, monitor) {
  return observationRequest(`/team/${teamId}/monitors/${monitorId}`, {
    body: JSON.stringify(monitor),
    method: "PUT",
  });
}

export function deleteMonitor(teamId, monitorId) {
  return observationRequest(`/team/${teamId}/monitors/${monitorId}`, {
    method: "DELETE",
  });
}

export function refreshMonitor(teamId, monitorId) {
  return observationRequest(`/team/${teamId}/monitors/${monitorId}/refresh`, {
    body: JSON.stringify({}),
    method: "POST",
  });
}

export function getObservationDigests(teamId) {
  return observationRequest(`/team/${teamId}/observation-digests`);
}

export function getObservationDigestOptions(teamId) {
  return observationRequest(`/team/${teamId}/observation-digests/options`);
}

export function previewObservationDigest(teamId, subscription) {
  return observationRequest(`/team/${teamId}/observation-digests/preview`, {
    body: JSON.stringify(subscription),
    method: "POST",
  });
}

export function createObservationDigest(teamId, subscription) {
  return observationRequest(`/team/${teamId}/observation-digests`, {
    body: JSON.stringify(subscription),
    method: "POST",
  });
}

export function updateObservationDigest(teamId, subscriptionId, subscription) {
  return observationRequest(`/team/${teamId}/observation-digests/${subscriptionId}`, {
    body: JSON.stringify(subscription),
    method: "PUT",
  });
}

export function deleteObservationDigest(teamId, subscriptionId) {
  return observationRequest(`/team/${teamId}/observation-digests/${subscriptionId}`, {
    method: "DELETE",
  });
}

export function sendTestObservationDigest(teamId, subscriptionId) {
  return observationRequest(
    `/team/${teamId}/observation-digests/${subscriptionId}/send-test`,
    {
      body: JSON.stringify({}),
      method: "POST",
    },
  );
}
