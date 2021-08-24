import cookies from "react-cookies";

import { API_HOST } from "../config/settings";

export const ADD_TEMPLATE = "ADD_TEMPLATE";
export const REMOVE_TEMPLATE = "REMOVE_TEMPLATE";
export const ADD_TEMPLATE_FAILED = "ADD_TEMPLATE_FAILED";
export const FETCH_TEMPLATES = "FETCH_TEMPLATES";
export const FETCHING_TEMPLATES = "FETCHING_TEMPLATES";

export function getTemplates(teamId) {
  return (dispatch) => {
    const token = cookies.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/template`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_TEMPLATES });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(response.status);
        }

        return response.json();
      })
      .then((templates) => {
        dispatch({ type: FETCH_TEMPLATES, templates });
        return templates;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function createTemplate(teamId, projectId, templateName) {
  return (dispatch) => {
    const token = cookies.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/template`;
    const method = "POST";
    const body = JSON.stringify({ project_id: projectId, name: templateName });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    dispatch({ type: FETCHING_TEMPLATES });
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((template) => {
        dispatch({ type: ADD_TEMPLATE, template });
        return template;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function deleteTemplate(teamId, templateId) {
  return (dispatch) => {
    const token = cookies.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/template/${templateId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((configuration) => {
        dispatch({ type: REMOVE_TEMPLATE, id: templateId });
        return configuration;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function getProjectTemplate(teamId, projectId) {
  const token = cookies.load("brewToken");
  const url = `${API_HOST}/team/${teamId}/template/generate/${projectId}`;
  const method = "GET";
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  return fetch(url, { method, headers })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.status);
      }

      return response.json();
    })
    .then((configuration) => {
      return configuration;
    })
    .catch((err) => {
      return new Promise((resolve, reject) => reject(err));
    });
}
