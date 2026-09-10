import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

export async function mcpOAuthRequest(path, options = {}) {
  const response = await fetch(`${API_HOST}/oauth/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok)
    throw Object.assign(new Error("The request could not be completed."), {
      status: response.status,
    });
  return response.json();
}

export const MCP_PERMISSIONS = {
  "data:read": "Read data",
  "data:refresh": "Refresh data",
  "charts:preview": "Create chart previews",
  "datasets:write": "Create datasets",
};
