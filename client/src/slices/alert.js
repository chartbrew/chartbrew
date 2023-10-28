import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

const initialState = {
  loading: false,
  error: false,
  data: [],
  requests: [],
};

export const createAlert = createAsyncThunk(
  "alert/createAlert",
  async ({ project_id, chart_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/alert`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, body, headers });
    if (!response.ok) {
      throw new Error(response.status);
    }

    return response.json();
  }
);

export const getChartAlerts = createAsyncThunk(
  "alert/getChartAlerts",
  async ({ project_id, chart_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/alert`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.status);
    }

    return response.json();
  }
);

export const updateAlert = createAsyncThunk(
  "alert/updateAlert",
  async ({ project_id, chart_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/alert/${data.id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, body, headers });
    if (!response.ok) {
      throw new Error(response.status);
    }

    return response.json();
  }
);

export const deleteAlert = createAsyncThunk(
  "alert/deleteAlert",
  async ({ project_id, chart_id, alert_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/alert/${alert_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.status);
    }

    return response.json();
  }
);

export const alertSlice = createSlice({
  name: "alert",
  initialState,
  reducers: {
    clearAlerts: (state) => {
      state.data = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // createAlert
      .addCase(createAlert.pending, (state) => {
        state.loading = true;
      })
      .addCase(createAlert.fulfilled, (state, action) => {
        state.loading = false;
        state.data.push(action.payload);
      })
      .addCase(createAlert.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // getChartAlerts
      .addCase(getChartAlerts.pending, (state) => {
        state.loading = true;
      })
      .addCase(getChartAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getChartAlerts.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // updateAlert
      .addCase(updateAlert.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateAlert.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((alert) => {
          if (alert.id === action.payload.id) {
            return action.payload;
          }
          return alert;
        });
      })
      .addCase(updateAlert.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // deleteAlert
      .addCase(deleteAlert.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteAlert.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.filter((alert) => {
          return alert.id !== action.meta.arg.alert_id;
        });
      })
      .addCase(deleteAlert.rejected, (state) => {
        state.loading = false;
        state.error = true;
      });
  },
});

export const { clearAlerts } = alertSlice.actions;
export const selectAlerts = (state) => state.alert.data;

export default alertSlice.reducer;
