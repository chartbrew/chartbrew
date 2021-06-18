import cookies from "react-cookies";

import { API_HOST } from "../../../config/settings";

export function getAccountDetails(projectId, connectionId) {
  const token = cookies.load("brewToken");
  const url = `${API_HOST}/project/${projectId}/connection/${connectionId}/test`;
  const method = "GET";
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  return fetch(url, { method, headers })
    .then((response) => {
      if (!response.ok) return Promise.reject(response.status);

      return response.json();
    })
    .then((data) => {
      return data;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

export function getMetadata(projectId, connectionId) {
  const token = cookies.load("brewToken");
  const url = `${API_HOST}/project/${projectId}/connection/${connectionId}/google/ga/metadata`;
  const method = "GET";
  const headers = new Headers({
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  });

  return fetch(url, { method, headers })
    .then((response) => {
      if (!response.ok) return Promise.reject(response.status);

      return response.json();
    })
    .then((data) => {
      return data;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}
