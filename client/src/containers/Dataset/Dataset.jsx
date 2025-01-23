import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Button, Link, Spacer, Input, Tabs, Tab, Modal, ModalHeader, ModalBody, ModalFooter, ModalContent, Chip,
} from "@heroui/react";
import { LuArrowRight, LuChartArea, LuCheck, LuDatabase, LuPencil, LuSearch } from "react-icons/lu";
import { useLocation, useNavigate, useParams } from "react-router";

import Row from "../../components/Row";
import Text from "../../components/Text";
import {
  createCdc,
  createChart,
  runQuery,
} from "../../slices/chart";

import {
  getDataset, runRequest, saveNewDataset, updateDataset,
} from "../../slices/dataset";
import Navbar from "../../components/Navbar";
import { getTeamConnections } from "../../slices/connection";
import DatasetQuery from "./DatasetQuery";
import DatasetBuilder from "./DatasetBuilder";
import { getProjects, selectProjects } from "../../slices/project";
import { chartColors } from "../../config/colors";
import getDashboardLayout from "../../modules/getDashboardLayout";
import useQuery from "../../modules/useQuery";
import { selectUser } from "../../slices/user";
import { getTeams, selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";

function Dataset() {
  const [error, setError] = useState(null);
  const [legend, setLegend] = useState("");
  const [editLegend, setEditLegend] = useState(false);
  const [datasetMenu, setDatasetMenu] = useState("query");
  const [chart, setChart] = useState(null);
  const [completeModal, setCompleteModal] = useState(false);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [completeDatasetLoading, setCompleteDatasetLoading] = useState(false);
  const [fromChart, setFromChart] = useState("");

  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { search } = useLocation();
  const initRef = useRef(null);
  const chartInitRef = useRef(null);
  const createInitRef = useRef(null);
  const query = useQuery();

  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const ghostProject = useSelector((state) => state.project.data?.find((p) => p.ghost));
  const ghostChart = useSelector((state) => state.chart.data?.find((c) => c.id === chart?.id));
  const projects = useSelector(selectProjects);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);

  useEffect(() => {
    async function fetchData() {
      dispatch(getDataset({
        team_id: params.teamId,
        dataset_id: params.datasetId,
      }));
      dispatch(getTeamConnections({ team_id: params.teamId }));
      dispatch(getProjects({ team_id: params.teamId }));
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (user?.id && !team) {
      dispatch(getTeams(user.id));
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && team?.id) {
      if (!canAccess("projectAdmin", user.id, team.TeamRoles)) {
        setDatasetMenu("configure");
      }
    }
  }, [user, team]);

  useEffect(() => {
    if (!dataset) {
      return;
    }

    if (!initRef.current) {
      initRef.current = true;
      setLegend(dataset.legend);
    }
  }, [dataset]);

  useEffect(() => {
    if (params.datasetId === "new" && !createInitRef.current) {
      createInitRef.current = true;
      dispatch(saveNewDataset({
        team_id: params.teamId,
        data: {
          legend: "New dataset",
          team_id: params.teamId,
          draft: true,
        },
      }))
        .then((newDataset) => {
          let newPathname = `/${params.teamId}/dataset/${newDataset.payload.id}${search}`;
          navigate(newPathname);
          dispatch(getDataset({
            team_id: params.teamId,
            dataset_id: newDataset.payload.id,
          }));
        });
    }
  }, [params]);

  useEffect(() => {
    if (ghostProject?.id && !chart && dataset && !chartInitRef.current) {
      chartInitRef.current = true;
      dispatch(createChart({
        project_id: ghostProject.id,
        data: {
          name: dataset.legend,
          type: "line",
          subType: "timeseries",
        },
      }))
        .then((data) => {
          setChart(data.payload);
          const cdcData = {
            ...dataset,
            dataset_id: dataset.id,
            datasetColor: chartColors.blue.hex,
            fill: false,
            order: 0,
          };
          delete cdcData.id;

          dispatch(createCdc({
            project_id: data.payload.project_id,
            chart_id: data.payload.id,
            data: cdcData,
          }))
        });
    }
  }, [ghostProject, dataset]);

  useEffect(() => {
    if (datasetMenu === "configure" && dataset?.id) {
      dispatch(runRequest({
        team_id: params.teamId,
        dataset_id: dataset.id,
        getCache: true,
      }));
    }
  }, [datasetMenu]);

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
      if (query.has("create") && query.has("chart_id") && query.has("project_id")) {
        setFromChart("create");
      }
      if (!query.has("create") && query.has("chart_id") && query.has("project_id")) {
        setFromChart("edit");
      }
      if (query.has("editFilters")) {
        setDatasetMenu("configure");
      }
    }
  }, [query]);

  const _onUpdateDataset = (data) => {
    return dispatch(updateDataset({
      team_id: params.teamId,
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

  const _onSelectCompleteProject = (projectId) => {
    setCompleteProjects((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((p) => p !== projectId);
      }
      return [...prev, projectId];
    });
  };

  const _onSaveDataset = () => {
    if (fromChart === "edit") {
      navigate(`/${params.teamId}/${query.get("project_id")}/chart/${query.get("chart_id")}/edit`);
      return;
    }

    setCompleteModal(true);
  }

  const _onCompleteDataset = () => {
    setCompleteDatasetLoading(true);

    dispatch(updateDataset({
      team_id: params.teamId,
      dataset_id: dataset.id,
      data: {
        draft: false,
        legend,
      },
    }));

    let ghostCdc = ghostChart?.ChartDatasetConfigs?.[0] || {};
    let cdcData = { ...dataset, ...ghostCdc, legend };
    delete cdcData.id;

    if (fromChart === "create") {
      dispatch(createCdc({
        project_id: query.get("project_id"),
        chart_id: query.get("chart_id"),
        data: {
          ...cdcData,
          dataset_id: dataset.id,
          datasetColor: chartColors.blue.hex,
        },
      }))
        .then((cdcData) => {
          navigate(`/${params.teamId}/${query.get("project_id")}/chart/${query.get("chart_id")}/edit`);          
          dispatch(runQuery({
            project_id: query.get("project_id"),
            chart_id: cdcData.payload.chart_id,
            noSource: false,
            skipParsing: false,
            getCache: true,
          }));
        });
      return;
    }

    if (completeProjects.length === 0) {
      navigate("/");
      return;
    }

    let loadingCounter = 0;

    completeProjects.forEach((projectId) => {
      const currentProject = projects.find((p) => p.id === projectId);
      // add chart at the end of the dashboard
      const layouts = getDashboardLayout(currentProject.Charts);
      let bottomY = 0;
      const chartLayout = {};
      Object.keys(layouts).map((bp) => {
        layouts[bp].forEach((item) => {
          const bottom = item.y + item.h;
          if (bottom > bottomY) {
            bottomY = bottom;
          }
        });

        chartLayout[bp] = [
          0,
          bottomY,
          bp === "lg" ? 4 : bp === "md" ? 5 : bp === "sm" ? 3 : bp === "xs" ? 2 : 2,
          2,
        ];
      });

      const newChart = {
        ...ghostChart,
        name: legend,
        draft: false,
        id: null,
        layout: chartLayout,
      };

      dispatch(createChart({
        project_id: projectId,
        data: newChart,
      }))
        .then((actionData) => {
          dispatch(createCdc({
            project_id: projectId,
            chart_id: actionData.payload.id,
            data: {
              ...cdcData,
              dataset_id: dataset.id,
              datasetColor: chartColors.blue.hex,
            },
          }))
            .then((cdcData) => {
              dispatch(runQuery({
                project_id: projectId,
                chart_id: cdcData.payload.chart_id,
                noSource: false,
                skipParsing: false,
                getCache: true,
              }));
            });

          loadingCounter += 1;
          if (loadingCounter === completeProjects.length) {
            setCompleteDatasetLoading(false);
            if (completeProjects.length === 1) {
              navigate(`/${params.teamId}/${completeProjects[0]}/dashboard`);
            } else {
              navigate("/");
            }
          }
        })
        .catch(() => {
          loadingCounter += 1;
          if (loadingCounter === completeProjects.length) {
            setCompleteDatasetLoading(false);
            if (completeProjects.length === 1) {
              toast.error("Could not create chart. Please try again");
              setCompleteModal(false);
            } else {
              navigate("/");
            }
          }
        });
    });
  };

  return (
    <div>
      <Navbar hideTeam transparent />
      <div className="p-2 md:pl-8 md:pr-8">
        <Row justify={"space-between"} align={"center"}>
          <div className="flex flex-row gap-2 items-center">
            {!editLegend && (
              <>
                <Text size="h4">{dataset?.legend}</Text>
                <Link onClick={() => setEditLegend(true)}>
                  <LuPencil />
                </Link>
              </>
            )}

            {editLegend && (
              <>
                <Input
                  value={legend}
                  onChange={(e) => setLegend(e.target.value)}
                  placeholder="How is this dataset called?"
                  variant="bordered"
                  labelPlacement="outside"
                />
                <Button
                  variant="ghost"
                  isIconOnly
                  color="primary"
                  onPress={() => {
                    _onUpdateDataset({ legend });
                    setEditLegend(false);
                  }}
                  disabled={legend === dataset?.legend}
                  size="sm"
                >
                  <LuCheck />
                </Button>
              </>
            )}
          </div>

          <div>
            <Tabs
              aria-label="Pages"
              color="primary"
              variant="bordered"
              size="lg"
              selectedKey={datasetMenu}
              onSelectionChange={(key) => setDatasetMenu(key)}
            >
              {canAccess("projectAdmin", user.id, team.TeamRoles) && (
                <Tab
                  key="query"
                  title={(
                    <div className="flex items-center gap-2">
                      <LuDatabase size={24} />
                      <span>Query</span>
                    </div>
                  )}
                  textValue="Query"
                />
              )}
              {canAccess("projectEditor", user.id, team.TeamRoles) && (
                <Tab
                  key="configure"
                  title={(
                    <div className="flex items-center gap-2">
                      <LuChartArea size={24} />
                      <span>Configure</span>
                    </div>
                  )}
                  textValue="Configure"
                  isDisabled={dataset?.DataRequests.length === 0}
                />
              )}
            </Tabs>
          </div>

          <div className="flex flex-row">
            {datasetMenu === "query" && (
              <Button
                color="primary"
                onClick={() => setDatasetMenu("configure")}
                endContent={<LuArrowRight />}
                isDisabled={dataset?.DataRequests.length === 0}
              >
                Configure dataset
              </Button>
            )}
            {datasetMenu === "configure" && (
              <Button
                color="primary"
                onClick={() => _onSaveDataset()}
                endContent={<LuCheck />}
                isDisabled={dataset?.DataRequests.length === 0}
              >
                {fromChart === "edit" && "Save & return to chart"}
                {fromChart !== "edit" && "Complete dataset"}
              </Button>
            )}
          </div>
        </Row>

        <Spacer y={4} />

        {datasetMenu === "query" && (
          <DatasetQuery onUpdateDataset={_onUpdateDataset} />
        )}

        {datasetMenu === "configure" && ghostChart && (
          <DatasetBuilder
            chart={ghostChart}
            projectId={ghostProject?.id}
          />
        )}
      </div>

      <Modal
        isOpen={completeModal}
        onClose={() => setCompleteModal(false)}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader>Complete your dataset</ModalHeader>
          <ModalBody>
            <div>Enter a name for your dataset</div>
            <Input
              labelPlacement="outside"
              value={legend}
              onChange={(e) => setLegend(e.target.value)}
              variant="bordered"
              className="max-w-[300px]"
            />
            <Spacer y={1} />

            {fromChart !== "create" && (
              <>
                <div>Want to add this chart to a dashboard?</div>
                {projects.length > 5 && (
                  <Input
                    labelPlacement="outside"
                    placeholder="Search projects"
                    startContent={<LuSearch />}
                    variant="bordered"
                    className="max-w-[300px]"
                    onChange={(e) => setProjectSearch(e.target.value)}
                    onClear={() => setProjectSearch("")}
                    value={projectSearch}
                    isClearable
                  />
                )}
                <div className="flex flex-row flex-wrap gap-2">
                  {projects.filter((p) => p.name.toLowerCase().indexOf(projectSearch.toLowerCase()) > -1 && !p.ghost).map((p) => (
                    <Chip
                      key={p.id}
                      radius="sm"
                      color={completeProjects.includes(p.id) ? "primary" : "default"}
                      variant={completeProjects.includes(p.id) ? "solid" : "bordered"}
                      onClick={() => _onSelectCompleteProject(p.id)}
                      className="cursor-pointer hover:shadow-md hover:saturate-150 transition-shadow"
                    >
                      {p.name}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setCompleteModal(false)}
            >
              Close
            </Button>
            {fromChart !== "create" && (
              <Button
                color="primary"
                onClick={_onCompleteDataset}
                isLoading={completeDatasetLoading}
              >
                {completeProjects.length > 0 ? "Save dataset & create chart" : "Save dataset"}
              </Button>
            )}
            {fromChart === "create" && (
              <Button
                color="primary"
                onClick={_onCompleteDataset}
                isLoading={completeDatasetLoading}
              >
                Save & return to chart
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default Dataset;
