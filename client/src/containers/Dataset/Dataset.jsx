import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Flip, toast, ToastContainer } from "react-toastify";
import {
  Button, Link, Spacer, Divider, Input, Tabs, Tab,
} from "@nextui-org/react";
import { LuAreaChart, LuArrowRight, LuCheck, LuDatabase, LuPencil } from "react-icons/lu";
import { useParams } from "react-router";

import Row from "../../components/Row";
import Text from "../../components/Text";
import useThemeDetector from "../../modules/useThemeDetector";
import {
  createCdc,
  createChart,
} from "../../slices/chart";

import { changeTutorial as changeTutorialAction } from "../../actions/tutorial";
import {
  getDataset, updateDataset,
} from "../../slices/dataset";
import Navbar from "../../components/Navbar";
import { getTeamConnections } from "../../slices/connection";
import DatasetQuery from "./DatasetQuery";
import DatasetBuilder from "./DatasetBuilder";
import { getProjects } from "../../slices/project";
import { chartColors } from "../../config/colors";

function Dataset() {
  const [error, setError] = useState(null);
  const [legend, setLegend] = useState("");
  const [editLegend, setEditLegend] = useState(false);
  const [datasetMenu, setDatasetMenu] = useState("query");
  const [chart, setChart] = useState(null);

  const theme = useThemeDetector() ? "dark" : "light";
  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(null);
  const chartInitRef = useRef(null);

  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const ghostProject = useSelector((state) => state.project.data?.find((p) => p.ghost));
  const ghostChart = useSelector((state) => state.chart.data?.find((c) => c.id === chart?.id));

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
    if (!dataset) {
      return;
    }

    if (!initRef.current) {
      initRef.current = true;
      setLegend(dataset.legend);
    }
  }, [dataset]);

  useEffect(() => {
    if (ghostProject?.id && !chart && dataset && !chartInitRef.current) {
      chartInitRef.current = true;
      dispatch(createChart({
        project_id: ghostProject.id,
        data: {
          name: dataset.legend,
          type: "line",
        },
      }))
        .then((data) => {
          setChart(data.payload);

          dispatch(createCdc({
            project_id: data.payload.project_id,
            chart_id: data.payload.id,
            data: {
              dataset_id: dataset.id,
              datasetColor: chartColors.blue.hex,
              fill: false,
              order: 0,
            },
          }))
        });
    }
  }, [ghostProject, dataset]);

  useEffect(() => {
    console.log(chart);
  }, [chart]);

  useEffect(() => {
    let message = error;
    if (error instanceof Error) {
      message = "Could not fetch data. Please check your query.";
    }

    if (error) {
      toast.error(message);
    }
  }, [error]);

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
              <Tab
                key="configure"
                title={(
                  <div className="flex items-center gap-2">
                    <LuAreaChart size={24} />
                    <span>Configure</span>
                  </div>
                )}
                textValue="Configure"
              />
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
                onClick={() => setDatasetMenu("configure")}
                endContent={<LuCheck />}
                isDisabled={dataset?.DataRequests.length === 0}
              >
                Complete dataset
              </Button>
            )}
          </div>
        </Row>
        <Spacer y={2} />
        <Divider />
        <Spacer y={4} />

        {datasetMenu === "query" && (
          <DatasetQuery onUpdateDataset={_onUpdateDataset} />
        )}

        {datasetMenu === "configure" && (
          <DatasetBuilder
            chart={ghostChart}
            projectId={ghostProject?.id}
          />
        )}
      </div>

      <ToastContainer
        position="top-center"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={theme}
      />
    </div>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  requests: PropTypes.array.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  datasetResponses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
    datasetResponses: state.dataset.responses,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Dataset);
