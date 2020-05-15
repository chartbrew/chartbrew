import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_DATA_REQUEST = "FETCHING_DATA_REQUEST";
export const FETCH_DATA_REQUEST_SUCCESS = "FETCH_DATA_REQUEST_SUCCESS";
export const FETCH_DATA_REQUEST_FAIL = "FETCH_DATA_REQUEST_FAIL";
export const FETCH_CHART_DATA_REQUESTS = "FETCH_CHART_DATA_REQUESTS";

export function getDataRequestByChart(projectId, chartId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_DATA_REQUEST });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Data request failed"));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((dataRequests) => {
        dispatch({ type: FETCH_CHART_DATA_REQUESTS, dataRequests });
        return new Promise(resolve => resolve(dataRequests));
      })
      .catch((error) => {
        dispatch({ type: FETCH_DATA_REQUEST_FAIL });
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

    dispatch({ type: FETCHING_DATA_REQUEST });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Cannot fetch the dataRequests"));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataRequest) => {
        dispatch({ type: FETCH_DATA_REQUEST_SUCCESS, dataRequest });
        return Promise.resolve(dataRequest);
      })
      .catch((error) => {
        dispatch({ type: FETCH_DATA_REQUEST_FAIL });
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

    dispatch({ type: FETCHING_DATA_REQUEST });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Could not create a data request"));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataRequest) => {
        dispatch({ type: FETCH_DATA_REQUEST_SUCCESS, dataRequest });
        return Promise.resolve(dataRequest);
      })
      .catch((err) => {
        dispatch({ type: FETCH_DATA_REQUEST_FAIL });
        return Promise.reject(err);
      });
  };
}

export function updateDataRequest(projectId, chartId, drId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest/${drId}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_DATA_REQUEST });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Could not update the Data Request"));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataRequest) => {
        dispatch({ type: FETCH_DATA_REQUEST_SUCCESS, dataRequest });
        return Promise.resolve(dataRequest);
      })
      .catch((err) => {
        dispatch({ type: FETCH_DATA_REQUEST_FAIL });
        return Promise.reject(err);
      });
  };
}
