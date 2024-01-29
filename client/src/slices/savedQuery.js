import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

export const getSavedQueries = createAsyncThunk(
  "savedQuery/getSavedQueries",
  async ({ team_id, type }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/savedQuery?type=${type}`;
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

export const createSavedQuery = createAsyncThunk(
  "savedQuery/createSavedQuery",
  async ({ team_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/savedQuery`;
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

export const updateSavedQuery = createAsyncThunk(
  "savedQuery/updateSavedQuery",
  async ({ team_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/savedQuery/${data.id}`;
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

export const deleteSavedQuery = createAsyncThunk(
  "savedQuery/deleteSavedQuery",
  async ({ team_id, id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/savedQuery/${id}`;
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

const initialState = {
  loading: false,
  error: false,
  data: [],
};

export const savedQuerySlice = createSlice({
  name: "savedQuery",
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder
      // getSavedQueries
      .addCase(getSavedQueries.pending, (state) => {
        state.loading = true;
      })
      .addCase(getSavedQueries.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getSavedQueries.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // createSavedQuery
      .addCase(createSavedQuery.pending, (state) => {
        state.loading = true;
      })
      .addCase(createSavedQuery.fulfilled, (state, action) => {
        state.loading = false;
        state.data.push(action.payload);
      })
      .addCase(createSavedQuery.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // updateSavedQuery
      .addCase(updateSavedQuery.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateSavedQuery.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((savedQuery) => {
          if (savedQuery.id === action.payload.id) {
            return action.payload;
          }
          return savedQuery;
        });
      })
      .addCase(updateSavedQuery.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // deleteSavedQuery
      .addCase(deleteSavedQuery.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteSavedQuery.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.filter((savedQuery) => {
          return savedQuery.id !== action.meta.arg.id;
        });
      })
      .addCase(deleteSavedQuery.rejected, (state) => {
        state.loading = false;
        state.error = true;
      });
  },
});

export const selectSavedQueries = (state) => state.savedQuery.data;

export default savedQuerySlice.reducer;
