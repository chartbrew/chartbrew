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

function normalizeObservationDigest(subscription) {
  if (!subscription || Array.isArray(subscription.deliveryDays)) return subscription;
  if (typeof subscription.deliveryDays !== "string") {
    return { ...subscription, deliveryDays: null };
  }
  try {
    const deliveryDays = JSON.parse(subscription.deliveryDays);
    return {
      ...subscription,
      deliveryDays: Array.isArray(deliveryDays) ? deliveryDays : null,
    };
  } catch (error) {
    return { ...subscription, deliveryDays: null };
  }
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

export function removeObservationFeedback(teamId, observationId) {
  return observationRequest(`/team/${teamId}/observations/${observationId}/feedback`, {
    method: "DELETE",
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

export function getMonitorRecommendations(teamId) {
  return observationRequest(`/team/${teamId}/monitor-recommendations`);
}

export function acceptMonitorRecommendation(teamId, recommendationId, monitor) {
  return observationRequest(
    `/team/${teamId}/monitor-recommendations/${recommendationId}/accept`,
    {
      body: JSON.stringify(monitor),
      method: "POST",
    }
  );
}

export function dismissMonitorRecommendation(teamId, recommendationId, type) {
  return observationRequest(
    `/team/${teamId}/monitor-recommendations/${recommendationId}/dismiss`,
    {
      body: JSON.stringify({ type }),
      method: "POST",
    }
  );
}

export function getMonitorRecommendationDismissals(teamId) {
  return observationRequest(`/team/${teamId}/monitor-recommendation-dismissals`);
}

export function restoreMonitorRecommendation(teamId, dismissalId) {
  return observationRequest(
    `/team/${teamId}/monitor-recommendation-dismissals/${dismissalId}`,
    { method: "DELETE" }
  );
}

export function getMonitorOptions(teamId, chartId) {
  return observationRequest(`/team/${teamId}/charts/${chartId}/monitor-options`);
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

export async function getObservationDigests(teamId) {
  const subscriptions = await observationRequest(`/team/${teamId}/observation-digests`);
  return subscriptions.map(normalizeObservationDigest);
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

export async function createObservationDigest(teamId, subscription) {
  const saved = await observationRequest(`/team/${teamId}/observation-digests`, {
    body: JSON.stringify(subscription),
    method: "POST",
  });
  return normalizeObservationDigest(saved);
}

export async function updateObservationDigest(teamId, subscriptionId, subscription) {
  const saved = await observationRequest(`/team/${teamId}/observation-digests/${subscriptionId}`, {
    body: JSON.stringify(subscription),
    method: "PUT",
  });
  return normalizeObservationDigest(saved);
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
