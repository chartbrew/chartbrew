import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_DATASET = "FETCHING_DATASET";
export const FETCH_DATASET_SUCCESS = "FETCH_DATASET_SUCCESS";
export const FETCH_DATASET_FAIL = "FETCH_DATASET_FAIL";
export const FETCH_CHART_DATASETS = "FETCH_CHART_DATASETS";

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
