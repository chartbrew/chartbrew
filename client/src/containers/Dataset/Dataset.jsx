import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Autocomplete, EmptyState, Label, ListBox, SearchField, useFilter,
  Button, Chip, Input, Link, Modal, Spacer,
} from "@heroui/react";
import { LuChartColumn, LuCheck, LuPencil } from "react-icons/lu";
import { useLocation, useNavigate, useParams } from "react-router";

import { createChart, createCdc, getProjectCharts, runQuery, updateChart } from "../../slices/chart";
import { getDataset, saveNewDataset, updateDataset } from "../../slices/dataset";
import DatasetQuery from "./DatasetQuery";
import { chartColors } from "../../config/colors";
import useQuery from "../../modules/useQuery";
import { selectUser } from "../../slices/user";
import { getTeams, selectTeam } from "../../slices/team";
import { getProjects, selectProjects } from "../../slices/project";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";
import getDashboardLayout from "../../modules/getDashboardLayout";
import { placeNewWidget } from "../../modules/autoLayout";

const defaultNewChart = {
  type: "line",
  subType: "lcTimeseries",
};

function getNewChartLayoutForProject(charts) {
  const layouts = getDashboardLayout(charts);
  const chartLayout = {};

  Object.keys(layouts).forEach((bp) => {
    const w = bp === "lg" ? 4 : bp === "md" ? 5 : bp === "sm" ? 3 : bp === "xs" ? 2 : 2;
    const pos = placeNewWidget(layouts[bp] || [], { w, h: 2 }, bp);
    chartLayout[bp] = [pos.x, pos.y, pos.w, pos.h];
  });

  return chartLayout;
}

function Dataset() {
  const { contains } = useFilter({ sensitivity: "base" });
  const [error, setError] = useState(null);
  const [datasetName, setDatasetName] = useState("");
  const [editDatasetName, setEditDatasetName] = useState(false);
  const [saveDatasetLoading, setSaveDatasetLoading] = useState(false);
  const [fromChart, setFromChart] = useState(null);
  const [draftSaveModalOpen, setDraftSaveModalOpen] = useState(false);
  const [draftSaveIntent, setDraftSaveIntent] = useState("save");
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [createChartModalOpen, setCreateChartModalOpen] = useState(false);
  const [createChartSelectedProjectKey, setCreateChartSelectedProjectKey] = useState(null);
  const [createChartSubmitAttempted, setCreateChartSubmitAttempted] = useState(false);
  const [createChartFromDatasetLoading, setCreateChartFromDatasetLoading] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { search } = useLocation();
  const createInitRef = useRef(null);
  const query = useQuery();

  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const projects = useSelector(selectProjects);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);

  useEffect(() => {
    async function fetchData() {
      if (params.datasetId !== "new") {
        dispatch(getDataset({
          team_id: team.id,
          dataset_id: params.datasetId,
        }));
      }
      dispatch(getProjects({ team_id: team.id }));
    }

    if (team?.id) {
      fetchData();
    }
  }, [dispatch, params.datasetId, team?.id]);

  useEffect(() => {
    if (user?.id && !team) {
      dispatch(getTeams());
    }
  }, [user]);

  useEffect(() => {
    if (dataset?.id) {
      setDatasetName(getDatasetDisplayName(dataset));
      const chartProjectId = query.get("project_id");
      const datasetProjectIds = dataset.project_ids || [];

      if (datasetProjectIds.length > 0) {
        setSelectedProjectIds(datasetProjectIds);
      } else if (chartProjectId && (fromChart === "create" || fromChart === "edit")) {
        setSelectedProjectIds([parseInt(chartProjectId, 10)]);
      } else {
        setSelectedProjectIds([]);
      }
    }
  }, [dataset?.id, dataset?.project_ids, fromChart, query]);

  useEffect(() => {
    if (params.datasetId === "new" && team?.id && !createInitRef.current) {
      createInitRef.current = true;
      dispatch(saveNewDataset({
        team_id: team.id,
        data: {
          name: "New dataset",
          team_id: team.id,
          draft: true,
        },
      }))
        .then((newDataset) => {
          if (newDataset?.error) {
            toast.error("Could not create dataset. Please try again.");
          } else {
            let newPathname = `/datasets/${newDataset.payload?.id}${search}`;
            navigate(newPathname);
            dispatch(getDataset({
              team_id: team.id,
              dataset_id: newDataset.payload?.id,
            }));
          }
        });
    }
  }, [params, team?.id]);

  useEffect(() => {
    let message = error;
    if (error instanceof Error) {
      message = "Could not fetch data. Please check your query.";
    }

    if (error) {
      toast.error(message);
    }
  }, [error]);

  useEffect(() => {
    if (query) {
      if (query.has("chart_id") && query.has("project_id") && query.has("create")) {
        setFromChart("create");
      } else if (query.has("chart_id") && query.has("project_id")) {
        setFromChart("edit");
      } else {
        setFromChart(null);
      }
    }
  }, [query]);

  useEffect(() => {
    if (!createChartModalOpen) return;

    const selectable = projects.filter((project) => !project.ghost);
    if (selectedProjectIds.length === 1) {
      const id = selectedProjectIds[0];
      if (selectable.some((p) => p.id === id)) {
        setCreateChartSelectedProjectKey(String(id));
        return;
      }
    }
    setCreateChartSelectedProjectKey(null);
    // Prefill from dataset tags only when the modal opens, not when tags/projects change while it stays open.
  }, [createChartModalOpen]);

  const _onUpdateDataset = (data) => {
    return dispatch(updateDataset({
      team_id: team.id,
      dataset_id: dataset.id,
      data
    }))
      .then((newDataset) => {
        toast.success("Dataset updated");
        return newDataset;
      })
      .catch((e) => {
        setError(e);
        return e;
      });
  };

  const _persistDataset = async (projectIds = dataset?.project_ids || [], afterSave = "save") => {
    if (!dataset?.id || !team?.id) return false;

    const trimmedName = datasetName.trim() || getDatasetDisplayName(dataset) || "Untitled dataset";
    setSaveDatasetLoading(true);

    try {
      await dispatch(updateDataset({
        team_id: team.id,
        dataset_id: dataset.id,
        data: {
          draft: false,
          name: trimmedName,
          project_ids: projectIds,
        },
      })).unwrap();

      if (fromChart === "create") {
        const chartId = query.get("chart_id");
        const projectId = query.get("project_id");

        await dispatch(updateChart({
          project_id: projectId,
          chart_id: chartId,
          data: { name: trimmedName },
        })).unwrap();

        await dispatch(createCdc({
          project_id: projectId,
          chart_id: chartId,
          data: {
            dataset_id: dataset.id,
            legend: trimmedName,
            datasetColor: chartColors.blue.hex,
            fill: false,
            order: 0,
          },
        })).unwrap();

        try {
          await dispatch(runQuery({
            project_id: projectId,
            chart_id: chartId,
            noSource: false,
            skipParsing: false,
            getCache: true,
          })).unwrap();
        } catch (queryError) {
          // The chart editor can recover from a failed first run.
        }

        navigate(`/dashboard/${projectId}/chart/${chartId}/edit`);
        return true;
      }

      if (fromChart === "edit") {
        navigate(`/dashboard/${query.get("project_id")}/chart/${query.get("chart_id")}/edit`);
        return true;
      }

      if (afterSave === "createChart" && !fromChart) {
        setCreateChartModalOpen(true);
        setEditDatasetName(false);
        return true;
      }

      toast.success("Dataset saved");
      setEditDatasetName(false);
      return true;
    } catch (saveError) {
      setError(saveError);
      toast.error("Could not save the dataset. Please try again.");
      return false;
    } finally {
      setSaveDatasetLoading(false);
    }
  };

  const _onSaveDataset = async (intent = "save") => {
    if (dataset?.draft) {
      const continueToCreateChart = intent === "createChart" || (!fromChart && intent === "save");
      setDraftSaveIntent(continueToCreateChart ? "createChart" : "save");
      setDraftSaveModalOpen(true);
      return;
    }

    await _persistDataset(
      selectedProjectIds,
      intent === "createChart" ? "createChart" : "save",
    );
  };

  const _onCreateChartFromDataset = async () => {
    if (!createChartSelectedProjectKey) {
      setCreateChartSubmitAttempted(true);
      return;
    }

    const projectId = parseInt(String(createChartSelectedProjectKey), 10);
    if (!dataset?.id || Number.isNaN(projectId)) return;

    setCreateChartFromDatasetLoading(true);

    try {
      const charts = await dispatch(getProjectCharts({ project_id: projectId })).unwrap();
      const chartLayout = getNewChartLayoutForProject(charts || []);
      const trimmedName = datasetName.trim() || getDatasetDisplayName(dataset) || "Untitled dataset";

      const chart = await dispatch(createChart({
        project_id: projectId,
        data: {
          ...defaultNewChart,
          name: trimmedName,
          layout: chartLayout,
        },
      })).unwrap();

      await dispatch(createCdc({
        project_id: projectId,
        chart_id: chart.id,
        data: {
          dataset_id: dataset.id,
          legend: trimmedName,
          datasetColor: chartColors.blue.hex,
          fill: false,
          order: 0,
        },
      })).unwrap();

      try {
        await dispatch(runQuery({
          project_id: projectId,
          chart_id: chart.id,
          noSource: false,
          skipParsing: false,
          getCache: true,
        })).unwrap();
      } catch (queryError) {
        // The chart editor can recover from a failed first run.
      }

      setCreateChartModalOpen(false);
      setCreateChartSelectedProjectKey(null);
      setCreateChartSubmitAttempted(false);
      navigate(`/dashboard/${projectId}/chart/${chart.id}/edit`);
    } catch (createError) {
      setError(createError);
      toast.error("Could not create the chart. Please try again.");
    } finally {
      setCreateChartFromDatasetLoading(false);
    }
  };

  const _toggleProjectTag = (projectId) => {
    setSelectedProjectIds((prev) => (
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    ));
  };

  return (
    <div>
      <div className="flex flex-row justify-between flex-wrap gap-2 items-center bg-background px-4 rounded-lg border-1 border-divider py-2">
        <div className="flex flex-row gap-2 items-center">
          {!editDatasetName && (
            <>
              <Link onClick={() => setEditDatasetName(true)} className="text-default-500 cursor-pointer flex flex-row items-center gap-2">
                <div className="font-tw font-bold text-foreground text-lg">{getDatasetDisplayName(dataset)}</div>
                <LuPencil size={16} className="text-foreground-500" />
              </Link>
            </>
          )}

          {editDatasetName && (
            <>
              <Input
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="Dataset name"
                variant="bordered"
                labelPlacement="outside"
                endContent={
                  <Button
                    variant="flat"
                    isIconOnly
                    onPress={() => _onSaveDataset("save")}
                    size="sm"
                  >
                    <LuCheck size={16} />
                  </Button>
                }
              />
            </>
          )}
        </div>

        <div className="flex flex-row gap-2 flex-wrap">
          {!fromChart && (
            <Button
              color="default"
              variant="ghost"
              onPress={() => _onSaveDataset("createChart")}
              isLoading={saveDatasetLoading}
              isDisabled={!dataset?.id || dataset?.DataRequests?.length === 0}
              startContent={<LuChartColumn size={16} />}
            >
              Save & create chart
            </Button>
          )}
          <Button
            color="primary"
            onPress={() => _onSaveDataset("save")}
            isLoading={saveDatasetLoading}
            isDisabled={!dataset?.id || dataset?.DataRequests?.length === 0}
          >
            {fromChart ? "Save & return to chart" : "Save dataset"}
          </Button>
        </div>
      </div>

      <DatasetQuery onUpdateDataset={_onUpdateDataset} />

      <Modal.Backdrop
        isOpen={draftSaveModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDraftSaveModalOpen(false);
            setDraftSaveIntent("save");
          }
        }}
      >
        <Modal.Container size="2xl">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Save dataset</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <Input
              value={datasetName}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder="Dataset name"
              label="Dataset name"
              labelPlacement="outside"
            />

            <Spacer y={2} />

            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-foreground">Tags</div>
              <div className="text-xs text-foreground-500">
                Assign dashboard tags now, or leave this empty and add them later. Dashboard tags make it easier to find this dataset in the future.
              </div>
              <div className="flex flex-row flex-wrap gap-2">
                {projects.filter((project) => !project.ghost).map((project) => (
                  <Chip
                    key={project.id}
                    radius="sm"
                    color={selectedProjectIds.includes(project.id) ? "primary" : "default"}
                    variant={selectedProjectIds.includes(project.id) ? "solid" : "bordered"}
                    onClick={() => _toggleProjectTag(project.id)}
                    className="cursor-pointer"
                  >
                    {project.name}
                  </Chip>
                ))}
                {projects.filter((project) => !project.ghost).length === 0 && (
                  <div className="text-sm text-foreground-400">No tags available yet.</div>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onPress={() => {
                setDraftSaveModalOpen(false);
                setDraftSaveIntent("save");
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={saveDatasetLoading}
              onPress={async () => {
                const success = await _persistDataset(
                  selectedProjectIds,
                  draftSaveIntent === "createChart" ? "createChart" : "save",
                );
                if (success) {
                  setDraftSaveModalOpen(false);
                  setDraftSaveIntent("save");
                }
              }}
            >
              {fromChart ? "Save & return to chart" : "Save dataset"}
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop
        isOpen={createChartModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCreateChartModalOpen(false);
            setCreateChartSelectedProjectKey(null);
            setCreateChartSubmitAttempted(false);
          }
        }}
      >
        <Modal.Container size="2xl">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Create a chart from this dataset</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="text-sm text-foreground-500">
              Pick the dashboard (project) where this chart should be added. A new chart will be created and linked to this dataset.
            </div>
            <Spacer y={2} />
            <Autocomplete
              placeholder="Search or select a dashboard"
              selectionMode="single"
              isRequired
              value={createChartSelectedProjectKey}
              onChange={(value) => {
                setCreateChartSelectedProjectKey(value);
                setCreateChartSubmitAttempted(false);
              }}
              variant="secondary"
              isInvalid={createChartSubmitAttempted && !createChartSelectedProjectKey}
              errorMessage={
                createChartSubmitAttempted && !createChartSelectedProjectKey
                  ? "Select a dashboard to continue."
                  : undefined
              }
              aria-label="Dashboard for new chart"
            >
              <Label>Dashboard</Label>
              <Autocomplete.Trigger>
                <Autocomplete.Value />
                <Autocomplete.ClearButton />
                <Autocomplete.Indicator />
              </Autocomplete.Trigger>
              <Autocomplete.Popover>
                <Autocomplete.Filter filter={contains}>
                  <SearchField autoFocus name="dashboard-search" variant="secondary">
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder="Search dashboards..." />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                    {projects.filter((project) => !project.ghost).map((project) => (
                      <ListBox.Item key={String(project.id)} id={String(project.id)} textValue={project.name}>
                        {project.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Autocomplete.Filter>
              </Autocomplete.Popover>
            </Autocomplete>
            {projects.filter((project) => !project.ghost).length === 0 && (
              <div className="text-sm text-foreground-400 mt-2">No projects available yet.</div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onPress={() => {
                setCreateChartModalOpen(false);
                setCreateChartSelectedProjectKey(null);
                setCreateChartSubmitAttempted(false);
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={createChartFromDatasetLoading}
              isDisabled={projects.filter((project) => !project.ghost).length === 0}
              onPress={_onCreateChartFromDataset}
            >
              Create chart
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

    </div>
  );
}

export default Dataset;
