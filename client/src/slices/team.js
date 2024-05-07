import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { API_HOST } from "../config/settings";
import { getAuthToken } from "../modules/auth";
import { cloneDeep } from "lodash";
import { createSelector } from "@reduxjs/toolkit";

const initialState = {
  loading: false,
  error: false,
  isTeamOwner: false,
  data: [],
  active: {},
  newTeam: {},
  teamMembers: [],
};

export const getTeams = createAsyncThunk(
  "team/getTeams",
  async (userId) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    
    const response = await fetch(`${API_HOST}/team/user/${userId}`, { method: "GET", headers });
    const data = await response.json();

    return data;
  }
);

export const getTeam = createAsyncThunk(
  "team/getTeam",
  async (teamId) => {
    const token = getAuthToken();
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    };
    const response = await fetch(`${API_HOST}/team/${teamId}`, { method: "GET", headers });
    const data = await response.json();

    return data;
  }
);

export const updateTeam = createAsyncThunk(
  "team/updateTeam",
  async ({ team_id, data }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const response = await fetch(`${API_HOST}/team/${team_id}`, { method: "PUT", headers, body: JSON.stringify(data) });
    const jsonData = await response.json();

    return jsonData;
  }
);

export const generateInviteUrl = createAsyncThunk(
  "team/generateInviteUrl",
  async ({ team_id, projects, canExport, role }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const body = JSON.stringify({
      projects,
      canExport,
      role
    });
    
    const response = await fetch(`${API_HOST}/team/${team_id}/invite`, { method: "POST", headers, body });
    const data = await response.json();

    if (!data.url) {
      throw new Error("Error generating invite url");
    }

    return data.url;
  }
);

export const inviteMembers = createAsyncThunk(
  "team/inviteMembers",
  async ({ team_id, email, projects, canExport }) => {
    const token = getAuthToken();
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
    
    const response = await fetch(`${API_HOST}/team/${team_id}/invite`, { method: "POST", headers, body });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const addTeamMember = createAsyncThunk(
  "team/addTeamMember",
  async({ userId, inviteToken }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const body = JSON.stringify({
      "token": inviteToken,
    });

    const response = await fetch(`${API_HOST}/team/user/${userId}`, { method: "POST", headers, body });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const getTeamMembers = createAsyncThunk(
  "team/getTeamMembers",
  async ({ team_id }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(`${API_HOST}/team/${team_id}/members`, { method: "GET", headers });
    if (!response.ok) {
      throw new Error("Error getting team members");
    }

    const responseJson = await response.json();

    return responseJson;
  }
);

export const updateTeamRole = createAsyncThunk(
  "team/updateTeamRole",
  async ({ team_id, memberId, data }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const updateData = data;
    updateData.user_id = memberId;
    const body = JSON.stringify(updateData);

    const response = await fetch(`${API_HOST}/team/${team_id}/role`, { method: "PUT", headers, body });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const deleteTeamMember = createAsyncThunk(
  "team/deleteTeamMember",
  async ({ team_id, memberId }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/member/${memberId}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const getApiKeys = createAsyncThunk(
  "team/getApiKeys",
  async ({ team_id }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(`${API_HOST}/team/${team_id}/apikey`, { method: "GET", headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const createApiKey = createAsyncThunk(
  "team/createApiKey",
  async ({ team_id, keyName }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const body = JSON.stringify({ name: keyName });

    const response = await fetch(`${API_HOST}/team/${team_id}/apikey`, { method: "POST", body, headers })
    const responseJson = await response.json();

    return responseJson;
  }
);

export const deleteApiKey = createAsyncThunk(
  "team/deleteApiKey",
  async ({ team_id, keyId }) => {
    const token = getAuthToken();
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });
    
    const response = await fetch(`${API_HOST}/team/${team_id}/apikey/${keyId}`, { method: "DELETE", headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const teamSlice = createSlice({
  name: "team",
  initialState,
  reducers: {
    saveActiveTeam(state, action) {
      state.active = action.payload;
    },
    addNewTeam(state, action) {
      state.data.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // GET TEAMS
      .addCase(getTeams.pending, (state) => {
        state.loading = true;
      })
      .addCase(getTeams.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getTeams.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })
      // GET TEAM
      .addCase(getTeam.pending, (state) => {
        state.loading = true;
      })
      .addCase(getTeam.fulfilled, (state, action) => {
        state.loading = false;
        state.active = action.payload;
      })
      .addCase(getTeam.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })
      // UPDATE TEAM
      .addCase(updateTeam.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateTeam.fulfilled, (state, action) => {
        state.loading = false;
        state.active = action.payload;
        state.data = state.data.map((team) => {
          if (team.id === action.payload.id) {
            return action.payload;
          }
          return team;
        });
      })
      .addCase(updateTeam.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // ADD TEAM MEMBER
      .addCase(addTeamMember.pending, (state) => {
        state.loading = true;
      })
      .addCase(addTeamMember.fulfilled, (state, action) => {
        state.loading = false;
        state.active = action.payload;
        state.data = state.data.map((team) => {
          if (team.id === action.payload.id) {
            return action.payload;
          }
          return team;
        });
      })
      .addCase(addTeamMember.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // GET TEAM MEMBERS
      .addCase(getTeamMembers.pending, (state) => {
        state.loading = true;
      })
      .addCase(getTeamMembers.fulfilled, (state, action) => {
        state.loading = false;
        state.teamMembers = action.payload;
      })
      .addCase(getTeamMembers.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // UPDATE TEAM ROLE
      .addCase(updateTeamRole.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateTeamRole.fulfilled, (state, action) => {
        state.loading = false;
        state.teamMembers = state.teamMembers.map((member) => {
          let updatedMember = cloneDeep(member);
          updatedMember.TeamRoles = updatedMember.TeamRoles.map((tr) => {
            if (tr.id === action.payload.id) {
              return action.payload;
            }
            return tr;
          });
          return updatedMember;
        });
      })
      .addCase(updateTeamRole.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // DELETE TEAM MEMBER
      .addCase(deleteTeamMember.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteTeamMember.fulfilled, (state, action) => {
        state.loading = false;
        state.teamMembers = state.teamMembers.filter((member) => member.id !== action.payload.id);
      })
      .addCase(deleteTeamMember.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })
  },
});

export const { saveActiveTeam, saveTeamList, addNewTeam } = teamSlice.actions;
export const selectTeam = (state) => state.team.active;
export const selectTeams = (state) => state.team.data;
export const selectTeamMembers = (state) => state.team.teamMembers;
export const selectProjectMembers = createSelector(
  (state) => state.team.teamMembers,
  (_, projectId) => projectId,
  (teamMembers, projectId) => {
    if (!teamMembers || teamMembers.length === 0) return [];
    const projectMembers = teamMembers.filter((tm) => {
      return tm.TeamRoles.find((tr) => tr?.projects?.length > 0 && tr.projects.includes(parseInt(projectId, 10)) && tr.role !== "teamOwner" && tr.role !== "teamAdmin");
    });

    return projectMembers;
  }
);

export default teamSlice.reducer;
