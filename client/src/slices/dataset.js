import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

const initialState = {
  loading: false,
  error: false,
  data: [],
  responses: [],
};

export const getDatasets = createAsyncThunk(
  "dataset/getDatasets",
  async ({ team_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/datasets`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const getDataset = createAsyncThunk(
  "dataset/getDataset",
  async ({ team_id, dataset_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/datasets/${dataset_id}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const saveNewDataset = createAsyncThunk(
  "dataset/saveNewDataset",
  async ({ team_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/datasets`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, body, headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const updateDataset = createAsyncThunk(
  "dataset/updateDataset",
  async ({ team_id, dataset_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/datasets/${dataset_id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, body, headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const deleteDataset = createAsyncThunk(
  "dataset/deleteDataset",
  async ({ team_id, dataset_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/datasets/${dataset_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    return responseJson;
  }
);

export const runRequest = createAsyncThunk(
  "dataset/runRequest",
  async ({ team_id, dataset_id, getCache }) => {
    const token = getAuthToken();
    let url = `${API_HOST}/team/${team_id}/datasets/${dataset_id}/request`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    });

    if (getCache) {
      url += "?getCache=true";
    }

    let status = {
      statusCode: 500,
      statusText: "Internal Server Error",
    };

    let data;
    try {
      const response = await fetch(url, { method, headers });
      status = {
        statusCode: response.status,
        statusText: response.statusText,
      };
      
      if (!response.ok) {
        data = await response.text();
      } else {
        data = await response.json();
      }
    } catch (error) {
      data = error;
    }

    return {
      ...data,
      status,
    };
  }
);


export const datasetSlice = createSlice({
  name: "dataset",
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
    builder
      // getDatasets
      .addCase(getDatasets.pending, (state) => {
        state.loading = true;
      })
      .addCase(getDatasets.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getDatasets.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // getDataset
      .addCase(getDataset.pending, (state) => {
        state.loading = true;
      })
      .addCase(getDataset.fulfilled, (state, action) => {
        state.loading = false;
        if (state.data.find((dataset) => dataset.id === action.payload.id)) {
          state.data = state.data.map((dataset) =>
            dataset.id === action.payload.id ? action.payload : dataset
          );
        }
        else {
          state.data.push(action.payload);
        }
      })
      .addCase(getDataset.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // saveNewDataset
      .addCase(saveNewDataset.pending, (state) => {
        state.loading = true;
      })
      .addCase(saveNewDataset.fulfilled, (state, action) => {
        state.loading = false;
        if (state.data.find((dataset) => dataset.id === action.payload.id)) {
          state.data = state.data.map((dataset) =>
            dataset.id === action.payload.id ? action.payload : dataset
          );
        }
        else {
          state.data.push(action.payload);
        }
      })
      .addCase(saveNewDataset.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // updateDataset
      .addCase(updateDataset.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateDataset.fulfilled, (state, action) => {
        state.loading = false;
        if (state.data.find((dataset) => dataset.id === action.payload.id)) {
          state.data = state.data.map((dataset) =>
            dataset.id === action.payload.id ? action.payload : dataset
          );
        }
        else {
          state.data.push(action.payload);
        }
      })
      .addCase(updateDataset.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // deleteDataset
      .addCase(deleteDataset.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteDataset.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.filter((dataset) => dataset.id !== action.payload.id);
      })
      .addCase(deleteDataset.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })

      // runRequest
      .addCase(runRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(runRequest.fulfilled, (state, action) => {
        const datasetId = parseInt(action.payload.id, 10);
        const indexReq = state.responses.findIndex(
          (response) => response.dataset_id === datasetId
        );

        if (indexReq > -1) {
          state.responses[indexReq] = {
            data: action.payload.response,
            dataset_id: datasetId,
          };
        } else {
          state.responses.push({
            data: action.payload.response,
            dataset_id: datasetId,
          });
        }

        state.loading = false;
      })
      .addCase(runRequest.rejected, (state) => {
        state.loading = false;
        state.error = true;
      })
  },
});

export const selectDatasets = (state) => state.dataset.data.filter((d) => d.team_id === state.team.active?.id);
export default datasetSlice.reducer;
