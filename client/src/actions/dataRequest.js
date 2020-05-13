import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export function getDataRequestByChart(projectId, chartId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Data request failed"));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((dataRequest) => {
        return new Promise(resolve => resolve(dataRequest));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function getDataRequestByDataset(projectId, chartId, datasetId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest/dataset/${datasetId}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Cannot fetch the dataRequests"));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataRequest) => {
        return Promise.resolve(dataRequest);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  };
}

export function createDataRequest(projectId, chartId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest`;
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
          dispatch(addError(response.status, "Could not create a data request"));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataRequest) => {
        return Promise.resolve(dataRequest);
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  };
}
