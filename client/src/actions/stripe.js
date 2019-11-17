import cookie from "react-cookies";

import { API_HOST } from "../config/settings";
import { addError } from "./error";

export function addSource(tokenId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/source`;
    const method = "POST";
    const body = JSON.stringify({ source: tokenId });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.statusText);
        }

        return response.json();
      })
      .then((source) => {
        return new Promise(resolve => resolve(source));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function subscribeToPlan(plan) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/subscription`;
    const method = "POST";
    const body = JSON.stringify({ plan: plan.toLowerCase() });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.statusText);
        }

        return response.json();
      })
      .then((source) => {
        return new Promise(resolve => resolve(source));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function updateSubscription(plan) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/subscription`;
    const method = "PUT";
    const body = JSON.stringify({ plan: plan.toLowerCase() });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          if (response.status === 406) {
            return response.json();
          }

          throw new Error(response.status);
        }

        return response.json();
      })
      .then((sub) => {
        if (sub.cbEntity) {
          return new Promise((resolve, reject) => reject(sub.cbEntity));
        }
        return new Promise(resolve => resolve(sub));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function removeSubscription() {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/subscription`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          if (response.status === 406) {
            return response.json();
          }

          throw new Error(response.status);
        }

        return response.json();
      })
      .then((sub) => {
        if (sub.cbEntity) {
          return new Promise((resolve, reject) => reject(sub.cbEntity));
        }

        return new Promise(resolve => resolve(sub));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function getCustomer() {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/customer`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }

        return response.json();
      })
      .then((customer) => {
        return new Promise(resolve => resolve(customer));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function setDefaultSource(cardId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/source/default`;
    const method = "PUT";
    const body = JSON.stringify({ cardId });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.statusText);
        }

        return response.json();
      })
      .then((customer) => {
        return new Promise(resolve => resolve(customer));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function removeSource(cardId) {
  return (dispatch) => {
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/stripe/source`;
    const method = "DELETE";
    const body = JSON.stringify({ cardId });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.statusText);
        }

        return response.json();
      })
      .then((customer) => {
        return new Promise(resolve => resolve(customer));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}
