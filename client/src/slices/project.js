import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";
import { setCharts } from "./chart";

const initialState = {
  loading: false,
  error: false,
  active: {},
  data: [],
};

export const getProjects = createAsyncThunk(
  "project/getProjects",
  async ({ team_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/team/${team_id}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const projects = await response.json();
    return projects;
  }
);

export const getProject = createAsyncThunk(
  "project/getProject",
  async ({ project_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const project = await response.json();

    return project;
  }
);

export const createProject = createAsyncThunk(
  "project/createProject",
  async ({ data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const body = JSON.stringify(data);

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const project = await response.json();
    return project;
  }
);

export const updateProject = createAsyncThunk(
  "project/updateProject",
  async ({ project_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}`;
    const method = "PUT";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const body = JSON.stringify(data);

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const project = await response.json();
    return project;
  }
);

export const updateProjectLogo = createAsyncThunk(
  "project/updateProjectLogo",
  async ({ project_id, logo }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/logo`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const formData = new FormData();
    formData.append("file", logo[0]);
    const body = formData;

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const project = await response.json();
    return project;
  }
);

export const removeProject = createAsyncThunk(
  "project/removeProject",
  async ({ project_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const project = await response.json();
    return project;
  }
);

export const getPublicDashboard = createAsyncThunk(
  "project/getPublicDashboard",
  async ({ brewName, password }, thunkAPI) => {
    let token;
    try {
      token = getAuthToken();
    } catch (err) {
      // no token
    }

    let url = `${API_HOST}/project/dashboard/${brewName}`;
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    if (password) {
      url += `?pass=${password}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(response.status);
    }

    const project = await response.json();

    if (project.Charts) {
      thunkAPI.dispatch(setCharts(project.Charts));
    }

    return project;
  }
);

export const generateDashboard = createAsyncThunk(
  "project/generateDashboard",
  async ({ project_id, data, template }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/template/${template}`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const body = JSON.stringify(data);

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const project = await response.json();
    return project;
  }
);

export const createVariable = createAsyncThunk(
  "project/createVariable",
  async ({ project_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/variables`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const body = JSON.stringify(data);

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const variable = await response.json();
    return variable;
  }
);

export const deleteVariable = createAsyncThunk(
  "project/deleteVariable",
  async ({ project_id, variable_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/variables/${variable_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const variable = await response.json();
    return variable;
  }
);

export const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    changeActiveProject: (state, action) => {
      const foundProject = state.data.find((project) => {
        return project.id === parseInt(action.payload, 10);
      });

      if (foundProject) {
        state.active = foundProject;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getProjects.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(getProjects.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    })
    builder.addCase(getProjects.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // getProject
    builder.addCase(getProject.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(getProject.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.map((project) => {
        if (project.id === action.payload.id) {
          if (action.meta.arg.active) {
            state.active = action.payload;
          }

          return action.payload;
        }
        return project;
      });

      if (state.data.length === 0) {
        state.data.push(action.payload);
      }

      if (state.active.id === action.payload.id || !state.active.id) {
        state.active = action.payload;
      }
    })
    builder.addCase(getProject.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // createProject
    builder.addCase(createProject.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(createProject.fulfilled, (state, action) => {
      state.loading = false;
      state.data.push(action.payload);
    })
    builder.addCase(createProject.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // updateProject
    builder.addCase(updateProject.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(updateProject.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.map((project) => {
        if (project.id === action.payload.id) {
          return action.payload;
        }
        return project;
      });

      if (state.active.id === action.payload.id) {
        state.active = action.payload;
      }
    })
    builder.addCase(updateProject.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // updateProjectLogo
    builder.addCase(updateProjectLogo.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(updateProjectLogo.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.map((project) => {
        if (project.id === action.payload.id) {
          return action.payload;
        }
        return project;
      });
    })
    builder.addCase(updateProjectLogo.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // removeProject
    builder.addCase(removeProject.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(removeProject.fulfilled, (state, action) => {
      state.loading = false;
      state.data = state.data.filter((project) => {
        return project.id !== action.meta.arg.project_id;
      });
    })
    builder.addCase(removeProject.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // createVariable
    builder.addCase(createVariable.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(createVariable.fulfilled, (state, action) => {
      state.loading = false;
      state.active.Variables.push(action.payload);
      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.Variables.push(action.payload);
        }
        return project;
      });
    })
    builder.addCase(createVariable.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // deleteVariable
    builder.addCase(deleteVariable.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(deleteVariable.fulfilled, (state, action) => {
      state.loading = false;
      state.active.Variables = state.active.Variables.filter((variable) => {
        return variable.id !== action.meta.arg.variable_id;
      });
      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.Variables = project.Variables.filter((variable) => {
            return variable.id !== action.meta.arg.variable_id;
          });
        }
        return project;
      });
    });
    builder.addCase(deleteVariable.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });
  },
});

export const { changeActiveProject } = projectSlice.actions;

export const selectProjects = (state) => state.project.data;
export const selectProject = (state) => state.project.active || {};

export default projectSlice.reducer;
