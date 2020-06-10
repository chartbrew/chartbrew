import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Icon, Header, Divider, Popup, Container,
  Form, Input, List, Message,
} from "semantic-ui-react";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import _ from "lodash";

import ChartPreview from "./components/ChartPreview";
import ChartSettings from "./components/ChartSettings";
import Dataset from "./components/Dataset";
import ChartDescription from "./components/ChartDescription";

import {
  createChart as createChartAction,
  updateChart as updateChartAction,
  runQuery as runQueryAction,
} from "../../actions/chart";
import {
  getChartDatasets as getChartDatasetsAction,
  saveNewDataset as saveNewDatasetAction,
  updateDataset as updateDatasetAction,
  deleteDataset as deleteDatasetAction,
} from "../../actions/dataset";
import { chartColors } from "../../config/colors";

/*
  Container used for setting up a new chart
*/
function AddChart(props) {
  const [activeDataset, setActiveDataset] = useState({});
  const [titleScreen, setTitleScreen] = useState(true);
  const [newChart, setNewChart] = useState({ name: "Test chart" });
  const [editingTitle, setEditingTitle] = useState(false);
  const [addingDataset, setAddingDataset] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [savingDataset, setSavingDataset] = useState(false);
  const [chartName, setChartName] = useState("");

  const {
    match, createChart, history, charts, saveNewDataset, getChartDatasets,
    datasets, updateDataset, deleteDataset, updateChart, runQuery,
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
    }
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

  const _onDatasetClicked = (dataset) => {
    setActiveDataset(dataset);
  };

  const _onNameChange = (value) => {
    setChartName(value);
  };

  const _onSubmitNewName = () => {
    setEditingTitle(false);
    _onChangeChart({ name: chartName });
  };

  const _onCreateClicked = () => {
    return createChart(match.params.projectId, newChart)
      .then((createdChart) => {
        setTitleScreen(false);
        history.push(`chart/${createdChart.id}/edit`);
      })
      .catch(() => {
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
        setActiveDataset(dataset);
        setDatasetName("");
      })
      .catch(() => {
        setSavingDataset(false);
      });
  };

  const _onUpdateDataset = (newDataset) => {
    return updateDataset(
      match.params.projectId,
      match.params.chartId,
      activeDataset.id,
      newDataset
    )
      .then((dataset) => {
        setActiveDataset(dataset);
        toast.success("Updated the dataset 👌", {
          position: "top-right",
          autoClose: 1500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          transition: Flip,
        });
        _onRefreshPreview();
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

  const _onChangeChart = (data) => {
    setNewChart({ ...newChart, ...data });
    return updateChart(match.params.projectId, match.params.chartId, data)
      .then((newData) => {
        toast.success("Updated the chart 📈");
        return Promise.resolve(newData);
      })
      .catch((e) => {
        toast.error("Oups! Can't save the chart. Please try again.");
        return Promise.reject(e);
      });
  };

  const _onRefreshData = () => {
    runQuery(match.params.projectId, match.params.chartId);
  };

  const _onRefreshPreview = () => {
    runQuery(match.params.projectId, match.params.chartId, true);
  };

  if (titleScreen) {
    return (
      <ChartDescription
        name={newChart.name}
        onChange={_onNameChange}
        onCreate={_onCreateClicked}
        history={history}
      />
    );
  }

  return (
    <div style={styles.container}>
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
        <Grid.Column width={9}>
          <div>
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
                <Container fluid textAlign="left">
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
                </Container>
              )}
            <Divider />
            <ChartPreview
              chart={newChart}
              onChange={_onChangeChart}
              onRefreshData={_onRefreshData}
              onRefreshPreview={_onRefreshPreview}
            />
          </div>
          <div style={styles.topBuffer}>
            <ChartSettings />
          </div>
        </Grid.Column>

        <Grid.Column width={6}>
          <Header>Datasets</Header>
          <Divider />

          <div>
            {datasets && datasets.map((dataset) => {
              return (
                <Button
                  style={styles.datasetButtons}
                  key={dataset.id}
                  primary
                  onClick={() => _onDatasetClicked(dataset)}
                  basic={dataset.id !== activeDataset.id}
                >
                  {dataset.legend}
                </Button>
              );
            })}
          </div>

          <div style={styles.addDataset}>
            {!addingDataset && (
              <List>
                <List.Item as="a" onClick={() => setAddingDataset(true)}>
                  <Icon name="plus" />
                  <List.Content>
                    <List.Header>Add a new dataset</List.Header>
                  </List.Content>
                </List.Item>
              </List>
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
                      secondary
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
          {activeDataset.id && (
            <Dataset
              dataset={activeDataset}
              onUpdate={_onUpdateDataset}
              onDelete={_onDeleteDataset}
              chart={newChart}
            />
          )}
          {!activeDataset.id && (
            <Message
              content="Select or create a dataset above"
            />
          )}
        </Grid.Column>
      </Grid>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: "white",
  },
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
  }
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
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
    datasets: state.dataset.data,
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
    runQuery: (projectId, chartId, noSource) => {
      return dispatch(runQueryAction(projectId, chartId, noSource));
    },
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AddChart));
