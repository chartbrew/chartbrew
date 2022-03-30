import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Icon, Header, Divider, Popup,
  Form, Input, List, Message, Checkbox, Modal, TransitionablePortal,
} from "semantic-ui-react";
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
import ChartFilters from "../Chart/components/ChartFilters";

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
  const [datasetName, setDatasetName] = useState("");
  const [savingDataset, setSavingDataset] = useState(false);
  const [chartName, setChartName] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saveRequired, setSaveRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [startTutorial, setStartTutorial] = useState(false);
  const [resetingTutorial, setResetingTutorial] = useState(false);
  const [conditions, setConditions] = useState([]);

  const { height } = useWindowSize();

  const {
    match, createChart, history, charts, saveNewDataset, getChartDatasets, tutorial,
    datasets, updateDataset, deleteDataset, updateChart, runQuery, user, changeTutorial,
    completeTutorial, clearDatasets, resetTutorial, connections, templates, getTemplates,
    runQueryWithFilters,
  } = props;

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
    setSavingDataset(true);
    saveNewDataset(match.params.projectId, match.params.chartId, {
      chart_id: match.params.chartId,
      legend: datasetName,
      datasetColor: chartColors[Math.floor(Math.random() * chartColors.length)],
      fillColor: ["rgba(0,0,0,0)"],
    })
      .then((dataset) => {
        setSavingDataset(false);
        setAddingDataset(false);
        _onDatasetChanged(dataset);
        setDatasetName("");
      })
      .catch(() => {
        setSavingDataset(false);
      });
  };

  const _onUpdateDataset = (newDataset, skipParsing) => {
    return updateDataset(
      match.params.projectId,
      match.params.chartId,
      activeDataset.id,
      newDataset
    )
      .then((dataset) => {
        if (!toastOpen) {
          toast.success("Updated the dataset 👌", {
            onClose: () => setToastOpen(false),
            onOpen: () => setToastOpen(true),
          });
        }

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
      })
      .catch(() => {
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

  if (titleScreen) {
    return (
      <div style={{ textAlign: "center" }}>
        <Divider hidden />
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
      </div>
    );
  }

  return (
    <div style={styles.container(height)}>
      <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
      />
      <Grid columns={2} divided centered stackable>
        <Grid.Column width={8}>
          <div>
            <div style={{ display: "flex" }}>
              <div style={{ flex: 0.5 }} className="chart-name-tut">
                {!editingTitle
                  && (
                    <Header textAlign="left" onClick={() => setEditingTitle(true)}>
                      <Popup
                        trigger={(
                          <a style={styles.editTitle}>
                            {newChart.name}
                          </a>
                        )}
                        content="Edit the chart name"
                      />
                    </Header>
                  )}

                {editingTitle
                  && (
                    <Form style={{ display: "inline-block" }}>
                      <Form.Group>
                        <Form.Field>
                          <Input
                            placeholder="Enter a title"
                            value={chartName}
                            onChange={(e, data) => _onNameChange(data.value)}
                          />
                        </Form.Field>
                        <Form.Field>
                          <Button
                            secondary
                            icon
                            labelPosition="right"
                            type="submit"
                            onClick={_onSubmitNewName}
                          >
                            <Icon name="checkmark" />
                            Save
                          </Button>
                        </Form.Field>
                      </Form.Group>
                    </Form>
                  )}
              </div>
              <div style={{ flex: 0.5, textAlign: "right" }} className="chart-actions-tut">
                <Checkbox
                  label="Draft"
                  toggle
                  style={{ marginRight: 20 }}
                  checked={newChart.draft}
                  onChange={() => _onChangeChart({ draft: !newChart.draft })}
                />
                <Button
                  primary={saveRequired}
                  positive={!saveRequired}
                  icon
                  labelPosition="right"
                  onClick={() => _onChangeChart({})}
                  loading={loading}
                >
                  <Icon name={saveRequired ? "save" : "checkmark"} />
                  {saveRequired && "Save chart"}
                  {!saveRequired && "Chart saved"}
                </Button>
              </div>
            </div>
            <Divider />
            <div>
              <Popup
                trigger={(
                  <Button
                    primary
                    icon="filter"
                    direction="left"
                    className="tertiary"
                    style={styles.filterBtn}
                    content="Exposed filters"
                  />
                )}
                on="click"
                position="left center"
              >
                <ChartFilters
                  chart={newChart}
                  onAddFilter={_onAddFilter}
                  onClearFilter={_onClearFilter}
                  conditions={conditions}
                />
              </Popup>
            </div>
            <div className="chart-type-tut">
              <ChartPreview
                chart={newChart}
                onChange={_onChangeChart}
                onRefreshData={_onRefreshData}
                onRefreshPreview={_onRefreshPreview}
                onAddFilter={_onAddFilter}
                onClearFilter={_onClearFilter}
                conditions={conditions}
              />
            </div>
          </div>
          <div style={styles.topBuffer}>
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
          </div>
        </Grid.Column>

        <Grid.Column width={7} className="add-dataset-tut">
          <Header size="small" dividing>
            Datasets
            <Popup
              trigger={(
                <Button
                  basic
                  onClick={_onResetTutorial}
                  icon="student"
                  loading={resetingTutorial}
                  floated="right"
                  style={styles.tutorialBtn}
                  content="Tutorial"
                />
              )}
              content="Start the chart builder tutorial"
              position="top right"
            />
          </Header>

          <div>
            {datasets && datasets.map((dataset) => {
              return (
                <Button
                  style={styles.datasetButtons}
                  key={dataset.id}
                  primary
                  onClick={() => _onDatasetChanged(dataset)}
                  basic={dataset.id !== activeDataset.id}
                >
                  {dataset.legend}
                </Button>
              );
            })}
          </div>

          <div style={styles.addDataset}>
            {!addingDataset && datasets.length > 0 && (
              <List>
                <List.Item as="a" onClick={() => setAddingDataset(true)}>
                  <Icon name="plus" />
                  <List.Content>
                    <List.Header>Add a new dataset</List.Header>
                  </List.Content>
                </List.Item>
              </List>
            )}

            {!addingDataset && datasets.length === 0 && (
              <Button
                primary
                icon
                labelPosition="right"
                size="large"
                onClick={() => setAddingDataset(true)}
              >
                <Icon name="plus" />
                Add the first dataset
              </Button>
            )}

            {addingDataset && (
              <Form>
                <Form.Group>
                  <Form.Field>
                    <Input
                      placeholder="Dataset name"
                      value={datasetName}
                      onChange={(e, data) => setDatasetName(data.value)}
                    />
                  </Form.Field>
                  <Form.Field>
                    <Button
                      icon
                      primary
                      onClick={_onSaveNewDataset}
                      loading={savingDataset}
                    >
                      <Icon name="checkmark" />
                    </Button>
                    <Button
                      icon
                      basic
                      onClick={() => {
                        setAddingDataset(false);
                        setDatasetName("");
                      }}
                    >
                      <Icon name="x" />
                    </Button>
                  </Form.Field>
                </Form.Group>
              </Form>
            )}
          </div>

          <Divider />
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
              />
              </div>
            );
          })}
          {!activeDataset.id && (
            <Message
              content="Select or create a dataset above"
            />
          )}
        </Grid.Column>
      </Grid>

      <Walkthrough
        tourActive={tutorial}
        closeTour={_onCloseTour}
        userTutorials={user.tutorials}
      />

      <TransitionablePortal open={startTutorial}>
        <Modal open={startTutorial} onClose={() => setStartTutorial(false)}>
          <Modal.Header>Welcome to the chart builder!</Modal.Header>
          <Modal.Content>
            <Header>{"This is the place where your charts will take shape."}</Header>
            <p>
              {"It is recommended that you read through the next steps to get familiar with the interface. "}
              {"You can always restart the tutorial from the upper right corner at any later time."}
            </p>
            <p>{"But without further ado, let's get started"}</p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              content="Cancel walkthrough"
              onClick={_onCancelWalkthrough}
            />
            <Button
              positive
              icon
              labelPosition="right"
              onClick={() => {
                setStartTutorial(false);
                _changeTour("addchart");
              }}
            >
              <Icon name="chevron right" />
              Get started
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
    </div>
  );
}

const styles = {
  container: (height) => ({
    flex: 1,
    paddingTop: 20,
    backgroundColor: "white",
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
