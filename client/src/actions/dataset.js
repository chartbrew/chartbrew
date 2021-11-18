import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_DATASET = "FETCHING_DATASET";
export const FETCH_DATASET_SUCCESS = "FETCH_DATASET_SUCCESS";
export const FETCH_DATASET_FAIL = "FETCH_DATASET_FAIL";
export const FETCH_CHART_DATASETS = "FETCH_CHART_DATASETS";
export const REMOVE_DATASET = "REMOVE_DATASET";
export const FETCH_REQUESTED_DATA = "FETCH_REQUESTED_DATA";
export const CLEAR_DATASETS = "CLEAR_DATASETS";

export function getChartDatasets(projectId, chartId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataset`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_DATASET });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to fetch datasets");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((datasets) => {
        dispatch({ type: FETCH_CHART_DATASETS, datasets });
        return datasets;
      })
      .catch((error) => {
        return error;
      });
  };
}

export function saveNewDataset(projectId, chartId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataset`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_DATASET });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to fetch datasets");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataset) => {
        dispatch({ type: FETCH_DATASET_SUCCESS, dataset });
        return dataset;
      })
      .catch((error) => {
        return error;
      });
  };
}

export function updateDataset(projectId, chartId, datasetId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataset/${datasetId}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });
    dispatch({ type: FETCHING_DATASET });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to fetch datasets");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataset) => {
        dispatch({ type: FETCH_DATASET_SUCCESS, dataset });
        return dataset;
      })
      .catch((error) => {
        return error;
      });
  };
}

export function deleteDataset(projectId, chartId, datasetId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataset/${datasetId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_DATASET });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          addError(response.status, "Failed to delete the dataset");
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((result) => {
        dispatch({ type: REMOVE_DATASET, datasetId });
        return result;
      })
      .catch((error) => {
        return error;
      });
  };
}

export function runRequest(projectId, chartId, datasetId, getCache) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    let url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataset/${datasetId}/request`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    let status = {
      statusCode: 500,
      statusText: "Internal Server Error",
    };
    let ok = true;

    if (getCache) {
      url += "?getCache=true";
    }

    return fetch(url, { method, headers })
      .then((response) => {
        status = {
          statusCode: response.status,
          statusText: response.statusText,
        };

        if (!response.ok) {
          dispatch(addError(response.status, "Error while making the request"));
          ok = false;
          return response.text();
        }

        return response.json();
      })
      .then((result) => {
        if (!ok) {
          return Promise.reject({ ...status, message: result });
        }

        dispatch({ type: FETCH_REQUESTED_DATA, request: result, id: datasetId });
        return Promise.resolve({ ...result, status });
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  };
}

export function clearDatasets() {
  return (dispatch) => {
    dispatch({ type: CLEAR_DATASETS });
  };
}
