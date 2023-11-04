import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCHING_DATA_REQUEST = "FETCHING_DATA_REQUEST";
export const FETCH_DATA_REQUEST_SUCCESS = "FETCH_DATA_REQUEST_SUCCESS";
export const FETCH_DATA_REQUEST_FAIL = "FETCH_DATA_REQUEST_FAIL";
export const FETCH_CHART_DATA_REQUESTS = "FETCH_CHART_DATA_REQUESTS";
export const FETCH_DATASET_REQUESTS = "FETCH_DATASET_REQUESTS";
export const DATA_REQUEST_DELETED = "DATA_REQUEST_DELETED";

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
      .then((dataRequests) => {
        dispatch({ type: FETCH_DATASET_REQUESTS, dataRequests });
        return Promise.resolve(dataRequests);
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

export function deleteDataRequest(projectId, chartId, drId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest/${drId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_DATA_REQUEST });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Could not delete the Data Request"));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((dataRequest) => {
        dispatch({ type: DATA_REQUEST_DELETED, id: drId });
        return dataRequest;
      })
      .catch((err) => {
        dispatch({ type: FETCH_DATA_REQUEST_FAIL });
        return Promise.reject(err);
      });
  };
}

export function runDataRequest(projectId, chartId, drId, getCache) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    let url = `${API_HOST}/project/${projectId}/chart/${chartId}/dataRequest/${drId}/request`;
    const method = "POST";
    const body = JSON.stringify({ getCache });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
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

    dispatch({ type: FETCHING_DATA_REQUEST, id: drId });
    return fetch(url, { method, body, headers })
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
      .then((data) => {
        if (!ok) {
          return Promise.reject({ ...status, message: data });
        }

        dispatch({
          type: FETCH_DATA_REQUEST_SUCCESS,
          dataRequest: data.dataRequest.dataRequest,
          response: data.dataRequest.responseData,
        });
        return Promise.resolve(data.dataRequest);
      })
      .catch((error) => {
        dispatch({ type: FETCH_DATA_REQUEST_FAIL, id: drId, error: error.message });
        return Promise.reject(error);
      });
  };
}
