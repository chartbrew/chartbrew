import { API_HOST } from "../../config/settings";
import { getAuthToken } from "../../modules/auth";

export async function reportAppearanceRequest(path, method = "GET", data) {
  const response = await fetch(`${API_HOST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", authorization: `Bearer ${getAuthToken()}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.message || "The theme could not be saved. Try again."), { status: response.status });
  }
  return result;
}
