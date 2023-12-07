import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Link as LinkNext, Spacer, Tooltip, Input, Button,
  Switch, Modal, ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import _ from "lodash";
import { useWindowSize } from "react-use";
import { LuArrowRight, LuPencilLine } from "react-icons/lu";

import ChartPreview from "./components/ChartPreview";
import ChartSettings from "./components/ChartSettings";
import ChartDescription from "./components/ChartDescription";
import Walkthrough from "./components/Walkthrough";
import {
  createChart, updateChart, runQuery, runQueryWithFilters, selectCharts,
} from "../../slices/chart";
import {
  getChartDatasets as getChartDatasetsAction,
  saveNewDataset as saveNewDatasetAction,
  updateDataset as updateDatasetAction,
  deleteDataset as deleteDatasetAction,
  clearDatasets as clearDatasetsAction,
} from "../../actions/dataset";
import { getChartAlerts, clearAlerts } from "../../slices/alert";
import { updateUser as updateUserAction } from "../../actions/user";
import {
  getTemplates as getTemplatesAction
} from "../../actions/template";
import {
  changeTutorial as changeTutorialAction,
  completeTutorial as completeTutorialAction,
  resetTutorial as resetTutorialAction,
} from "../../actions/tutorial";
import Row from "../../components/Row";
import Text from "../../components/Text";
import useThemeDetector from "../../modules/useThemeDetector";
import { useNavigate, useParams } from "react-router";
import ChartDatasets from "./components/ChartDatasets";

/*
  Container used for setting up a new chart
*/
function AddChart(props) {
  const [titleScreen, setTitleScreen] = useState(true);
  const [newChart, setNewChart] = useState({
    type: "line",
    subType: "lcTimeseries",
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [chartName, setChartName] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saveRequired, setSaveRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [startTutorial, setStartTutorial] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [invalidateCache, setInvalidateCache] = useState(false);

  const { height } = useWindowSize();

  const {
    getChartDatasets, tutorial,
    datasets, user, changeTutorial,
    completeTutorial, clearDatasets, connections, templates, getTemplates,
  } = props;

  const charts = useSelector(selectCharts);

  const isDark = useThemeDetector();
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    clearDatasets();
    dispatch(clearAlerts());

    if (params.chartId) {
      charts.map((chart) => {
        if (chart.id === parseInt(params.chartId, 10)) {
          setNewChart(chart);
        }
        return chart;
      });
      setTitleScreen(false);

      // also fetch the chart's datasets and alerts
      getChartDatasets(params.projectId, params.chartId);
      dispatch(getChartAlerts({
        project_id: params.projectId,
        chart_id: params.chartId
      }));
    }

    // if (user && (!user.tutorials || Object.keys(user.tutorials).length === 0)) {
    //   setTimeout(() => {
    //     setStartTutorial(true);
    //   }, 1000);
    // }

    getTemplates(params.teamId);
  }, []);

  useEffect(() => {
    charts.map((chart) => {
      if (chart.id === parseInt(params.chartId, 10)) {
        if (!_.isEqual(chart, newChart)) {
          setNewChart(chart);
          setChartName(chart.name);
        }
      }
      return chart;
    });
  }, [charts]);

  useEffect(() => {
    let found = false;
    charts.map((chart) => {
      if (chart.id === parseInt(params.chartId, 10)) {
        if (!_.isEqual(chart, newChart)) {
          setSaveRequired(true);
          found = true;
        }
      }
      return chart;
    });
    if (!found) setSaveRequired(false);
  }, [newChart]);

  const _onNameChange = (value) => {
    setChartName(value);
  };

  const _onSubmitNewName = () => {
    setEditingTitle(false);
    _onChangeChart({ name: chartName });
  };

  const _onCreateClicked = () => {
    const tempChart = { ...newChart, name: chartName };
    return dispatch(createChart({ project_id: params.projectId, data: tempChart }))
      .then((res) => {
        setNewChart(res.payload);
        setTitleScreen(false);
        navigate(`${res.payload.id}/edit`);
        return true;
      })
      .catch(() => {
        return false;
      });
  };

  const _onChangeGlobalSettings = ({
    pointRadius, displayLegend, dateRange, includeZeros, timeInterval, currentEndDate,
    fixedStartDate, maxValue, minValue, xLabelTicks, stacked, horizontal, dataLabels,
    dateVarsFormat,
  }) => {
    const tempChart = {
      pointRadius: typeof pointRadius !== "undefined" ? pointRadius : newChart.pointRadius,
      displayLegend: typeof displayLegend !== "undefined" ? displayLegend : newChart.displayLegend,
      startDate: dateRange?.startDate || dateRange?.startDate === null
        ? dateRange.startDate : newChart.startDate,
      endDate: dateRange?.endDate || dateRange?.endDate === null
        ? dateRange.endDate : newChart.endDate,
      timeInterval: timeInterval || newChart.timeInterval,
      includeZeros: typeof includeZeros !== "undefined" ? includeZeros : newChart.includeZeros,
      currentEndDate: typeof currentEndDate !== "undefined" ? currentEndDate : newChart.currentEndDate,
      fixedStartDate: typeof fixedStartDate !== "undefined" ? fixedStartDate : newChart.fixedStartDate,
      minValue: typeof minValue !== "undefined" ? minValue : newChart.minValue,
      maxValue: typeof maxValue !== "undefined" ? maxValue : newChart.maxValue,
      xLabelTicks: typeof xLabelTicks !== "undefined" ? xLabelTicks : newChart.xLabelTicks,
      stacked: typeof stacked !== "undefined" ? stacked : newChart.stacked,
      horizontal: typeof horizontal !== "undefined" ? horizontal : newChart.horizontal,
      dataLabels: typeof dataLabels !== "undefined" ? dataLabels : newChart.dataLabels,
      dateVarsFormat: dateVarsFormat !== "undefined" ? dateVarsFormat : newChart.dateVarsFormat,
    };

    let skipParsing = false;
    if (pointRadius
      || displayLegend
      || minValue
      || maxValue
      || xLabelTicks
      || stacked
      || horizontal
    ) {
      skipParsing = true;
    }

    _onChangeChart(tempChart, skipParsing);
  };

  const _onChangeChart = (data, skipParsing) => {
    let shouldSkipParsing = skipParsing;
    setNewChart({ ...newChart, ...data });
    setLoading(true);
    return dispatch(updateChart({ project_id: params.projectId, chart_id: params.chartId, data }))
      .then((newData) => {
        if (!toastOpen) {
          toast.success("Updated the chart 📈", {
            onClose: () => setToastOpen(false),
            onOpen: () => setToastOpen(true),
          });
        }

        if (skipParsing || data.datasetColor || data.fillColor || data.type) {
          shouldSkipParsing = true;
        }

        // run the preview refresh only when it's needed
        if (!data.name) {
          if (data.subType || data.type) {
            _onRefreshData();
          } else {
            _onRefreshPreview(shouldSkipParsing);
          }
        }

        setLoading(false);
        return Promise.resolve(newData);
      })
      .catch((e) => {
        toast.error("Oups! Can't save the chart. Please try again.");
        setLoading(false);
        return Promise.reject(e);
      });
  };

  const _onRefreshData = () => {
    if (!params.chartId) return;

    const getCache = !invalidateCache;

    dispatch(runQuery({
      project_id: params.projectId,
      chart_id: params.chartId,
      noSource: false,
      skipParsing: false,
      getCache
    }))
      .then(() => {
        if (conditions.length > 0) {
          return dispatch(runQueryWithFilters({
            project_id: params.projectId,
            chart_id: newChart.id,
            filters: conditions,
          }));
        }

        return true;
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        toast.error("We couldn't fetch the data. Please check your dataset settings and try again", {
          autoClose: 2500,
        });
        setLoading(false);
      });
  };

  const _onRefreshPreview = (skipParsing = true) => {
    if (!params.chartId) return;
    dispatch(runQuery({
      project_id: params.projectId,
      chart_id: params.chartId,
      noSource: true,
      skipParsing,
      getCache: true
    }))
      .then(() => {
        if (conditions.length > 0) {
          return dispatch(runQueryWithFilters({
            project_id: params.projectId,
            chart_id: newChart.id,
            filters: conditions
          }));
        }

        return true;
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const _changeTour = (tut) => {
    changeTutorial(tut);
  };

  const _onCloseTour = () => {
    completeTutorial();
  };

  const _onCancelWalkthrough = () => {
    setStartTutorial(false);
    // complete all AddChart-related tutorials
    // TODO: find a better way of doing this
    return completeTutorial("addchart")
      .then(() => completeTutorial("dataset"))
      .then(() => completeTutorial("apibuilder"))
      .then(() => completeTutorial("mongobuilder"))
      .then(() => completeTutorial("sqlbuilder"))
      .then(() => completeTutorial("requestmodal"))
      .then(() => completeTutorial("datasetdata"))
      .then(() => completeTutorial("drsettings"));
  };

  const _onAddFilter = (condition) => {
    let found = false;
    const newConditions = conditions.map((c) => {
      let newCondition = c;
      if (c.id === condition.id) {
        newCondition = condition;
        found = true;
      }
      return newCondition;
    });
    if (!found) newConditions.push(condition);
    setConditions(newConditions);

    dispatch(runQueryWithFilters({
      project_id: params.projectId,
      chart_id: newChart.id,
      filters: [condition]
    }));
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    dispatch(runQueryWithFilters({
      project_id: params.projectId,
      chart_id: newChart.id,
      filters: [condition],
    }));
  };

  if (titleScreen) {
    return (
      <div style={{ textAlign: "center" }}>
        <ChartDescription
          name={chartName}
          onChange={_onNameChange}
          onCreate={_onCreateClicked}
          teamId={params.teamId}
          projectId={params.projectId}
          connections={connections}
          templates={templates}
          noConnections={connections.length === 0}
        />
        <Spacer y={2} />
      </div>
    );
  }

  return (
    <div style={styles.container(height)} className="md:pl-4 md:pr-4">
      <ToastContainer
        position="bottom-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={isDark ? "dark" : "light"}
      />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <Row align="center" wrap="wrap" justify="space-between">
            <Row className="chart-name-tut">
              {!editingTitle
                && (
                  <Tooltip content="Edit the chart name">
                    <LinkNext onPress={() => setEditingTitle(true)} className="flex items-center" color="primary">
                      <LuPencilLine />
                      <Spacer x={0.5} />
                      <Text b>
                        {newChart.name}
                      </Text>
                    </LinkNext>
                  </Tooltip>
                )}

              {editingTitle && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  _onSubmitNewName();
                }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Input
                      placeholder="Enter a title"
                      value={chartName}
                      onChange={(e) => _onNameChange(e.target.value)}
                      variant="bordered"
                      size="sm"
                    />
                    <Spacer x={0.5} />
                    <Button
                      color="secondary"
                      type="submit"
                      onClick={_onSubmitNewName}
                      size="sm"
                    >
                      Save
                    </Button>
                  </div>
                </form>
              )}
            </Row>
            <Row className="chart-actions-tut" align="center" justify="flex-end">
              <div style={{ display: "flex" }}>
                <Switch
                  isSelected={newChart.draft}
                  onChange={() => _onChangeChart({ draft: !newChart.draft })}
                  size="sm"
                />
                <Spacer x={0.5} />
                <Text>Draft</Text>
              </div>
              <Spacer x={4} />
              <Button
                color={saveRequired ? "primary" : "success"}
                onClick={() => _onChangeChart({})}
                isLoading={loading}
                size="sm"
                variant={saveRequired ? "solid" : "flat"}
              >
                {saveRequired && "Save chart"}
                {!saveRequired && "Chart saved"}
              </Button>
            </Row>
          </Row>
          <Spacer y={2} />
          <Row className="chart-type-tut bg-content1 pt-4 pb-2 rounded-lg">
            <ChartPreview
              chart={newChart}
              onChange={_onChangeChart}
              onRefreshData={_onRefreshData}
              onRefreshPreview={_onRefreshPreview}
              onAddFilter={_onAddFilter}
              onClearFilter={_onClearFilter}
              conditions={conditions}
              datasets={datasets}
              invalidateCache={invalidateCache}
              changeCache={() => setInvalidateCache(!invalidateCache)}
            />
          </Row>
          <Spacer y={4} />
          <Row>
            {params.chartId && newChart.type && newChart.ChartDatasetConfigs?.length > 0 && (
              <ChartSettings
                type={newChart.type}
                pointRadius={newChart.pointRadius}
                startDate={newChart.startDate}
                endDate={newChart.endDate}
                displayLegend={newChart.displayLegend}
                includeZeros={newChart.includeZeros}
                currentEndDate={newChart.currentEndDate}
                fixedStartDate={newChart.fixedStartDate}
                timeInterval={newChart.timeInterval}
                onChange={_onChangeGlobalSettings}
                onComplete={(skipParsing = false) => _onRefreshPreview(skipParsing)}
                maxValue={newChart.maxValue}
                minValue={newChart.minValue}
                xLabelTicks={newChart.xLabelTicks}
                stacked={newChart.stacked}
                horizontal={newChart.horizontal}
                dateVarsFormat={newChart.dateVarsFormat}
                dataLabels={newChart.dataLabels}
              />
            )}
          </Row>
        </div>

        <div className="col-span-12 md:col-span-5 add-dataset-tut">
          <div className={"bg-content1 rounded-lg mx-auto p-4 w-full"}>
            <ChartDatasets chartId={newChart.id} />
          </div>
        </div>
      </div>

      <Walkthrough
        tourActive={tutorial}
        closeTour={_onCloseTour}
        userTutorials={user.tutorials}
      />

      <Modal isOpen={startTutorial} onClose={() => setStartTutorial(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">
              Welcome to the chart builder!
            </Text>
          </ModalHeader>
          <ModalBody>
            <Text b>{"This is the place where your charts will take shape."}</Text>
            <Spacer y={1} />
            <Text>
              {"It is recommended that you read through the next steps to get familiar with the interface. "}
              {"You can always restart the tutorial from the upper right corner at any later time."}
            </Text>
            <Spacer y={1} />
            <Text>{"But without further ado, let's get started"}</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={_onCancelWalkthrough} variant="flat" color="warning">
              Cancel walkthrough
            </Button>
            <Button
              color="success"
              onClick={() => {
                setStartTutorial(false);
                _changeTour("addchart");
              }}
              endContent={<LuArrowRight />}
            >
              Get started
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

const styles = {
  container: (height) => ({
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
    minHeight: height,
  }),
  mainContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  mainSegment: {
    minHeight: 600,
  },
  topBuffer: {
    marginTop: 20,
  },
  addDataset: {
    marginTop: 10,
  },
  datasetButtons: {
    marginBottom: 10,
    marginRight: 3,
  },
  editTitle: {
    cursor: "pointer",
  },
  tutorialBtn: {
    boxShadow: "none",
    marginTop: -10,
  },
};

AddChart.propTypes = {
  getChartDatasets: PropTypes.func.isRequired,
  saveNewDataset: PropTypes.func.isRequired,
  updateDataset: PropTypes.func.isRequired,
  deleteDataset: PropTypes.func.isRequired,
  datasets: PropTypes.array.isRequired,
  user: PropTypes.object.isRequired,
  tutorial: PropTypes.string.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  completeTutorial: PropTypes.func.isRequired,
  resetTutorial: PropTypes.func.isRequired,
  clearDatasets: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  getTemplates: PropTypes.func.isRequired,
  templates: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    datasets: state.dataset.data,
    user: state.user.data,
    tutorial: state.tutorial,
    connections: state.connection.data,
    templates: state.template,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getChartDatasets: (projectId, chartId) => {
      return dispatch(getChartDatasetsAction(projectId, chartId));
    },
    saveNewDataset: (projectId, chartId, data) => {
      return dispatch(saveNewDatasetAction(projectId, chartId, data));
    },
    updateDataset: (projectId, chartId, datasetId, data) => {
      return dispatch(updateDatasetAction(projectId, chartId, datasetId, data));
    },
    deleteDataset: (projectId, chartId, datasetId) => {
      return dispatch(deleteDatasetAction(projectId, chartId, datasetId));
    },
    updateUser: (id, data) => dispatch(updateUserAction(id, data)),
    changeTutorial: (tut) => dispatch(changeTutorialAction(tut)),
    completeTutorial: (tut) => dispatch(completeTutorialAction(tut)),
    resetTutorial: (tut) => dispatch(resetTutorialAction(tut)),
    clearDatasets: () => dispatch(clearDatasetsAction()),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(AddChart);
