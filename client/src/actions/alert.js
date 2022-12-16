import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_ALERT = "FETCHING_ALERT";
export const FETCH_ALERT_SUCCESS = "FETCH_ALERT_SUCCESS";
export const FETCH_ALERT_FAIL = "FETCH_ALERT_FAIL";
export const FETCH_CHART_ALERTS = "FETCH_CHART_ALERTS";
export const REMOVE_ALERT = "REMOVE_ALERT";
export const CLEAR_ALERTS = "CLEAR_ALERTS";

export function createAlert(projectId, chartId, alert) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/alert`;
    const method = "POST";
    const body = JSON.stringify(alert);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_ALERT });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to create alert");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((alert) => {
        dispatch({ type: FETCH_ALERT_SUCCESS, alert });
        return alert;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function getChartAlerts(projectId, chartId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/alert`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART_ALERTS });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to fetch alerts");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((alerts) => {
        dispatch({ type: FETCH_CHART_ALERTS, alerts });
        return alerts;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function updateAlert(projectId, chartId, alert) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/alert/${alert.id}`;
    const method = "PUT";
    const body = JSON.stringify(alert);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_ALERT });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to update alert");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((alert) => {
        dispatch({ type: FETCH_ALERT_SUCCESS, alert });
        return alert;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function deleteAlert(projectId, chartId, alertId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/alert/${alertId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: REMOVE_ALERT });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to delete alert");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((alert) => {
        dispatch({ type: REMOVE_ALERT, alertId });
        return alert;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function clearAlerts() {
  return (dispatch) => {
    dispatch({ type: CLEAR_ALERTS });
  };
}
