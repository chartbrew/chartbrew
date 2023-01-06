import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_INTEGRATION = "FETCHING_INTEGRATION";
export const FETCH_INTEGRATION_SUCCESS = "FETCH_INTEGRATION_SUCCESS";
export const FETCH_INTEGRATION_FAIL = "FETCH_INTEGRATION_FAIL";
export const FETCH_CHART_INTEGRATIONS = "FETCH_CHART_INTEGRATIONS";
export const REMOVE_INTEGRATION = "REMOVE_INTEGRATION";
export const CLEAR_INTEGRATIONS = "CLEAR_INTEGRATIONS";

export function createIntegration(teamId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/integration`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_INTEGRATION });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to create integration");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((integration) => {
        dispatch({ type: FETCH_INTEGRATION_SUCCESS, integration });
        return integration;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function getTeamIntegrations(teamId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/integration`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART_INTEGRATIONS });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to fetch integrations");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((integrations) => {
        dispatch({ type: FETCH_CHART_INTEGRATIONS, integrations });
        return integrations;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function updateIntegration(teamId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/integration/${data.id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_INTEGRATION });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to update integration");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((integration) => {
        dispatch({ type: FETCH_INTEGRATION_SUCCESS, integration });
        return integration;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function deleteIntegration(teamId, integrationId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/integration/${integrationId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: REMOVE_INTEGRATION });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to delete integration");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((integration) => {
        dispatch({ type: REMOVE_INTEGRATION, integrationId });
        return integration;
      })
      .catch((error) => {
        Promise.reject(error);
      });
  };
}

export function clearIntegrations() {
  return (dispatch) => {
    dispatch({ type: CLEAR_INTEGRATIONS });
  };
}
