import cookie from "react-cookies";

import { API_HOST } from "../config/settings";
import { FETCH_ALL_CHARTS } from "./chart";
import { addError } from "./error";

export const FETCHING_ALL_PROJECTS = "FETCHING_ALL_PROJECTS";
export const FETCHING_PROJECT = "FETCHING_PROJECT";
export const FETCHING_PROJECT_SUCCESS = "FETCHING_PROJECT_SUCCESS";
export const FETCHING_PROJECT_FAILED = "FETCHING_PROJECT_FAILED";
export const CHANGE_ACTIVE_PROJECT = "CHANGE_ACTIVE_PROJECT";

export function getAllProjects() {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/user`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_PROJECT });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((projects) => {
        dispatch({ type: FETCHING_ALL_PROJECTS, projects });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function getProject(id, active) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${id}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_PROJECT });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((project) => {
        dispatch({ type: FETCHING_PROJECT_SUCCESS, project });
        // switch this to the active project if it's requested
        if (active) {
          setTimeout(() => {
            dispatch(changeActiveProject(project.id));
            // also update the charts store
            dispatch({ type: FETCH_ALL_CHARTS, charts: project.Charts });
          }, 100);
        }
        return new Promise(resolve => resolve(project));
      })
      .catch((error) => {
        dispatch({ type: FETCHING_PROJECT_FAILED, error });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function createProject(data) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const method = "POST";

    dispatch({ type: FETCHING_PROJECT });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((project) => {
        dispatch({ type: FETCHING_PROJECT_SUCCESS, project });
        return new Promise(resolve => resolve(project));
      })
      .catch((error) => {
        dispatch({ type: FETCHING_PROJECT_FAILED, error });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function updateProject(projectId, data) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const method = "PUT";

    dispatch({ type: FETCHING_PROJECT });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((project) => {
        dispatch({ type: FETCHING_PROJECT_SUCCESS, project });
        return new Promise(resolve => resolve(project));
      })
      .catch((error) => {
        dispatch({ type: FETCHING_PROJECT_FAILED, error });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function updateProjectLogo(projectId, logo) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const form = new FormData();
    form.append("file", logo[0]);

    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}/logo`;
    const body = form;
    const headers = new Headers({
      // "Content-Type": "multipart/form-data; boundary=cb_uploads",
      "authorization": `Bearer ${token}`,
    });
    const method = "POST";

    dispatch({ type: FETCHING_PROJECT });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((project) => {
        dispatch({ type: FETCHING_PROJECT_SUCCESS, project });
        return new Promise(resolve => resolve(project));
      })
      .catch((error) => {
        dispatch({ type: FETCHING_PROJECT_FAILED, error });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function removeProject(projectId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/project/${projectId}`;
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const method = "DELETE";

    dispatch({ type: FETCHING_PROJECT });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then(() => {
        return dispatch(getAllProjects());
      })
      .then((projects) => {
        return new Promise(resolve => resolve(projects));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function getPublicDashboard(brewName, password) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    let url = `${API_HOST}/project/dashboard/${brewName}`;
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const method = "GET";

    if (password) url += `?pass=${password}`;

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((project) => {
        dispatch({ type: FETCH_ALL_CHARTS, charts: project.Charts });
        return new Promise(resolve => resolve(project));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function changeActiveProject(id) {
  return (dispatch) => {
    dispatch({ type: CHANGE_ACTIVE_PROJECT, id });
    return new Promise(resolve => resolve("Changed"));
  };
}

export function generateDashboard(projectId, data, template) {
  const token = cookie.load("brewToken");
  const url = `${API_HOST}/project/${projectId}/template/${template}`;
  const method = "POST";
  const body = JSON.stringify(data);
  const headers = new Headers({
    "Content-Type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${token}`
  });

  return fetch(url, { method, body, headers })
    .then((response) => {
      if (!response.ok) throw new Error(response.status);

      return response.json();
    })
    .then((result) => {
      return new Promise((resolve) => resolve(result));
    })
    .catch((err) => {
      return new Promise((resolve, reject) => reject(err));
    });
}
