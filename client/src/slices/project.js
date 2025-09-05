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

export const takeSnapshot = createAsyncThunk(
  "project/takeSnapshot",
  async ({ project_id, options }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/snapshot`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    
    const body = JSON.stringify(options);

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
  async ({ brewName, password, token, queryParams }, thunkAPI) => {
    let authToken;
    try {
      authToken = getAuthToken();
    } catch (err) {
      // no token
    }

    let url = `${API_HOST}/project/dashboard/${brewName}`;
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${authToken}`,
    });

    // Build query parameters
    const urlParams = new URLSearchParams();
    
    if (password) {
      urlParams.append("pass", password);
    }

    if (token) {
      urlParams.append("token", token);
    }

    // Add all other query parameters (variables, theme, etc.)
    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        if (key !== "pass" && key !== "token") {
          urlParams.append(key, queryParams[key]);
        }
      });
    }

    if (urlParams.toString()) {
      url += `?${urlParams.toString()}`;
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

export const getReport = createAsyncThunk(
  "project/getReport",
  async ({ brewName, password, token, queryParams }, thunkAPI) => {
    const authToken = getAuthToken();
    let url = `${API_HOST}/project/${brewName}/report`;
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${authToken}`,
    });

    // Add token and queryParams to the URL as query parameters, not headers
    const urlParams = new URLSearchParams();

    if (token) {
      urlParams.append("token", token);
    }

    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        if (key !== "token") {
          urlParams.append(key, queryParams[key]);
        }
      });
    }

    if (urlParams.toString()) {
      url += `?${urlParams.toString()}`;
    }

    if (password) {
      headers.append("pass", password);
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

export const createDashboardFilter = createAsyncThunk(
  "project/createDashboardFilter",
  async ({ project_id, configuration, onReport, dashboard_filter_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/dashboard-filter`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });
    const data = { configuration, onReport };
    if (dashboard_filter_id) {
      data.id = dashboard_filter_id;
    }
    const body = JSON.stringify(data);

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const dashboardFilter = await response.json();
    return dashboardFilter;
  }
);

export const updateDashboardFilter = createAsyncThunk(
  "project/updateDashboardFilter",
  async ({ project_id, dashboard_filter_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/dashboard-filter/${dashboard_filter_id}`;
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

    const dashboardFilter = await response.json();
    return dashboardFilter;
  }
);

export const deleteDashboardFilter = createAsyncThunk(
  "project/deleteDashboardFilter",
  async ({ project_id, dashboard_filter_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/dashboard-filter/${dashboard_filter_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return response.json();
  }
);

export const createSharePolicy = createAsyncThunk(
  "project/createSharePolicy",
  async ({ project_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/share/policy`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const sharePolicy = await response.json();
    return sharePolicy;
  }
);

export const generateShareToken = createAsyncThunk(
  "project/generateShareToken",
  async ({ project_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/share/token`;
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

    const result = await response.json();
    return result;
  }
);

export const getSharePolicies = createAsyncThunk(
  "project/getSharePolicies",
  async ({ project_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/share/policy`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return response.json();
  }
);

export const updateSharePolicy = createAsyncThunk(
  "project/updateSharePolicy",
  async ({ project_id, policy_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/share/policy/${policy_id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return response.json();
  }
);

export const deleteSharePolicy = createAsyncThunk(
  "project/deleteSharePolicy",
  async ({ project_id, policy_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/share/policy/${policy_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return { policy_id, ...response.json() };
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

    // createDashboardFilter
    builder.addCase(createDashboardFilter.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(createDashboardFilter.fulfilled, (state, action) => {
      state.loading = false;
      if (state.active?.DashboardFilters) {
        state.active.DashboardFilters.push(action.payload);
      } else {
        state.active.DashboardFilters = [action.payload];
      }

      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          if (project.DashboardFilters) {
            project.DashboardFilters.push(action.payload);
          } else {
            project.DashboardFilters = [action.payload];
          }
        }
        return project;
      });
    })
    builder.addCase(createDashboardFilter.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // updateDashboardFilter
    builder.addCase(updateDashboardFilter.pending, (state) => {
      state.loading = true;
    })
    builder.addCase(updateDashboardFilter.fulfilled, (state, action) => {
      state.loading = false;
      state.active.DashboardFilters = state.active.DashboardFilters?.map((dashboardFilter) => {
        if (dashboardFilter.id === action.payload.id) {
          return action.payload;
        }
        return dashboardFilter;
      });
      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.DashboardFilters = project.DashboardFilters?.map((dashboardFilter) => {
            return dashboardFilter.id === action.payload.id ? action.payload : dashboardFilter;
          });
        }
        return project;
      });
    })
    builder.addCase(updateDashboardFilter.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // deleteDashboardFilter
    builder.addCase(deleteDashboardFilter.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(deleteDashboardFilter.fulfilled, (state, action) => {
      state.loading = false;
      state.active.DashboardFilters = state.active.DashboardFilters?.filter((dashboardFilter) => {
        return dashboardFilter.id !== action.meta.arg.dashboard_filter_id;
      });
      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.DashboardFilters = project.DashboardFilters?.filter((dashboardFilter) => {
            return dashboardFilter.id !== action.meta.arg.dashboard_filter_id;
          });
        }
        return project;
      });
    });
    builder.addCase(deleteDashboardFilter.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // createSharePolicy
    builder.addCase(createSharePolicy.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(createSharePolicy.fulfilled, (state, action) => {
      state.loading = false;
      if (state.active) {
        state.active.SharePolicies = [...(state.active?.SharePolicies || []), action.payload];
      }

      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.SharePolicies = [...(project?.SharePolicies || []), action.payload];
        }
        return project;
      });
    });
    builder.addCase(createSharePolicy.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // generateShareToken
    builder.addCase(generateShareToken.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(generateShareToken.fulfilled, (state) => {
      state.loading = false;
      // Token generation doesn't modify state, just returns the token
    });
    builder.addCase(generateShareToken.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // getSharePolicies
    builder.addCase(getSharePolicies.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSharePolicies.fulfilled, (state, action) => {
      state.loading = false;
      if (state.active) {
        state.active.SharePolicies = action.payload;
      }

      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.SharePolicies = action.payload;
        }
        return project;
      });
    });
    builder.addCase(getSharePolicies.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // updateSharePolicy
    builder.addCase(updateSharePolicy.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(updateSharePolicy.fulfilled, (state, action) => {
      state.loading = false;
      if (state.active) {
        state.active.SharePolicies = state.active.SharePolicies?.map((policy) => 
          policy.id === action.payload.id ? action.payload : policy
        ) || [];
      }

      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.SharePolicies = project.SharePolicies?.map((policy) => 
            policy.id === action.payload.id ? action.payload : policy
          ) || [];
        }
        return project;
      });
    });
    builder.addCase(updateSharePolicy.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // deleteSharePolicy
    builder.addCase(deleteSharePolicy.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(deleteSharePolicy.fulfilled, (state, action) => {
      state.loading = false;
      if (state.active) {
        state.active.SharePolicies = state.active.SharePolicies?.filter((policy) => 
          policy.id !== action.payload.policy_id
        ) || [];
      }

      state.data = state.data.map((project) => {
        if (project.id === action.meta.arg.project_id) {
          project.SharePolicies = project.SharePolicies?.filter((policy) => 
            policy.id !== action.payload.policy_id
          ) || [];
        }
        return project;
      });
    });
    builder.addCase(deleteSharePolicy.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });
  },
});

export const { changeActiveProject } = projectSlice.actions;
export const selectProjects = (state) => state.project.data;
export const selectProject = (state) => state.project.active || {};

export default projectSlice.reducer;
