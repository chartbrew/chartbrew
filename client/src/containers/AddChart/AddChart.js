import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Container, Link as LinkNext, Grid, Spacer, Tooltip, Row, Input, Button,
  Switch, Text, Loading, Modal, Divider, Badge, useTheme,
} from "@nextui-org/react";
import {
  ChevronLeftCircle,
  ChevronRight, ChevronRightCircle, CloseSquare, Discovery, Edit, Plus, Swap, TickSquare,
} from "react-iconly";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import _ from "lodash";
import { useWindowSize } from "react-use";

import ChartPreview from "./components/ChartPreview";
import ChartSettings from "./components/ChartSettings";
import Dataset from "./components/Dataset";
import ChartDescription from "./components/ChartDescription";
import Walkthrough from "./components/Walkthrough";
import {
  createChart as createChartAction,
  updateChart as updateChartAction,
  runQuery as runQueryAction,
  runQueryWithFilters as runQueryWithFiltersAction,
} from "../../actions/chart";
import {
  getChartDatasets as getChartDatasetsAction,
  saveNewDataset as saveNewDatasetAction,
  updateDataset as updateDatasetAction,
  deleteDataset as deleteDatasetAction,
  clearDatasets as clearDatasetsAction,
} from "../../actions/dataset";
import { updateUser as updateUserAction } from "../../actions/user";
import {
  getTemplates as getTemplatesAction
} from "../../actions/template";
import { chartColors } from "../../config/colors";
import {
  changeTutorial as changeTutorialAction,
  completeTutorial as completeTutorialAction,
  resetTutorial as resetTutorialAction,
} from "../../actions/tutorial";

/*
  Container used for setting up a new chart
*/
function AddChart(props) {
  const [activeDataset, setActiveDataset] = useState({});
  const [titleScreen, setTitleScreen] = useState(true);
  const [newChart, setNewChart] = useState({
    type: "line",
    subType: "lcTimeseries",
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [addingDataset, setAddingDataset] = useState(false);
  const [savingDataset, setSavingDataset] = useState(false);
  const [chartName, setChartName] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saveRequired, setSaveRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [startTutorial, setStartTutorial] = useState(false);
  const [resetingTutorial, setResetingTutorial] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [updatingDataset, setUpdatingDataset] = useState(false);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [datasetsOrder, setDatasetsOrder] = useState([]);
  const [arrangementLoading, setArrangementLoading] = useState(false);

  const { height } = useWindowSize();

  const {
    match, createChart, history, charts, saveNewDataset, getChartDatasets, tutorial,
    datasets, updateDataset, deleteDataset, updateChart, runQuery, user, changeTutorial,
    completeTutorial, clearDatasets, resetTutorial, connections, templates, getTemplates,
    runQueryWithFilters,
  } = props;

  const { isDark } = useTheme();

  useEffect(() => {
    if (match.params.chartId) {
      charts.map((chart) => {
        if (chart.id === parseInt(match.params.chartId, 10)) {
          setNewChart(chart);
        }
        return chart;
      });
      setTitleScreen(false);

      // also fetch the chart's datasets
      getChartDatasets(match.params.projectId, match.params.chartId);
    } else {
      clearDatasets();
    }

    if (user && (!user.tutorials || Object.keys(user.tutorials).length === 0)) {
      setTimeout(() => {
        setStartTutorial(true);
      }, 1000);
    }

    getTemplates(match.params.teamId);
  }, []);

  useEffect(() => {
    charts.map((chart) => {
      if (chart.id === parseInt(match.params.chartId, 10)) {
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
      if (chart.id === parseInt(match.params.chartId, 10)) {
        if (!_.isEqual(chart, newChart)) {
          setSaveRequired(true);
          found = true;
        }
      }
      return chart;
    });
    if (!found) setSaveRequired(false);
  }, [newChart]);

  useEffect(() => {
    if (datasets.length > 0) {
      const dOrder = [];
      datasets.forEach((d) => dOrder.push(d));
      setDatasetsOrder(dOrder);
    }
  }, [datasets]);

  const _onDatasetChanged = (dataset) => {
    setActiveDataset(dataset);
    setTimeout(() => {
      _changeTour("dataset");
    }, 1000);
  };

  const _onNameChange = (value) => {
    setChartName(value);
  };

  const _onSubmitNewName = () => {
    setEditingTitle(false);
    _onChangeChart({ name: chartName });
  };

  const _onCreateClicked = () => {
    const tempChart = { ...newChart, name: chartName };
    return createChart(match.params.projectId, tempChart)
      .then((createdChart) => {
        setNewChart(createdChart);
        setTitleScreen(false);
        history.push(`chart/${createdChart.id}/edit`);
        return true;
      })
      .catch(() => {
        return false;
      });
  };

  const _onSaveNewDataset = () => {
    if (savingDataset || addingDataset) return;
    setSavingDataset(true);
    saveNewDataset(match.params.projectId, match.params.chartId, {
      chart_id: match.params.chartId,
      legend: `Dataset #${datasets.length + 1}`,
      datasetColor: chartColors[Math.floor(Math.random() * chartColors.length)],
      fillColor: ["rgba(0,0,0,0)"],
    })
      .then((dataset) => {
        setSavingDataset(false);
        setAddingDataset(false);
        setTimeout(() => {
          _onDatasetChanged(dataset);
        }, 100);
      })
      .catch(() => {
        setSavingDataset(false);
      });
  };

  const _onUpdateDataset = (newDataset, skipParsing) => {
    setUpdatingDataset(true);
    return updateDataset(
      match.params.projectId,
      match.params.chartId,
      activeDataset.id,
      newDataset
    )
      .then((dataset) => {
        // determine wether to do a full refresh or not
        if (activeDataset.xAxis !== dataset.xAxis
          || activeDataset.yAxis !== dataset.yAxis
          || activeDataset.yAxisOperation !== dataset.yAxisOperation
          || activeDataset.dateField !== dataset.dateField
          || activeDataset.groups !== dataset.groups
        ) {
          _onRefreshData();
        } else {
          _onRefreshPreview(skipParsing);
        }

        setActiveDataset(dataset);
        setUpdatingDataset(false);
      })
      .catch(() => {
        setUpdatingDataset(false);
        toast.error("Cannot update the dataset 😫 Please try again", {
          autoClose: 2500,
        });
      });
  };

  const _onDeleteDataset = () => {
    return deleteDataset(match.params.projectId, match.params.chartId, activeDataset.id)
      .then(() => {
        setActiveDataset({});
      })
      .catch(() => {
        toast.error("Cannot delete the dataset 😫 Please try again", {
          autoClose: 2500,
        });
      });
  };

  const _onChangeGlobalSettings = ({
    pointRadius, displayLegend, dateRange, includeZeros, timeInterval, currentEndDate,
    maxValue, minValue, xLabelTicks, stacked,
  }) => {
    const tempChart = {
      pointRadius: typeof pointRadius !== "undefined" ? pointRadius : newChart.pointRadius,
      displayLegend: typeof displayLegend !== "undefined" ? displayLegend : newChart.displayLegend,
      startDate: dateRange ? dateRange.startDate : newChart.startDate,
      endDate: dateRange ? dateRange.endDate : newChart.endDate,
      timeInterval: timeInterval || newChart.timeInterval,
      includeZeros: typeof includeZeros !== "undefined" ? includeZeros : newChart.includeZeros,
      currentEndDate: typeof currentEndDate !== "undefined" ? currentEndDate : newChart.currentEndDate,
      minValue: typeof minValue !== "undefined" ? minValue : newChart.minValue,
      maxValue: typeof maxValue !== "undefined" ? maxValue : newChart.maxValue,
      xLabelTicks: typeof xLabelTicks !== "undefined" ? xLabelTicks : newChart.xLabelTicks,
      stacked: typeof stacked !== "undefined" ? stacked : newChart.stacked,
    };

    let skipParsing = false;
    if (pointRadius || displayLegend || minValue || maxValue || xLabelTicks || stacked) {
      skipParsing = true;
    }

    _onChangeChart(tempChart, skipParsing);
  };

  const _onChangeChart = (data, skipParsing) => {
    let shouldSkipParsing = skipParsing;
    setNewChart({ ...newChart, ...data });
    setLoading(true);
    return updateChart(match.params.projectId, match.params.chartId, data)
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
          _onRefreshPreview(shouldSkipParsing);
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

  const _onRefreshData = (getCache) => {
    runQuery(match.params.projectId, match.params.chartId, false, false, getCache)
      .then(() => {
        if (conditions.length > 0) {
          return runQueryWithFilters(match.params.projectId, newChart.id, conditions);
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

  const _onRefreshPreview = (skipParsing = true) => {
    runQuery(match.params.projectId, match.params.chartId, true, skipParsing, true)
      .then(() => {
        if (conditions.length > 0) {
          return runQueryWithFilters(match.params.projectId, newChart.id, conditions);
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
      .then(() => completeTutorial("datasetdata"));
  };

  const _onResetTutorial = () => {
    setResetingTutorial(true);
    return resetTutorial([
      "addchart",
      "dataset",
      "apibuilder",
      "mongobuilder",
      "sqlbuilder",
      "requestmodal",
      "datasetdata",
    ])
      .then(() => {
        changeTutorial("addchart");
        setResetingTutorial(false);
      })
      .catch(() => setResetingTutorial(false));
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

    runQueryWithFilters(match.params.projectId, newChart.id, [condition]);
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    runQueryWithFilters(match.params.projectId, newChart.id, [condition]);
  };

  const _onSaveArrangement = () => {
    const promiseData = [];
    setArrangementLoading(true);

    datasetsOrder.forEach((d, index) => {
      promiseData.push(
        updateDataset(
          match.params.projectId,
          match.params.chartId,
          d.id,
          { order: index },
        ),
      );
    });

    Promise.all(promiseData)
      .then(() => {
        setArrangementLoading(false);
        setArrangeMode(false);
        _onRefreshData(true);
        getChartDatasets(match.params.projectId, match.params.chartId);
      })
      .catch(() => {
        toast.error("Oups! Can't save the arrangement. Please try again.");
        setArrangeMode(false);
        setArrangementLoading(false);
      });
  };

  const _changeDatasetOrder = (dId, direction) => {
    const newDatasetsOrder = [...datasetsOrder];
    const index = _.findIndex(datasetsOrder, { id: dId });
    if (direction === "up") {
      if (index === 0) return;
      newDatasetsOrder[index] = datasetsOrder[index - 1];
      newDatasetsOrder[index - 1] = datasetsOrder[index];
    } else {
      if (index === datasetsOrder.length - 1) return;
      newDatasetsOrder[index] = datasetsOrder[index + 1];
      newDatasetsOrder[index + 1] = datasetsOrder[index];
    }

    setDatasetsOrder(newDatasetsOrder);
  };

  if (titleScreen) {
    return (
      <div style={{ textAlign: "center" }}>
        <ChartDescription
          name={chartName}
          onChange={_onNameChange}
          onCreate={_onCreateClicked}
          history={history}
          teamId={match.params.teamId}
          projectId={match.params.projectId}
          connections={connections}
          templates={templates}
          noConnections={connections.length === 0}
        />
        <Spacer y={2} />
      </div>
    );
  }

  return (
    <div style={styles.container(height)}>
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
      <Grid.Container>
        <Grid xs={12} sm={6} md={7}>
          <Container>
            <Row align="center" wrap="wrap" justify="space-between">
              <Row style={{ flex: 0.6 }} className="chart-name-tut">
                {!editingTitle
                  && (
                    <Tooltip content="Edit the chart name">
                      <LinkNext onClick={() => setEditingTitle(true)} css={{ ai: "center" }} color="primary">
                        <Edit />
                        <Spacer x={0.2} />
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
                        bordered
                      />
                      <Spacer x={0.2} />
                      <Button
                        color="secondary"
                        type="submit"
                        onClick={_onSubmitNewName}
                        auto
                      >
                        Save
                      </Button>
                    </div>
                  </form>
                )}
              </Row>
              <Row style={{ flex: 0.4 }} className="chart-actions-tut" align="center" justify="flex-end">
                <div style={{ display: "flex" }}>
                  <Switch
                    checked={newChart.draft}
                    onChange={() => _onChangeChart({ draft: !newChart.draft })}
                    size="sm"
                  />
                  <Spacer x={0.2} />
                  <Text>Draft</Text>
                </div>
                <Spacer x={1} />
                <Button
                  color={saveRequired ? "primary" : "success"}
                  onClick={() => _onChangeChart({})}
                  loading={loading}
                  size="sm"
                  auto
                >
                  {saveRequired && "Save chart"}
                  {!saveRequired && "Chart saved"}
                </Button>
              </Row>
            </Row>
            <Spacer y={1} />
            <Row className="chart-type-tut">
              <ChartPreview
                chart={newChart}
                onChange={_onChangeChart}
                onRefreshData={_onRefreshData}
                onRefreshPreview={_onRefreshPreview}
                onAddFilter={_onAddFilter}
                onClearFilter={_onClearFilter}
                conditions={conditions}
                datasets={datasets}
              />
            </Row>
            <Spacer y={1} />
            <Row>
              {match.params.chartId && newChart.type && datasets.length > 0 && (
                <ChartSettings
                  type={newChart.type}
                  pointRadius={newChart.pointRadius}
                  startDate={newChart.startDate}
                  endDate={newChart.endDate}
                  displayLegend={newChart.displayLegend}
                  includeZeros={newChart.includeZeros}
                  currentEndDate={newChart.currentEndDate}
                  timeInterval={newChart.timeInterval}
                  onChange={_onChangeGlobalSettings}
                  onComplete={(skipParsing = false) => _onRefreshPreview(skipParsing)}
                  maxValue={newChart.maxValue}
                  minValue={newChart.minValue}
                  xLabelTicks={newChart.xLabelTicks}
                  stacked={newChart.stacked}
                />
              )}
            </Row>
          </Container>
        </Grid>

        <Grid xs={12} sm={6} md={5} className="add-dataset-tut" css={{ pr: 10 }}>
          <Container
            css={{
              backgroundColor: "$backgroundContrast",
              br: "$md",
              "@xs": {
                p: 20,
              },
              "@sm": {
                p: 20,
              },
              "@md": {
                p: 20,
              },
            }}
          >
            <Row justify="space-between">
              <Text b>
                Datasets
              </Text>
              <Tooltip content="Start the chart builder tutorial" placement="leftStart">
                <LinkNext css={{ color: "$accents6", ai: "center" }} onClick={_onResetTutorial}>
                  {!resetingTutorial ? <Discovery /> : <Loading type="spinner" />}
                  <Spacer x={0.2} />
                  <Text>Tutorial</Text>
                </LinkNext>
              </Tooltip>
            </Row>
            <Spacer y={0.5} />
            <Divider />
            <Spacer y={0.5} />
            <Row wrap="wrap">
              {!arrangeMode && datasets && datasets.map((dataset) => {
                return (
                  <>
                    <Button
                      style={styles.datasetButtons}
                      key={dataset.id}
                      onClick={() => _onDatasetChanged(dataset)}
                      ghost={dataset.id !== activeDataset.id}
                      size="sm"
                      auto
                    >
                      {dataset.legend}
                    </Button>
                  </>
                );
              })}
              {arrangeMode && datasets && datasetsOrder.map((dataset, index) => {
                return (
                  <>
                    <Badge
                      style={styles.datasetButtons}
                      key={dataset.id}
                      isSquared
                      variant={"bordered"}
                      color="primary"
                      size="sm"
                    >
                      {index > 0 && (
                        <LinkNext onClick={() => _changeDatasetOrder(dataset.id, "up")}>
                          <ChevronLeftCircle size={16} />
                        </LinkNext>
                      )}
                      <Spacer x={0.2} />
                      {dataset.legend}
                      <Spacer x={0.2} />
                      {index < datasetsOrder.length - 1 && (
                        <LinkNext onClick={() => _changeDatasetOrder(dataset.id, "down")}>
                          <ChevronRightCircle size={16} />
                        </LinkNext>
                      )}
                    </Badge>
                  </>
                );
              })}
            </Row>

            <Row align="center" justify="space-between">
              {!addingDataset && datasets.length > 0 && (
                <>
                  <div>
                    <Button
                      onClick={() => _onSaveNewDataset()}
                      icon={!savingDataset ? <Plus /> : <Loading type="spinner" />}
                      auto
                      color="primary"
                      light
                    >
                      {!savingDataset ? <Text>{"Add a new dataset"}</Text> : <Text>{"Saving dataset"}</Text>}
                    </Button>
                  </div>
                  <div style={{ display: "flex", "flexDirection": "row", justifyContent: "flex-end" }}>
                    <Tooltip content={!arrangeMode ? "Arrange datasets" : "Save arrangement"} placement="leftStart">
                      <Button
                        onClick={() => {
                          if (!arrangeMode) setArrangeMode(true);
                          else _onSaveArrangement();
                        }}
                        icon={arrangeMode && arrangementLoading
                          ? <Loading type="spinner" />
                          : arrangeMode && !arrangementLoading
                            ? <TickSquare /> : <Swap />}
                        auto
                        color={arrangeMode ? "success" : "primary"}
                        light
                      />
                    </Tooltip>
                    {arrangeMode && (
                      <>
                        <Tooltip content="Cancel arrangement" placement="leftStart">
                          <Button
                            onClick={() => setArrangeMode(false)}
                            icon={<CloseSquare />}
                            light
                            color="warning"
                            auto
                          />
                        </Tooltip>
                      </>
                    )}
                  </div>
                </>
              )}

              {!addingDataset && datasets.length === 0 && (
                <Button
                  size="lg"
                  onClick={() => _onSaveNewDataset()}
                  disabled={savingDataset}
                  iconRight={<Plus />}
                  shadow
                  auto
                >
                  {savingDataset && <Loading type="points" />}
                  {!savingDataset && "Add the first dataset"}
                </Button>
              )}
            </Row>

            <Spacer y={1} />
            <Row align="center">
              {activeDataset.id && datasets.map((dataset) => {
                return (
                  <div style={activeDataset.id !== dataset.id ? { display: "none" } : {}} key={dataset.id}>
                    <Dataset
                      dataset={dataset}
                      onUpdate={(data, skipParsing = false) => _onUpdateDataset(data, skipParsing)}
                      onDelete={_onDeleteDataset}
                      chart={newChart}
                      onRefresh={_onRefreshData}
                      onRefreshPreview={_onRefreshPreview}
                      loading={updatingDataset}
                  />
                  </div>
                );
              })}
              {!activeDataset.id && (
                <Text css={{ color: "$accents6" }} h3>
                  {"Select or create a dataset above"}
                </Text>
              )}
            </Row>
          </Container>
        </Grid>
      </Grid.Container>

      <Walkthrough
        tourActive={tutorial}
        closeTour={_onCloseTour}
        userTutorials={user.tutorials}
      />

      <Modal open={startTutorial} onClose={() => setStartTutorial(false)}>
        <Modal.Header>
          <Text h3>
            Welcome to the chart builder!
          </Text>
        </Modal.Header>
        <Modal.Body>
          <Text b>{"This is the place where your charts will take shape."}</Text>
          <Spacer y={0.5} />
          <Text>
            {"It is recommended that you read through the next steps to get familiar with the interface. "}
            {"You can always restart the tutorial from the upper right corner at any later time."}
          </Text>
          <Spacer y={0.5} />
          <Text>{"But without further ado, let's get started"}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={_onCancelWalkthrough} flat color="warning">
            Cancel walkthrough
          </Button>
          <Button
            color="success"
            onClick={() => {
              setStartTutorial(false);
              _changeTour("addchart");
            }}
            iconRight={<ChevronRight />}
            auto
          >
            Get started
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

const styles = {
  container: (height) => ({
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
    // backgroundColor: "white",
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
  createChart: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
  getChartDatasets: PropTypes.func.isRequired,
  saveNewDataset: PropTypes.func.isRequired,
  updateDataset: PropTypes.func.isRequired,
  deleteDataset: PropTypes.func.isRequired,
  datasets: PropTypes.array.isRequired,
  updateChart: PropTypes.func.isRequired,
  runQuery: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  tutorial: PropTypes.string.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  completeTutorial: PropTypes.func.isRequired,
  resetTutorial: PropTypes.func.isRequired,
  clearDatasets: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  getTemplates: PropTypes.func.isRequired,
  templates: PropTypes.object.isRequired,
  runQueryWithFilters: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
    datasets: state.dataset.data,
    user: state.user.data,
    tutorial: state.tutorial,
    connections: state.connection.data,
    templates: state.template,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createChart: (projectId, data) => dispatch(createChartAction(projectId, data)),
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
    updateChart: (projectId, chartId, data) => {
      return dispatch(updateChartAction(projectId, chartId, data));
    },
    runQuery: (projectId, chartId, noSource, skipParsing, getCache) => {
      return dispatch(runQueryAction(projectId, chartId, noSource, skipParsing, getCache));
    },
    updateUser: (id, data) => dispatch(updateUserAction(id, data)),
    changeTutorial: (tut) => dispatch(changeTutorialAction(tut)),
    completeTutorial: (tut) => dispatch(completeTutorialAction(tut)),
    resetTutorial: (tut) => dispatch(resetTutorialAction(tut)),
    clearDatasets: () => dispatch(clearDatasetsAction()),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
    runQueryWithFilters: (projectId, chartId, filters) => (
      dispatch(runQueryWithFiltersAction(projectId, chartId, filters))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AddChart));
