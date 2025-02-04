import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

const initialState = {
  loading: false,
  error: false,
  data: [],
};

export const getTeamConnections = createAsyncThunk(
  "connection/getTeamConnections",
  async ({ team_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections`;
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

export const getConnection = createAsyncThunk(
  "connection/getConnection",
  async ({ team_id, connection_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection_id}`;
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
    const response = await fetch(url, { headers, method: "GET" });
    const data = await response.json();
    return data;
  }
);

export const addConnection = createAsyncThunk(
  "connection/addConnection",
  async ({ team_id, connection }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections`;
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    const body = JSON.stringify(connection);
    const response = await fetch(url, { headers, method: "POST", body });
    const data = await response.json();
    return data;
  }
);

export const saveConnection = createAsyncThunk(
  "connection/saveConnection",
  async ({ team_id, connection }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection.id}`;
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    const body = JSON.stringify(connection);
    const response = await fetch(url, { headers, method: "PUT", body });
    const data = await response.json();
    return data;
  }
);

export const addFilesToConnection = createAsyncThunk(
  "connection/addFilesToConnection",
  async ({ team_id, connection_id, files }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection_id}/files`;
    const formData = new FormData();

    Object.keys(files).forEach((key) => {
      formData.append(key, files[key]);
    });

    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
    
    const response = await fetch(url, { headers, method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(response.status);
    }
    
    const data = await response.json();
    return data;
  }
);

export const testRequest = createAsyncThunk(
  "connection/testConnection",
  async ({ team_id, connection }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection.type}/test`;
    const body = JSON.stringify(connection);

    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });

    const response = await fetch(url, { headers, method: "POST", body });

    return response;
  }
);

export const testRequestWithFiles = createAsyncThunk(
  "connection/testConnectionWithFiles",
  async ({ team_id, connection, files }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection.type}/test/files`;
    const formData = new FormData();
    formData.append("connection", JSON.stringify(connection));
    if (files) {
      formData.append("sslCa", files.sslCa);
      formData.append("sslCert", files.sslCert);
      formData.append("sslKey", files.sslKey);
    }

    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });

    const response = await fetch(url, { headers, method: "POST", body: formData });

    return response;
  }
);

export const removeConnection = createAsyncThunk(
  "connection/removeConnection",
  async ({ team_id, connection_id, removeDatasets }) => {
    const token = getAuthToken();
    let url = `${API_HOST}/team/${team_id}/connections/${connection_id}`;
    if (removeDatasets) url += "?removeDatasets=true";
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    });
    const response = await fetch(url, { headers, method: "DELETE" });
    const data = await response.json();
    return data;
  }
);

export const runHelperMethod = createAsyncThunk(
  "connection/runHelperMethod",
  async ({ team_id, connection_id, methodName, params }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection_id}/helper/${methodName}`;
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    const body = params ? JSON.stringify(params) : null;
    const response = await fetch(url, { headers, method: "POST", body });
    const data = await response.json();
    return data;
  }
);

export const duplicateConnection = createAsyncThunk(
  "connection/duplicateConnection",
  async ({ team_id, connection_id, name }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/team/${team_id}/connections/${connection_id}/duplicate`;
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const body = JSON.stringify({ name });
    const response = await fetch(url, { headers, method: "POST", body });
    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();
    return data;
  }
);

export const connectionSlice = createSlice({
  name: "dataset",
  initialState,
  reducers: {
    clearConnections: (state) => {
      state.data = [];
    },
  },
  extraReducers: (builder) => {
    // getTeamConnections
    builder.addCase(getTeamConnections.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(getTeamConnections.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    })
    builder.addCase(getTeamConnections.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // getConnection
    builder.addCase(getConnection.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(getConnection.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.map((connection) => {
        if (connection.id === action.payload.id) {
          return action.payload;
        }
        return connection;
      });

      if (!state.data.find((connection) => connection.id === action.payload.id)) {
        state.data.push(action.payload);
      }
    })
    builder.addCase(getConnection.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // addConnection
    builder.addCase(addConnection.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(addConnection.fulfilled, (state, action) => {
      state.loading = false;
      state.data.push(action.payload);
    })
    builder.addCase(addConnection.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // saveConnection
    builder.addCase(saveConnection.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(saveConnection.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.map((connection) => {
        if (connection.id === action.payload.id) {
          return action.payload;
        }
        return connection;
      });
    })
    builder.addCase(saveConnection.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // testRequest
    builder.addCase(testRequest.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(testRequest.fulfilled, (state) => {
      state.loading = false;
    })
    builder.addCase(testRequest.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // testRequestWithFiles
    builder.addCase(testRequestWithFiles.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(testRequestWithFiles.fulfilled, (state) => {
      state.loading = false;
    })
    builder.addCase(testRequestWithFiles.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // removeConnection
    builder.addCase(removeConnection.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(removeConnection.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.filter((connection) => connection.id !== action.meta.arg.connection_id);
    })
    builder.addCase(removeConnection.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // runHelperMethod
    builder.addCase(runHelperMethod.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(runHelperMethod.fulfilled, (state) => {
      state.loading = false;
    })
    builder.addCase(runHelperMethod.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // duplicateConnection
    builder.addCase(duplicateConnection.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(duplicateConnection.fulfilled, (state, action) => {
      state.loading = false;
      state.data = [action.payload, ...state.data];
    })
    builder.addCase(duplicateConnection.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });
  },
});

export const { clearConnections } = connectionSlice.actions;

export const selectConnections = (state) => state.connection.data;

export default connectionSlice.reducer;
