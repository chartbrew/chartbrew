import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Button, Chip, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer,
} from "@heroui/react";
import { LuCheck, LuPencil } from "react-icons/lu";
import { useLocation, useNavigate, useParams } from "react-router";

import { createCdc, runQuery, updateChart } from "../../slices/chart";
import { getDataset, saveNewDataset, updateDataset } from "../../slices/dataset";
import { getTeamConnections } from "../../slices/connection";
import DatasetQuery from "./DatasetQuery";
import { chartColors } from "../../config/colors";
import useQuery from "../../modules/useQuery";
import { selectUser } from "../../slices/user";
import { getTeams, selectTeam } from "../../slices/team";
import { getProjects, selectProjects } from "../../slices/project";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";

function Dataset() {
  const [error, setError] = useState(null);
  const [datasetName, setDatasetName] = useState("");
  const [editDatasetName, setEditDatasetName] = useState(false);
  const [saveDatasetLoading, setSaveDatasetLoading] = useState(false);
  const [fromChart, setFromChart] = useState(null);
  const [draftSaveModalOpen, setDraftSaveModalOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);

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
      dispatch(getTeamConnections({ team_id: team.id }));
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

  const _persistDataset = async (projectIds = dataset?.project_ids || []) => {
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

  const _onSaveDataset = async () => {
    if (dataset?.draft) {
      setDraftSaveModalOpen(true);
      return;
    }

    await _persistDataset(selectedProjectIds);
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
                <div className="font-tw font-bold text-foreground">{getDatasetDisplayName(dataset)}</div>
                <LuPencil size={16} className="text-secondary" />
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
              />
            </>
          )}
        </div>

        <div className="flex flex-row gap-2 flex-wrap">
          <Button
            color="primary"
            onPress={_onSaveDataset}
            endContent={!saveDatasetLoading ? <LuCheck /> : null}
            isLoading={saveDatasetLoading}
            isDisabled={!dataset?.id || dataset?.DataRequests?.length === 0}
          >
            {fromChart ? "Save & return to chart" : "Save dataset"}
          </Button>
        </div>
      </div>

      <DatasetQuery onUpdateDataset={_onUpdateDataset} />

      <Modal isOpen={draftSaveModalOpen} onClose={() => setDraftSaveModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Save dataset</ModalHeader>
          <ModalBody>
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
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDraftSaveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={saveDatasetLoading}
              onPress={async () => {
                const success = await _persistDataset(selectedProjectIds);
                if (success) {
                  setDraftSaveModalOpen(false);
                }
              }}
            >
              {fromChart ? "Save & return to chart" : "Save dataset"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default Dataset;
