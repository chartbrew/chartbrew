import cookie from "react-cookies";
import { API_HOST } from "../config/settings";

export function getApiRequestByChart(projectId, chartId) {
  return () => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/apiRequest`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((apiRequest) => {
        return new Promise(resolve => resolve(apiRequest));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export const TEMP = "TEMP";
