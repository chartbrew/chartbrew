import { API_HOST } from "../config/settings";

function checkForUpdates() {
  const url = `${API_HOST}/update`;
  const method = "GET";
  const headers = new Headers({
    "Accept": "application/json",
  });

  return fetch(url, { method, headers })
    .then((response) => {
      if (!response.ok) return Promise.reject(response.statusCode);

      return response.json();
    })
    .then((data) => {
      return data;
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

export default checkForUpdates;
