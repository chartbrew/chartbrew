import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";

const saves = new Map();

export async function chartRequest(projectId, chartId, suffix = "", method = "GET", data) {
  const options = {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${getAuthToken()}`,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  };
  const url = `${API_HOST}/project/${projectId}/chart/${chartId}${suffix}`;
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    try {
      response = await fetch(url, options);
    } catch {
      throw new Error("Cannot connect to Chartbrew. Check your connection and try again.");
    }
  }
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) throw Object.assign(new Error("Your session expired. Sign in again."), { status: 401 });
  if (!response.ok) throw Object.assign(new Error(result.message || "The chart could not be saved. Try again."), { status: response.status });
  return result;
}

export function saveChartChange(args, thunkApi, suffix, method, data = {}) {
  const id = Number(args.chart_id);
  const chart = thunkApi.getState().chart.data.find((item) => item.id === id);
  const previous = saves.get(id);
  const pending = (previous || Promise.resolve({ configurationVersion: chart?.configurationVersion }))
    .then(async ({ configurationVersion }) => {
      const result = await chartRequest(args.project_id, id, suffix, method, {
        ...data, expectedVersion: configurationVersion, operationId: thunkApi.requestId,
      });
      thunkApi.dispatch({ type: "chart/updateLocalChart", payload: { id, data: { configurationVersion: result.configurationVersion } } });
      return result;
    });
  saves.set(id, pending);
  const clear = () => { if (saves.get(id) === pending) saves.delete(id); };
  pending.then(clear, clear);
  return pending;
}
