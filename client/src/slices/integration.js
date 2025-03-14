import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

const initialState = {
  loading: false,
  error: false,
  data: [],
};

export const getTeamIntegrations = createAsyncThunk(
  "integration/getTeamIntegrations",
  async ({ team_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/integration`;
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
    const response = await fetch(url, { headers, method: "GET" });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const data = await response.json();
    return data;
  }
);

export const createIntegration = createAsyncThunk(
  "integration/createIntegration",
  async ({ data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${data?.team_id}/integration`;
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    const body = JSON.stringify(data);
    const response = await fetch(url, { headers, method: "POST", body });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const responseData = await response.json();
    return responseData;
  }
);

export const updateIntegration = createAsyncThunk(
  "integration/updateIntegration",
  async ({ team_id, integration_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/integration/${integration_id}`;
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    const body = JSON.stringify(data);
    const response = await fetch(url, { headers, method: "PUT", body });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const responseData = await response.json();
    return responseData;
  }
);

export const deleteIntegration = createAsyncThunk(
  "integration/deleteIntegration",
  async ({ team_id, integration_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/integration/${integration_id}`;
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
    const response = await fetch(url, { headers, method: "DELETE" });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const data = await response.json();
    return { id: integration_id, data };
  }
);

export const integrationSlice = createSlice({
  name: "integration",
  initialState,
  reducers: {
    clearIntegrations: (state) => {
      state.data = [];
    },
  },
  extraReducers: (builder) => {
    // getTeamIntegrations
    builder.addCase(getTeamIntegrations.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(getTeamIntegrations.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    })
    builder.addCase(getTeamIntegrations.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // createIntegration
    builder.addCase(createIntegration.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(createIntegration.fulfilled, (state, action) => {
      state.loading = false;
      state.data.push(action.payload);
    })
    builder.addCase(createIntegration.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // updateIntegration
    builder.addCase(updateIntegration.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(updateIntegration.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.map((integration) => {
        if (integration.id === action.payload.id) {
          return action.payload;
        }
        return integration;
      });
    })
    builder.addCase(updateIntegration.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // deleteIntegration
    builder.addCase(deleteIntegration.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(deleteIntegration.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.filter((integration) => integration.id !== action.payload.id);
    })
    builder.addCase(deleteIntegration.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })
  },
});

export const { clearIntegrations } = integrationSlice.actions;

export const selectIntegrations = (state) => state.integration.data;

export default integrationSlice.reducer;
