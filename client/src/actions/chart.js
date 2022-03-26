import cookie from "react-cookies";
import moment from "moment";

import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const FETCH_CHART = "FETCH_CHART";
export const FETCH_ALL_CHARTS = "FETCH_ALL_CHARTS";
export const FETCH_CHART_SUCCESS = "FETCH_CHART_SUCCESS";
export const FETCH_CHART_FAIL = "FETCH_CHART_FAIL";
export const UPDATE_CHART_FIELDS = "UPDATE_CHART_FIELDS";

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

export function updateChart(projectId, chartId, data, justUpdates) {
  return (dispatch) => {
    const formattedData = data;

    if (data && data.startDate && data.endDate) {
      formattedData.startDate = moment(data.startDate).endOf("day").format();
      formattedData.endDate = moment(data.endDate).endOf("day").format();
    }

    const token = cookie.load("brewToken");
    let url = `${API_HOST}/project/${projectId}/chart/${chartId}`;
    const method = "PUT";
    const body = JSON.stringify(formattedData);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    if (justUpdates) url += "?justUpdates=true";

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
        if (justUpdates) {
          dispatch({ type: UPDATE_CHART_FIELDS, chart });
        } else {
          dispatch({ type: FETCH_CHART_SUCCESS, chart });
        }
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

export function runQuery(projectId, chartId, noSource = false, skipParsing = false, getCache) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    let url = `${API_HOST}/project/${projectId}/chart/${chartId}?no_source=${noSource}&skip_parsing=${skipParsing}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    if (getCache) {
      url += "&getCache=true";
    }

    dispatch({ type: FETCH_CHART, chartId });
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
        return chart;
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL, chartId });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function runQueryWithFilters(projectId, chartId, filters) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/filter?no_source=true`;
    const method = "POST";
    const body = JSON.stringify({ filters });
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
    });

    dispatch({ type: FETCH_CHART });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((chart) => {
        dispatch({ type: FETCH_CHART_SUCCESS, chart });
        return chart;
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL, chartId });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function getPreviewData(projectId, chart, noSource = false, skipParsing = false) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/preview?no_source=${noSource}&skip_parsing=${skipParsing}`;
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

export function exportChart(projectId, chartIds, filters) {
  const token = cookie.load("brewToken");
  const url = `${API_HOST}/project/${projectId}/chart/export`;
  const method = "POST";
  const body = JSON.stringify({ chartIds, filters });
  const headers = new Headers({
    "Content-Type": "application/json",
    "authorization": `Bearer ${token}`,
  });

  return fetch(url, { method, body, headers })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.status);
      }

      return response.blob();
    })
    .then((file) => {
      const url = window.URL.createObjectURL(new Blob([file])); // eslint-disable-line
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "chartbrew-export.xlsx");

      // 3. Append to html page
      document.body.appendChild(link);
      // 4. Force download
      link.click();
      // 5. Clean up and remove the link
      link.parentNode.removeChild(link);

      return file;
    })
    .catch((err) => {
      return err;
    });
}

export function createShareString(projectId, chartId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/chart/${chartId}/share`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
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
        dispatch({ type: FETCH_CHART_SUCCESS, chart });
        return new Promise(resolve => resolve(chart));
      })
      .catch((error) => {
        dispatch({ type: FETCH_CHART_FAIL });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}
