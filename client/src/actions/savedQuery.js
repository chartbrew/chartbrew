import cookie from "react-cookies";

import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_QUERY = "FETCHING_QUERY";
export const FETCH_QUERY_FAIL = "FETCH_QUERY_FAIL";
export const FETCH_ALL_QUERIES = "FETCH_ALL_QUERIES";
export const FETCH_QUERY_SUCCESS = "FETCH_QUERY_SUCCESS";

export function getSavedQueries(projectId, type) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/savedQuery?type=${type}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((savedQueries) => {
        dispatch({ type: FETCH_ALL_QUERIES, savedQueries });
        return new Promise(resolve => resolve(savedQueries));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function createSavedQuery(projectId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/savedQuery`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((savedQuery) => {
        dispatch({ type: FETCH_QUERY_SUCCESS, savedQuery });
        return new Promise((resolve) => resolve(savedQuery));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function updateSavedQuery(projectId, savedQueryId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/savedQuery/${savedQueryId}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((savedQuery) => {
        dispatch({ type: FETCH_QUERY_SUCCESS, savedQuery });
        return new Promise((resolve) => resolve(savedQuery));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function deleteSavedQuery(projectId, savedQueryId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/savedQuery/${savedQueryId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((message) => {
        dispatch(getSavedQueries(projectId));
        return new Promise((resolve) => resolve(message));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}
