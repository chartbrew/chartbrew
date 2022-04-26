import cookie from "react-cookies";
import moment from "moment";

import { API_HOST } from "../config/settings";
import { addError } from "./error";

export const SAVE_USER = "SAVE_USER";
export const LOGOUT_USER = "LOGOUT_USER";
export const INITIALISING_USER = "INITIALISING_USER";
export const INITIALISING_USER_FAIL = "INITIALISING_USER_FAIL";
export const INITIALISING_USER_SUCCESS = "INITIALISING_USER_SUCCESS";
export const VERIFY_USER = "VERIFY_USER";
export const SAVE_PENDING_INVITES = "SAVE_PENDING_INVITES";
export const REMOVE_PENDING_INVITE = "REMOVE_PENDING_INVITE";

const expires = moment().add(1, "month").toDate();

function authenticatePage() {
  if (window.location.pathname === "/login") {
    return false;
  } else if (window.location.pathname === "/signup") {
    return false;
  } else if (window.location.pathname.indexOf("/b/") > -1) {
    return false;
  } else if (window.location.pathname === "/passwordReset") {
    return false;
  } else if (window.location.pathname === "/invite") {
    return false;
  } else if (window.location.pathname === "/feedback") {
    return false;
  } else if (window.location.pathname.indexOf("embedded") > -1) {
    return false;
  }

  window.location.pathname = "/login";
  return true;
}

function redirectToDashboard() {
  if (window.location.pathname === "/login" || window.location.pathname === "signup") {
    window.location.pathname = "/user";
    return true;
  }

  return false;
}

export function saveUser(user) {
  return {
    type: SAVE_USER,
    user,
  };
}

export function saveTeamInvites(invites) {
  return {
    type: SAVE_PENDING_INVITES,
    invites,
  };
}

export function removeTeamInvite(removeInvite) {
  return {
    type: REMOVE_PENDING_INVITE,
    removeInvite,
  };
}

export function createUser(data) {
  return (dispatch) => {
    const url = `${API_HOST}/user`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const method = "POST";

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then((user) => {
        // save the cookie here
        if (cookie.load("brewToken")) cookie.remove("brewToken", { path: "/" });
        cookie.save("brewToken", user.token, { expires, path: "/" });

        // dispatch({ type: INITIALISING_USER_SUCCESS, user });
        dispatch(saveUser(user));
        return new Promise(resolve => resolve(user));
      })
      .catch((error) => {
        dispatch({ type: INITIALISING_USER_FAIL, error });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function oneaccountAuth(user) {
  return (dispatch) => {
    // save the cookie here
    if (cookie.load("brewToken")) cookie.remove("brewToken", { path: "/" });
    cookie.save("brewToken", user.token, { expires, path: "/" });

    dispatch(saveUser(user));
    return new Promise(resolve => resolve(user));
  };
}

export function addEmailToList(email) {
  return (dispatch) => {
    const url = `${API_HOST}/user/email`;
    const body = JSON.stringify({ email });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const method = "POST";

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then((user) => {
        return new Promise(resolve => resolve(user));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function updateUser(id, data) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/user/${id}`;
    const method = "PUT";
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
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then((user) => {
        dispatch(saveUser(user));
        return new Promise(resolve => resolve(user));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function deleteUser(id) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/user/${id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then((user) => {
        cookie.remove("brewToken", { path: "/" });
        dispatch({ type: LOGOUT_USER });
        return new Promise(resolve => resolve(user));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function createInvitedUser(data) {
  return (dispatch) => {
    const url = `${API_HOST}/user/invited`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const method = "POST";

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then((user) => {
        if (cookie.load("brewToken")) cookie.remove("brewToken", { path: "/" });
        cookie.save("brewToken", user.token, { expires, path: "/" });
        dispatch(saveUser(user));
        return new Promise(resolve => resolve(user));
      })
      .catch((error) => {
        dispatch({ type: INITIALISING_USER_FAIL, error });
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function verify(id, token) {
  return (dispatch) => {
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    };
    return fetch(`${API_HOST}/user/${id}/verify`, { method: "GET", headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error("Could not verify email.");
        }

        return response.json();
      })
      .then(user => {
        // save the cookie here
        cookie.remove("brewToken", { path: "/" });
        cookie.save("brewToken", user.token, { expires, path: "/" });
        dispatch(saveUser(user));
        return new Promise(resolve => resolve(user));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function login(data) {
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
  });
  const body = JSON.stringify(data);
  return (dispatch) => {
    return fetch(`${API_HOST}/user/login`, { method: "POST", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Couldn't login"));
          throw new Error("Couldn't login");
        }
        return response.json();
      })
      .then(user => {
        // save the cookie here
        if (cookie.load("brewToken")) cookie.remove("brewToken", { path: "/" });
        cookie.save("brewToken", user.token, { expires, path: "/" });
        dispatch(saveUser(user));
        return new Promise(resolve => resolve(user));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err.message));
      });
  };
}

export function relog() {
  const token = cookie.load("brewToken");
  return (dispatch) => {
    if (!token) {
      if (authenticatePage()) {
        window.location.pathname = "/login";
      }
      return new Promise((resolve, reject) => reject("Token is missing"));
    }

    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const method = "POST";
    const url = `${API_HOST}/user/relog`;

    return fetch(url, { method, headers })
      .then(response => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject("Couldn't relog"));
        }
        return response.json();
      })
      .then(user => {
        redirectToDashboard();
        return new Promise(resolve => resolve(user));
      })
      .catch(() => {
        if (authenticatePage()) {
          window.location.pathname = "/login";
        }
        return new Promise((resolve, reject) => reject("Can't authenticate the user"));
      });
  };
}

export function getUser(id) {
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
  });
  return (dispatch) => {
    return fetch(`${API_HOST}/user/${id}`, { method: "GET", headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status, "Couldn't get requested user"));
          throw new Error("Couldn't get requested user");
        }
        return response.json();
      })
      .then(user => {
        dispatch(saveUser(user));
        return new Promise(resolve => resolve(user));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err.message));
      });
  };
}

export function getPendingInvites(id) {
  // get team invites for a specific user
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    return fetch(`${API_HOST}/user/${id}/teamInvites`, { method: "GET", headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(data => {
        dispatch(saveTeamInvites(data));
        return new Promise(resolve => resolve(data));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function logout() {
  return (dispatch) => {
    cookie.remove("brewToken", { path: "/" });
    window.location.pathname = "/";
    dispatch({ type: LOGOUT_USER });
  };
}

export function sendFeedback({ name, feedback, email }) {
  return (dispatch) => {
    const body = JSON.stringify({
      "from": name,
      "email": email,
      "data": feedback,
    });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    return fetch(`${API_HOST}/user/feedback`, { method: "POST", body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(data => {
        return new Promise(resolve => resolve(data));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function requestPasswordReset(email) {
  return (dispatch) => {
    const url = `${API_HOST}/user/password/reset`;
    const method = "POST";
    const body = JSON.stringify({ email });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          throw new Error(response.status);
        }
      })
      .then((result) => {
        return new Promise(resolve => resolve(result));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function changePasswordWithToken(data) {
  return (dispatch) => {
    const url = `${API_HOST}/user/password/change`;
    const method = "PUT";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const body = JSON.stringify(data);

    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.status));
        }

        return response.json();
      })
      .then((result) => {
        return new Promise(resolve => resolve(result));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function areThereAnyUsers() {
  const url = `${API_HOST}/app/users`;
  const method = "GET";
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
  });

  return fetch(url, { method, headers })
    .then((response) => {
      if (!response.ok) {
        return new Promise((resolve, reject) => reject(response.statusText));
      }

      return response.json();
    })
    .then((result) => {
      return result.areThereAnyUsers;
    })
    .catch((err) => {
      return err;
    });
}
