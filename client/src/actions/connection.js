import cookie from "react-cookies";

import { API_HOST } from "../config/settings";
import { getProject } from "./project";
import { addError } from "./error";

export const FETCHING_CONNECTION = "FETCHING_CONNECTION";
export const FETCH_CONNECTION_SUCCESS = "FETCH_CONNECTION_SUCCESS";
export const FETCH_ALL_CONNECTIONS = "FETCH_ALL_CONNECTIONS";
export const FETCH_CONNECTION_FAIL = "FETCH_CONNECTION_FAIL";

export function getProjectConnections(projectId) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_CONNECTION });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((connections) => {
        dispatch({ type: FETCH_ALL_CONNECTIONS, connections });
        return new Promise(resolve => resolve(connections));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function addConnection(projectId, connection) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection`;
    const method = "POST";
    const body = JSON.stringify(connection);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_CONNECTION });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((newConnection) => {
        dispatch({ type: FETCH_CONNECTION_SUCCESS, connection: newConnection });
        dispatch(getProject(newConnection.project_id, true));
        return new Promise(resolve => resolve(newConnection));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function saveConnection(projectId, connection) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection/${connection.id}`;
    const method = "PUT";
    const body = JSON.stringify(connection);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_CONNECTION });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((newConnection) => {
        dispatch({ type: FETCH_CONNECTION_SUCCESS, connection: newConnection });
        dispatch(getProject(newConnection.project_id, true));
        return new Promise(resolve => resolve(newConnection));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function testConnection(projectId, id) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection/${id}/test`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((test) => {
        return new Promise(resolve => resolve(test));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function testApiRequest(projectId, id, apiRequest) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection/${id}/apiTest`;
    const method = "POST";
    const body = JSON.stringify(apiRequest);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    let status = {
      statusCode: 500,
      statusText: "Internal Server Error",
    };

    return fetch(url, { method, body, headers })
      .then((response) => {
        status = {
          statusCode: response.status,
          statusText: response.statusText,
        };

        if (!response.ok) {
          dispatch(addError(status.statusCode, status.statusText));
          return new Promise((resolve, reject) => reject(status));
        }

        return response.json();
      })
      .then((test) => {
        const result = {};
        result.body = test;
        result.status = status;

        return new Promise(resolve => resolve(result));
      })
      .catch(() => {
        return new Promise((resolve, reject) => reject(status));
      });
  };
}

export function updateConnection(projectId, id, data) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection/${id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_CONNECTION });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((connection) => {
        dispatch({ type: FETCH_CONNECTION_SUCCESS, connection });
        return new Promise(resolve => resolve(connection));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function removeConnection(projectId, id) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/connection/${id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then(() => {
        return new Promise(resolve => resolve(true));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}
