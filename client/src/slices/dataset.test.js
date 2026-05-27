import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadDatasetModule() {
  const source = await readFile(new URL("./dataset.js", import.meta.url), "utf8");
  const toolkit = await import("@reduxjs/toolkit");
  const context = vm.createContext({
    Headers,
    fetch,
  });

  const modules = {
    "@reduxjs/toolkit": new vm.SyntheticModule(["createSlice", "createAsyncThunk"], function() {
      this.setExport("createSlice", toolkit.createSlice);
      this.setExport("createAsyncThunk", toolkit.createAsyncThunk);
    }, { context }),
    "../modules/auth": new vm.SyntheticModule(["getAuthToken"], function() {
      this.setExport("getAuthToken", () => "token");
    }, { context }),
    "../config/settings": new vm.SyntheticModule(["API_HOST"], function() {
      this.setExport("API_HOST", "http://localhost");
    }, { context }),
  };

  const mod = new vm.SourceTextModule(source, {
    context,
    identifier: "dataset.js",
  });

  await mod.link((specifier) => modules[specifier]);
  await mod.evaluate();

  return mod.namespace;
}

test("dataset selectors hide data that belongs to a different active team", async () => {
  const { selectDatasets, selectDatasetsNoDrafts } = await loadDatasetModule();
  const state = {
    team: { active: { id: 2 } },
    dataset: {
      teamId: 1,
      data: [
        { id: 10, draft: false },
        { id: 11, draft: true },
      ],
      responses: [{ dataset_id: 10, data: [] }],
    },
  };

  assert.equal(selectDatasets(state).length, 0);
  assert.equal(selectDatasetsNoDrafts(state).length, 0);
});

test("dataset reducer clears previous team data when a new team fetch starts", async () => {
  const { datasetSlice, getDatasets } = await loadDatasetModule();
  const state = {
    loading: false,
    error: false,
    teamId: 1,
    data: [{ id: 10 }],
    responses: [{ dataset_id: 10, data: [] }],
  };

  const nextState = datasetSlice.reducer(state, getDatasets.pending("request-id", { team_id: 2 }));

  assert.equal(nextState.loading, true);
  assert.equal(nextState.teamId, 2);
  assert.equal(nextState.data.length, 0);
  assert.equal(nextState.responses.length, 0);
});

test("dataset reducer keeps current team data visible during same-team refreshes", async () => {
  const { datasetSlice, getDatasets } = await loadDatasetModule();
  const state = {
    loading: false,
    error: false,
    teamId: 2,
    data: [{ id: 20 }],
    responses: [{ dataset_id: 20, data: [] }],
  };

  const nextState = datasetSlice.reducer(state, getDatasets.pending("request-id", { team_id: 2 }));

  assert.equal(nextState.loading, true);
  assert.equal(nextState.teamId, 2);
  assert.equal(nextState.data.length, 1);
  assert.equal(nextState.responses.length, 1);
});

test("dataset reducer ignores stale dataset responses from a previous team", async () => {
  const { datasetSlice, getDataset } = await loadDatasetModule();
  const state = {
    loading: true,
    error: false,
    teamId: 2,
    data: [],
    responses: [],
  };

  const nextState = datasetSlice.reducer(
    state,
    getDataset.fulfilled({ id: 10, name: "Previous team dataset" }, "request-id", {
      team_id: 1,
      dataset_id: 10,
    })
  );

  assert.equal(nextState.loading, true);
  assert.equal(nextState.data.length, 0);
});
