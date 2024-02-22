import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

export const getTemplates = createAsyncThunk(
  "template/getTemplates",
  async (teamId) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${teamId}/template`;
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

export const createTemplate = createAsyncThunk(
  "template/createTemplate",
  async ({ team_id, project_id, name }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/template`;
    const method = "POST";
    const body = JSON.stringify({ project_id: project_id, name });
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

export const deleteTemplate = createAsyncThunk(
  "template/deleteTemplate",
  async ({ team_id, template_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/template/${template_id}`;
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

export const getProjectTemplate = createAsyncThunk(
  "template/getProjectTemplate",
  async ({ team_id, project_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/template/generate/${project_id}`;
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

const initialState = {
  loading: false,
  error: false,
  data: [],
  active: {},
};

export const templateSlice = createSlice({
  name: "template",
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder
      // getTemplates
      .addCase(getTemplates.pending, (state) => {
        state.loading = true;
        state.error = false;
      })
      .addCase(getTemplates.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getTemplates.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })
      // createTemplate
      .addCase(createTemplate.pending, (state) => {
        state.loading = true;
        state.error = false;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.loading = false;
        state.data.push(action.payload);
      })
      .addCase(createTemplate.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })
      
      // deleteTemplate
      .addCase(deleteTemplate.pending, (state) => {
        state.loading = true;
        state.error = false;
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.filter((template) => template.id !== action.meta.arg.template_id);
      })
  },
});

export const selectTemplates = (state) => state.template.data;

export default templateSlice.reducer;
