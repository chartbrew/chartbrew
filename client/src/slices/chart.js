import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getAuthToken } from "../modules/auth";
import { API_HOST } from "../config/settings";

const initialState = {
  loading: false,
  error: false,
  data: [],
};

export const getChart = createAsyncThunk(
  "chart/getChart",
  async ({ project_id, chart_id, password }) => {
    const token = getAuthToken();
    let url = `${API_HOST}/project/${project_id}/chart/${chart_id}`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    if (password || !token) {
      url = `${API_HOST}/chart/${chart_id}?password=${password}`;
    }

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (response.status >= 400) {
      throw new Error(data.message);
    }

    return data;
  }
);

export const getProjectCharts = createAsyncThunk(
  "chart/getProjectCharts",
  async ({ project_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (response.status >= 400) {
      throw new Error(data.message);
    }

    return data;
  }
);

export const createChart = createAsyncThunk(
  "chart/createChart",
  async ({ project_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const updateChart = createAsyncThunk(
  "chart/updateChart",
  async ({ project_id, chart_id, data, justUpdates }) => {
    const token = getAuthToken();
    let url = `${API_HOST}/project/${project_id}/chart/${chart_id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    if (justUpdates) url += "?justUpdates=true";

    const response = await fetch(url, { method, body, headers });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const changeOrder = createAsyncThunk(
  "chart/changeOrder",
  async ({ project_id, chart_id, otherId }, thunkApi) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/order`;
    const method = "PUT";
    const body = JSON.stringify({ otherId });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, body, headers });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    thunkApi.dispatch(getProjectCharts({ project_id }));

    return responseJson;
  }
);

export const removeChart = createAsyncThunk(
  "chart/removeChart",
  async ({ project_id, chart_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const runQuery = createAsyncThunk(
  "chart/runQuery",
  async ({ project_id, chart_id, noSource, skipParsing, getCache, filters, variables }) => {
    const token = getAuthToken();
    let url = `${API_HOST}/project/${project_id}/chart/${chart_id}/query?no_source=${noSource || false}&skip_parsing=${skipParsing || false}`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const body = JSON.stringify({
      filters: filters && isNaN(filters.length) ? [filters] : filters,
      variables: variables || [],
    });

    if (getCache) {
      url += "&getCache=true";
    }

    const response = await fetch(url, { method, headers, body });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const runQueryWithFilters = createAsyncThunk(
  "chart/runQueryWithFilters",
  async ({ project_id, chart_id, filters, variables }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/filter?no_source=true`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });
    const body = JSON.stringify({ filters, variables });

    const response = await fetch(url, { method, headers, body });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const runQueryOnPublic = createAsyncThunk(
  "chart/runQueryOnPublic",
  async ({ chart_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/chart/${chart_id}/query`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const getPreviewData = createAsyncThunk(
  "chart/getPreviewData",
  async ({ project_id, chart_id, noSource, skipParsing }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/preview?no_source=${noSource || false}&skip_parsing=${skipParsing || false}`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (response.status >= 400) {
      throw new Error(data.message);
    }

    return data;
  }
);

export const testQuery = createAsyncThunk(
  "chart/testQuery",
  async ({ project_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/test`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });
    const dataJson = await response.json();

    if (response.status >= 400) {
      throw new Error(dataJson.message);
    }

    return dataJson;
  }
);

export const getEmbeddedChart = createAsyncThunk(
  "chart/getEmbeddedChart",
  async ({ embed_id, snapshot, token, queryParams }) => {
    let url = `${API_HOST}/chart/${embed_id}/embedded`;
    
    const urlParams = new URLSearchParams();
    
    // Add specific parameters
    if (snapshot) urlParams.set("snapshot", "true");
    if (token) urlParams.set("token", token);
    
    // Add any additional query parameters (for variables)
    if (queryParams && typeof queryParams === "object") {
      Object.keys(queryParams).forEach((key) => {
        // Don't override snapshot and token if they were explicitly set
        if (!urlParams.has(key)) {
          urlParams.set(key, queryParams[key]);
        }
      });
    }
    
    const queryString = urlParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
    });

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (response.status >= 400) {
      throw new Error(data.message);
    }

    return data;
  }
);

export const getSharedChart = createAsyncThunk(
  "chart/getSharedChart",
  async ({ share_string, snapshot, token, queryParams }) => {
    let url = `${API_HOST}/chart/${share_string}/share`;

    const urlParams = new URLSearchParams();

    // Add specific parameters
    if (snapshot) urlParams.set("snapshot", "true");
    if (token) urlParams.set("token", token);

    // Add any additional query parameters (for variables)
    if (queryParams && typeof queryParams === "object") {
      Object.keys(queryParams).forEach((key) => {
        // Don't override snapshot and token if they were explicitly set
        if (!urlParams.has(key)) {
          urlParams.set(key, queryParams[key]);
        }
      });
    }

    const queryString = urlParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
    });

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (response.status >= 400) {
      throw new Error(data.message);
    }

    return data;
  }
);

export const exportChart = createAsyncThunk(
  "chart/exportChart",
  async ({ project_id, chartIds, filters }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/export`;
    const method = "POST";
    const body = JSON.stringify({ chartIds, filters });

    const headers = new Headers({
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });

    const file = await response.blob();

    const objUrl = window.URL.createObjectURL(new Blob([file]));
    const link = document.createElement("a");
    link.href = objUrl;
    link.setAttribute("download", "chartbrew-export.xlsx");

    // Append to html page
    document.body.appendChild(link);
    // Force download
    link.click();
    // Clean up and remove the link
    link.parentNode.removeChild(link);

    return file;
  }
);

export const exportChartPublic = createAsyncThunk(
  "chart/exportChartPublic",
  async ({ chart, password }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${chart.project_id}/chart/export/public/${chart.id}`;
    const method = "POST";
    const body = JSON.stringify({ password });
    const headers = new Headers({
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });
    
    const file = await response.blob();

    const objUrl = window.URL.createObjectURL(new Blob([file]));
    const link = document.createElement("a");
    link.href = objUrl;
    link.setAttribute("download", `${chart.name}-chartbrew.xlsx`);

    // Append to html page
    document.body.appendChild(link);
    // Force download
    link.click();
    // Clean up and remove the link
    link.parentNode.removeChild(link);

    return file;
  }
);

export const createShareString = createAsyncThunk(
  "chart/createShareString",
  async ({ project_id, chart_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/share`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const data = await response.json();

    if (response.status >= 400) {
      throw new Error(data.message);
    }

    return data;
  }
);

export const createCdc = createAsyncThunk(
  "chart/createCdc",
  async ({ project_id, chart_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/chart-dataset-config`;
    const method = "POST";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const createSharePolicy = createAsyncThunk(
  "chart/createSharePolicy",
  async ({ project_id, chart_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/share/policy`;
    const method = "POST";
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

export const getSharePolicies = createAsyncThunk(
  "chart/getSharePolicies",
  async ({ project_id, chart_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/share/policy`;
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
  "chart/updateSharePolicy",
  async ({ project_id, chart_id, policy_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/share/policy/${policy_id}`;
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
  "chart/deleteSharePolicy",
  async ({ project_id, chart_id, policy_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/share/policy/${policy_id}`;
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

export const updateCdc = createAsyncThunk(
  "chart/updateCdc",
  async ({ project_id, chart_id, cdc_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/chart-dataset-config/${cdc_id}`;
    const method = "PUT";
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers, body });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const removeCdc = createAsyncThunk(
  "chart/removeCdc",
  async ({ project_id, chart_id, cdc_id }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/chart-dataset-config/${cdc_id}`;
    const method = "DELETE";
    const headers = new Headers({
      "Accept": "application/json",
      "authorization": `Bearer ${token}`,
    });

    const response = await fetch(url, { method, headers });
    const responseJson = await response.json();

    if (response.status >= 400) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
);

export const generateShareToken = createAsyncThunk(
  "chart/generateShareToken",
  async ({ project_id, chart_id, data }) => {
    const token = getAuthToken();
    const url = `${API_HOST}/project/${project_id}/chart/${chart_id}/share/token`;
    const method = "POST";
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

export const chartSlice = createSlice({
  name: "chart",
  initialState,
  reducers: {
    setCharts: (state, action) => {
      state.data = action.payload;
    },
    stageChart: (state, action) => {
      state.data = [action.payload, ...state.data];
    },
    clearStagedCharts: (state) => {
      state.data = state.data.filter((chart) => !chart.staged);
    },
    updateLocalChart: (state, action) => {
      state.data = state.data.map((chart) => {
        if (chart.id === action.payload.id) {
          return {
            ...chart,
            ...action.payload.data,
          };
        }
        return chart;
      });
    },
    removeLocalChart: (state, action) => {
      state.data = state.data.filter((chart) => chart.id !== action.payload.id);
    },
    updateChartFilterMetadata: (state, action) => {
      const { chartId, filters, variables } = action.payload;
      state.data = state.data.map((chart) => {
        if (chart.id === chartId) {
          const filterHash = JSON.stringify({ filters: filters || [], variables: variables || {} });
          return {
            ...chart,
            filterMetadata: {
              appliedFilters: filters || [],
              appliedVariables: variables || {},
              lastFilterHash: filterHash,
              lastUpdated: Date.now(),
            },
          };
        }
        return chart;
      });
    },
    clearChartFilterMetadata: (state, action) => {
      const { chartId } = action.payload;
      state.data = state.data.map((chart) => {
        if (chart.id === chartId) {
          return {
            ...chart,
            filterMetadata: null,
          };
        }
        return chart;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // getChart
      .addCase(getChart.pending, (state, action) => {
        state.loading = true;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: true,
            };
          }
          return chart;
        });
      })
      .addCase(getChart.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.payload.id) {
            return {
              ...chart,
              ...action.payload,
              loading: false,
            };
          }
          return chart;
        });
      })
      .addCase(getChart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: false,
            };
          }
          return chart;
        });
      })

      // getProjectCharts
      .addCase(getProjectCharts.pending, (state) => {
        state.loading = true;
      })
      .addCase(getProjectCharts.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getProjectCharts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // createChart
      .addCase(createChart.pending, (state) => {
        state.loading = true;
      })
      .addCase(createChart.fulfilled, (state, action) => {
        state.loading = false;
        state.data.push(action.payload);
      })
      .addCase(createChart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // updateChart
      .addCase(updateChart.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateChart.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.payload.id) {
            return {
              ...chart,
              ...action.payload,
            };
          }
          return chart;
        });
      })
      .addCase(updateChart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // changeOrder
      .addCase(changeOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(changeOrder.fulfilled, (state) => {
        state.loading = false;
        // do nothing here because the charts need to be fetched again
        // revisit if noticable performance issues
      })
      .addCase(changeOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // removeChart
      .addCase(removeChart.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeChart.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.filter((chart) => chart.id !== action.meta.arg.chart_id);
      })
      .addCase(removeChart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // runQuery
      .addCase(runQuery.pending, (state, action) => {
        state.loading = true;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: true,
            };
          }
          return chart;
        });
      })
      .addCase(runQuery.fulfilled, (state, action) => {
        state.loading = false;
        if (!action.meta.arg.skipStateUpdate) {
          state.data = state.data.map((chart) => {
            if (chart.id === action.payload.id) {
              return {
                ...chart,
                ...action.payload,
                loading: false,
              };
            }
            return chart;
          });
        }
      })
      .addCase(runQuery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: false,
            };
          }
          return chart;
        });
      })

      // runQueryWithFilters
      .addCase(runQueryWithFilters.pending, (state, action) => {
        state.loading = true;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: true,
            };
          }
          return chart;
        });
      })
      .addCase(runQueryWithFilters.fulfilled, (state, action) => {
        state.loading = false;
        const { filters, variables } = action.meta.arg;
        const filterHash = JSON.stringify({ filters: filters || [], variables: variables || {} });
        
        state.data = state.data.map((chart) => {
          if (chart.id === action.payload.id) {
            return {
              ...chart,
              ...action.payload,
              loading: false,
              filterMetadata: {
                appliedFilters: filters || [],
                appliedVariables: variables || {},
                lastFilterHash: filterHash,
                lastUpdated: Date.now(),
              },
            };
          }
          return chart;
        });
      })
      .addCase(runQueryWithFilters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: false,
            };
          }
          return chart;
        });
      })

      // runQueryOnPublic
      .addCase(runQueryOnPublic.pending, (state, action) => {
        state.loading = true;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: true,
            };
          }
          return chart;
        });
      })
      .addCase(runQueryOnPublic.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.payload.id) {
            return {
              ...chart,
              ...action.payload,
              loading: false,
            };
          }
          return chart;
        });
      })
      .addCase(runQueryOnPublic.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: false,
            };
          }
          return chart;
        });
      })

      // createShareString
      .addCase(createShareString.pending, (state, action) => {
        state.loading = true;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: true,
            };
          }
          return chart;
        });
      })
      .addCase(createShareString.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.payload.id) {
            return {
              ...chart,
              ...action.payload,
              loading: false,
            };
          }
          return chart;
        });
      })
      .addCase(createShareString.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              loading: false,
            };
          }
          return chart;
        });
      })

      // createSharePolicy
      .addCase(createSharePolicy.pending, (state) => {
        state.loading = true;
      })
      .addCase(createSharePolicy.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              SharePolicies: chart.SharePolicies ? [...chart.SharePolicies, action.payload] : [action.payload],
            };
          }
          return chart;
        });
      })
      .addCase(createSharePolicy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // getSharePolicies
      .addCase(getSharePolicies.pending, (state) => {
        state.loading = true;
      })
      .addCase(getSharePolicies.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              SharePolicies: action.payload,
            };
          }
          return chart;
        });
      })
      .addCase(getSharePolicies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // updateSharePolicy
      .addCase(updateSharePolicy.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateSharePolicy.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              SharePolicies: chart.SharePolicies?.map((policy) => 
                policy.id === action.payload.id ? action.payload : policy
              ) || [],
            };
          }
          return chart;
        });
      })
      .addCase(updateSharePolicy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // deleteSharePolicy
      .addCase(deleteSharePolicy.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteSharePolicy.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (chart.id === action.meta.arg.chart_id) {
            return {
              ...chart,
              SharePolicies: chart.SharePolicies?.filter((policy) => 
                policy.id !== action.payload.policy_id
              ) || [],
            };
          }
          return chart;
        });
      })
      .addCase(deleteSharePolicy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // createCdc
      .addCase(createCdc.pending, (state) => {
        state.loading = true;
      })
      .addCase(createCdc.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (action.meta.arg.chart_id === chart.id) {
            return {
              ...chart,
              ChartDatasetConfigs: [
                ...chart.ChartDatasetConfigs,
                action.payload,
              ],
            };
          }
          return chart;
        });
      })
      .addCase(createCdc.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // updateCdc
      .addCase(updateCdc.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCdc.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (action.meta.arg.chart_id === chart.id) {
            return {
              ...chart,
              ChartDatasetConfigs: chart.ChartDatasetConfigs.map((cdc) => {
                if (cdc.id === action.payload.id) {
                  return {
                    ...cdc,
                    ...action.payload,
                  };
                }
                return cdc;
              }),
            };
          }
          return chart;
        });
      })
      .addCase(updateCdc.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      // removeCdc
      .addCase(removeCdc.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeCdc.fulfilled, (state, action) => {
        state.loading = false;
        state.data = state.data.map((chart) => {
          if (action.meta.arg.chart_id === chart.id) {
            return {
              ...chart,
              ChartDatasetConfigs: chart.ChartDatasetConfigs.filter((cdc) => cdc.id !== action.meta.arg.cdc_id),
            };
          }
          return chart;
        });
      })
      .addCase(removeCdc.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
  },
});

export const {
  setCharts,
  stageChart,
  clearStagedCharts,
  updateLocalChart,
  removeLocalChart,
  updateChartFilterMetadata,
  clearChartFilterMetadata,
} = chartSlice.actions;

// Helper function to generate filter hash
export const generateFilterHash = (filters, variables) => {
  return JSON.stringify({ filters: filters || [], variables: variables || {} });
};

// Selector to check if current filters match chart's stored filter metadata
export const shouldSkipFiltering = (chart, currentFilters, currentVariables) => {
  if (!chart?.filterMetadata) return false;
  
  const currentHash = generateFilterHash(currentFilters, currentVariables);
  return chart.filterMetadata.lastFilterHash === currentHash;
};

// Selector to get charts that need filtering
export const getChartsNeedingFiltering = (charts, currentFilters, currentVariables) => {
  return charts.filter(chart => !shouldSkipFiltering(chart, currentFilters, currentVariables));
};

export const selectCharts = (state) => state.chart.data;
export const selectChart = (state, id) => state.chart.data.find((chart) => chart.id === id); 
export const selectCdc = (state, chartId, cdcId) => {
  const chart = state.chart.data.find((c) => c.id === chartId);
  if (!chart) return {};
  return chart.ChartDatasetConfigs.find((cdc) => cdc.id === cdcId);
}

export default chartSlice.reducer;
