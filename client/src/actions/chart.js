import cookie from "react-cookies";

import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCH_CHART = "FETCH_CHART";
export const FETCH_ALL_CHARTS = "FETCH_ALL_CHARTS";
export const FETCH_CHART_SUCCESS = "FETCH_CHART_SUCCESS";
export const FETCH_CHART_FAIL = "FETCH_CHART_FAIL";

export function getProjectCharts(projectId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((charts) => {
        dispatch({ type: FETCH_ALL_CHARTS, charts });
        return new Promise(resolve => resolve(charts));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function createChart(projectId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((chart) => {
        dispatch({ type: FETCH_CHART_SUCCESS, chart });
        return new Promise(resolve => resolve(chart));
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function updateChart(projectId, chartId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((chart) => {
        dispatch({ type: FETCH_CHART_SUCCESS, chart });
        return new Promise(resolve => resolve(chart));
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function changeOrder(projectId, chartId, otherId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/order`;
    const method = "PUT";
    const body = JSON.stringify({ otherId });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((chart) => {
        dispatch(getProjectCharts(projectId));
        return new Promise(resolve => resolve(chart));
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function removeChart(projectId, chartId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((chart) => {
        // dispatch({ type: FETCH_CHART_SUCCESS, chart });
        dispatch(getProjectCharts(projectId));
        return new Promise(resolve => resolve(chart));
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function runQuery(projectId, chartId, noSource) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    let url = `${API_HOST}/project/${projectId}/chart/${chartId}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    if (noSource) {
      url += "?no_source=true";
    }

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((chart) => {
        dispatch({ type: FETCH_CHART_SUCCESS, chart });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function getPreviewData(projectId, chart, noSource = false) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/preview?no_source=${noSource}`;
    const method = "POST";
    const body = JSON.stringify(chart);
    const headers = new Headers({
      "Accept": "application/json",
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((chartData) => {
        return new Promise(resolve => resolve(chartData));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function testQuery(projectId, data) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/test`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.status));
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

export function getEmbeddedChart(id) {
  return (dispatch) => {
    const url = `${API_HOST}/chart/${id}/embedded`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return Promise.reject(response.status);
        }

        return response.json();
      })
      .then((chart) => {
        return Promise.resolve(chart);
      });
  };
}
