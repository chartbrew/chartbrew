import cookie from "react-cookies";
import { API_HOST } from "../config/settings";
import { removeTeamInvite, saveTeamInvites } from "./user";
import { addError } from "./error";
import { FETCHING_ALL_PROJECTS } from "./project";

export const SAVE_ACTIVE_TEAM = "SAVE_ACTIVE_TEAM";
export const ADD_TEAM = "ADD_TEAM";
export const SAVE_TEAM_LIST = "SAVE_TEAM_LIST";
export const CREATING_TEAM_SUCCESS = "CREATING_TEAM_SUCCESS";
export const CREATING_TEAM_FAILED = "CREATING_TEAM_FAILED";
export const SAVE_TEAM_MEMBERS = "SAVE_TEAM_MEMBERS";
export const UPDATE_TEAM_MEMBER_ROLE = "UPDATE_TEAM_MEMBER_ROLE";

export function saveActiveTeam(activeTeam) {
  return {
    type: SAVE_ACTIVE_TEAM,
    activeTeam,
  };
}

export function saveTeamList(teamList) {
  return {
    type: SAVE_TEAM_LIST,
    teamList,
  };
}

export function addNewTeam(addTeam) {
  return {
    type: ADD_TEAM,
    addTeam,
  };
}

export function getTeams(userId) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return "No Token";
    }
    const token = cookie.load("brewToken");
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    };
    return fetch(`${API_HOST}/team/user/${userId}`, { method: "GET", headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }

        return response.json();
      })
      .then(teams => {
        dispatch(saveTeamList(teams));
        return new Promise(resolve => resolve(teams));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function getTeam(teamId) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    };
    return fetch(`${API_HOST}/team/${teamId}`, { method: "GET", headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(team => {
        dispatch(saveActiveTeam(team));
        if (team.Projects) {
          dispatch({
            type: FETCHING_ALL_PROJECTS,
            projects: team.Projects,
          });
        }
        return new Promise(resolve => resolve(team));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function createTeam(userId, name) {
  return (dispatch) => {
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };
    const body = JSON.stringify({
      "user_id": userId,
      "name": name
    });
    return fetch(`${API_HOST}/team`, { method: "POST", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(team => {
        dispatch({ type: CREATING_TEAM_SUCCESS, team });
        dispatch(addNewTeam(team));
        return new Promise(resolve => resolve(team));
      })
      .catch(err => {
        dispatch({ type: CREATING_TEAM_FAILED, err });
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function updateTeam(teamId, data) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/team/${teamId}`;
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
      .then((team) => {
        dispatch(saveActiveTeam(team));
        return new Promise(resolve => resolve(team));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function generateInviteUrl(teamId, projects, canExport) {
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
    const body = JSON.stringify({
      projects,
      canExport,
    });
    return fetch(`${API_HOST}/team/${teamId}/invite`, { method: "POST", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then((invite) => {
        return invite.url;
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function inviteMembers(email, teamId, projects, canExport) {
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
    const body = JSON.stringify({
      email,
      projects,
      canExport,
    });
    return fetch(`${API_HOST}/team/${teamId}/invite`, { method: "POST", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(invite => {
        return new Promise(resolve => resolve(invite));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function addTeamMember(userId, inviteToken) {
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
    const body = JSON.stringify({
      "token": inviteToken,
    });
    return fetch(`${API_HOST}/team/user/${userId}`, { method: "POST", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then((data) => {
        dispatch(removeTeamInvite(inviteToken));
        dispatch(addNewTeam(data));
        return new Promise(resolve => resolve(data));
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function getTeamMembers(teamId) {
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
    return fetch(`${API_HOST}/team/${teamId}/members`, { method: "GET", headers })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(saveMembers => {
        dispatch({ type: SAVE_TEAM_MEMBERS, saveMembers });
        return new Promise(resolve => resolve(saveMembers));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function updateTeamRole(data, memberId, teamId) {
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

    const updateData = data;
    updateData.user_id = memberId;
    const body = JSON.stringify(updateData);

    return fetch(`${API_HOST}/team/${teamId}/role`, { method: "PUT", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(updatedRole => {
        dispatch({ type: UPDATE_TEAM_MEMBER_ROLE, updatedRole });
        return new Promise(resolve => resolve(updatedRole));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function deleteTeamMember(memberId, teamId) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const url = `${API_HOST}/team/${teamId}/member/${memberId}`;
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
      .then(() => {
        return new Promise(resolve => resolve(true));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  };
}

export function declineTeamInvite(teamId, inviteToken) {
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
    const body = JSON.stringify({
      "token": inviteToken,
    });
    return fetch(`${API_HOST}/team/${teamId}/declineInvite/user`, { method: "POST", headers, body })
      .then((response) => {
        if (!response.ok) {
          dispatch(addError(response.status));
          return new Promise((resolve, reject) => reject(response.statusText));
        }
        return response.json();
      })
      .then(data => {
        // remove pending invite from store
        dispatch(removeTeamInvite(inviteToken));
        return new Promise(resolve => resolve(data));
      })
      .catch(err => {
        return new Promise((resolve, reject) => reject(err));
      });
  };
}

export function getUserByTeamInvite(token) {
  return (dispatch) => {
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    return fetch(`${API_HOST}/team/invite/${token}`, { method: "GET", headers })
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

export function getTeamInvites(teamId) {
  return (dispatch) => {
    if (!cookie.load("brewToken")) {
      return new Promise((resolve, reject) => reject(new Error("No Token")));
    }
    const token = cookie.load("brewToken");
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    };
    return fetch(`${API_HOST}/team/pendingInvites/${teamId}`, { method: "GET", headers })
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

export function resendTeamInvite(invite) {
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
    const body = JSON.stringify({
      "invite": invite,
    });
    return fetch(`${API_HOST}/team/resendInvite`, { method: "POST", body, headers })
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

export function getApiKeys(teamId) {
  if (!cookie.load("brewToken")) {
    return new Promise((resolve, reject) => reject(new Error("No Token")));
  }
  const token = cookie.load("brewToken");
  const headers = new Headers({
    "Accept": "application/json",
    "authorization": `Bearer ${token}`,
  });
  return fetch(`${API_HOST}/team/${teamId}/apikey`, { method: "GET", headers })
    .then((response) => {
      if (!response.ok) {
        return new Promise((resolve, reject) => reject(response.statusText));
      }
      return response.json();
    })
    .then((keys) => {
      return new Promise(resolve => resolve(keys));
    })
    .catch(err => {
      return new Promise((resolve, reject) => reject(err));
    });
}

export function createApiKey(teamId, keyName) {
  if (!cookie.load("brewToken")) {
    return new Promise((resolve, reject) => reject(new Error("No Token")));
  }
  const token = cookie.load("brewToken");
  const headers = new Headers({
    "Accept": "application/json",
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
  });
  const body = JSON.stringify({ name: keyName });
  return fetch(`${API_HOST}/team/${teamId}/apikey`, { method: "POST", body, headers })
    .then((response) => {
      if (!response.ok) {
        return new Promise((resolve, reject) => reject(response.statusText));
      }
      return response.json();
    })
    .then((keys) => {
      return new Promise((resolve) => resolve(keys));
    })
    .catch(err => {
      return new Promise((resolve, reject) => reject(err));
    });
}

export function deleteApiKey(teamId, keyId) {
  if (!cookie.load("brewToken")) {
    return new Promise((resolve, reject) => reject(new Error("No Token")));
  }
  const token = cookie.load("brewToken");
  const headers = new Headers({
    "Accept": "application/json",
    "authorization": `Bearer ${token}`,
  });
  return fetch(`${API_HOST}/team/${teamId}/apikey/${keyId}`, { method: "DELETE", headers })
    .then((response) => {
      if (!response.ok) {
        return new Promise((resolve, reject) => reject(response.statusText));
      }
      return response.json();
    })
    .then((keys) => {
      return new Promise(resolve => resolve(keys));
    })
    .catch(err => {
      return new Promise((resolve, reject) => reject(err));
    });
}
