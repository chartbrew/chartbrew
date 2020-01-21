import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Header, Step, Icon, Form, Dropdown, Input, Button, Popup, Dimmer, Loader,
  Segment, Message, Container, Divider, Sidebar, Grid, List, Modal,
} from "semantic-ui-react";
import {
  Line, Bar, Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import { ToastContainer, toast, Flip } from "react-toastify";
import moment from "moment";
import _ from "lodash";

import "chart.piecelabel.js";
import "react-toastify/dist/ReactToastify.min.css";

import {
  testQuery, createChart, runQuery, updateChart, getPreviewData
} from "../actions/chart";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import ChartTypesSelector from "../components/ChartTypesSelector";
import ObjectExplorer from "../components/ObjectExplorer";
import ChartBuilder from "../components/ChartBuilder";
import TimeseriesGlobalSettings from "../components/TimeseriesGlobalSettings";
import MongoQueryBuilder from "../components/MongoQueryBuilder";
import ApiBuilder from "../components/ApiBuilder";
import PostgresQueryBuilder from "../components/PostgresQueryBuilder";
import MysqlQueryBuilder from "../components/MysqlQueryBuilder";

/*
  Container used for setting up a new chart
*/
class AddChart extends Component {
  constructor(props) {
    super(props);

    this.state = {
      step: 0,
      newChart: {
        name: "Untitled",
        query: "connection.collection('users').find()",
        displayLegend: false,
        connection_id: null,
        Datasets: [{
          xAxis: "root",
          legend: "Dataset #1",
        }],
        offset: "offset",
        draft: true,
        includeZeros: true,
        timeInterval: "day",
      },
      ddConnections: [],
      updatedEdit: false, // eslint-disable-line
      viewDatasetOptions: false,
      activeDataset: 0,
      timeToSave: true,
      autosave: true,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
    this._populateConnections();
  }

  componentDidUpdate(prevProps, prevState) {
    const { newChart, timeToSave, autosave } = this.state;

    if (prevProps.charts) {
      if (prevProps.match.params.chartId && prevProps.charts.length > 0 && !prevState.updatedEdit) {
        this._prepopulateState();
      }
    }

    if (prevProps.connections.length > 0 && prevState.ddConnections.length === 0) {
      this._populateConnections();
    }

    // update the draft if it's already created and only if it's a draft
    if (!_.isEqual(prevState.newChart, newChart) && timeToSave && newChart.id && autosave) {
      this._updateDraft();
    }
  }

  _prepopulateState = () => {
    const { connections, charts, match } = this.props;
    charts.forEach((chart) => {
      if (chart.id === parseInt(match.params.chartId, 10)) {
        const foundChart = chart;
        // objectify the date range if it exists
        if (chart.startDate) {
          foundChart.startDate = moment(chart.startDate);
        }
        if (chart.endDate) {
          foundChart.endDate = moment(chart.endDate);
        }

        // check if the chart has a connection and populate that one as well
        let selectedConnection = null;
        if (foundChart.connection_id) {
          for (let i = 0; i < connections.length; i++) {
            if (connections[i].id === foundChart.connection_id) {
              selectedConnection = connections[i];
              break;
            }
          }
        }

        this.setState({
          newChart: foundChart,
          updatedEdit: true,
          selectedConnection,
          autosave: foundChart.draft,
        }, () => {
          this._onPreview();
        });
      }
    });
  }

  _populateConnections = () => {
    const { connections } = this.props;
    const { ddConnections } = this.state;

    if (connections.length < 1) return;
    if (ddConnections.length > 0) return;

    const tempState = ddConnections;
    connections.map((connection) => {
      return tempState.push({
        key: connection.id,
        value: connection.id,
        text: connection.name,
      });
    });

    this.setState({ ddConnections: tempState });
  }

  _onChangeStep = (step) => {
    const { createChart, match } = this.props;
    const { newChart } = this.state;
    this.setState({ step });

    if (!newChart.id && step > 0) {
      createChart(match.params.projectId, newChart)
        .then((chart) => {
          if (chart && chart.id) {
            this.setState({
              newChart: {
                ...newChart, id: chart.id, Datasets: chart.Datasets,
              }
            });
          }
        });
    }
  }

  _onChangeConnection = (value) => {
    const { connections } = this.props;
    const { newChart } = this.state;
    let { query } = newChart;

    let selectedConnection;
    for (let i = 0; i < connections.length; i++) {
      if (connections[i].id === value) {
        selectedConnection = connections[i];
      }
    }

    if (!newChart.id) {
      if (selectedConnection.type === "mongodb") {
        query = "connection.collection('users').find()";
      } else if (selectedConnection.type === "postgres") {
        query = "SELECT * FROM table1;";
      }
    }

    this.setState({
      newChart: { ...newChart, connection_id: value, query },
      selectedConnection,
      noSource: true,
    });
  }

  _onChangeType = ({ type, subType }) => {
    const { newChart } = this.state;
    this.setState({ newChart: { ...newChart, type, subType: subType || "" } });
  }

  _onChangeAxis = ({ xAxis, yAxis }) => {
    const { activeDataset, newChart } = this.state;
    const tempChart = { ...newChart };

    if (xAxis) {
      tempChart.Datasets[activeDataset].xAxis = xAxis;
    }
    if (yAxis) {
      tempChart.yAxis = yAxis;
    }

    this.setState({ newChart: tempChart });
  }

  _onChangeChart = ({
    datasetColor, fillColor, fill, xAxis, patterns, legend,
  }) => {
    const { activeDataset, newChart, previewChart } = this.state;
    const tempChart = newChart;
    const realTimeData = previewChart;

    if (datasetColor) {
      tempChart.Datasets[activeDataset].datasetColor = datasetColor;
      if (previewChart) {
        if (realTimeData.data.datasets[activeDataset]) {
          realTimeData.data.datasets[activeDataset].borderColor = datasetColor;
        }
      }
    }

    if (fillColor) {
      tempChart.Datasets[activeDataset].fillColor = fillColor;

      if (previewChart && realTimeData.data.datasets[activeDataset]) {
        realTimeData.data.datasets[activeDataset].backgroundColor = fillColor;
      }
    }

    if (fill || fill === false) {
      tempChart.Datasets[activeDataset].fill = fill;
      if (previewChart && realTimeData.data.datasets[activeDataset]) {
        realTimeData.data.datasets[activeDataset].fill = fill;
      }
    }

    if (xAxis) {
      tempChart.Datasets[activeDataset].xAxis = xAxis;
    }

    if (patterns) {
      tempChart.Datasets[activeDataset].patterns = JSON.parse(JSON.stringify(patterns));
    }

    if (legend) {
      tempChart.Datasets[activeDataset].legend = legend;

      if (previewChart) {
        if (realTimeData.data.datasets[activeDataset]) {
          if (legend) {
            realTimeData.data.datasets[activeDataset].label = legend;
          } else {
            realTimeData.data.datasets[activeDataset].label = "";
          }
        }
      }
    }

    if (previewChart) {
      this.setState({
        newChart: tempChart,
        previewChart: realTimeData,
      });
    } else {
      this.setState({
        newChart: tempChart,
      });
    }
  }

  _onChangeGlobalSettings = ({
    pointRadius, displayLegend, dateRange, includeZeros, timeInterval, currentEndDate,
  }) => {
    const { newChart, previewChart } = this.state;

    let realTimeData;
    if (previewChart) {
      realTimeData = { ...previewChart };
      // point
      realTimeData.options.elements.point.radius = pointRadius;
      realTimeData.data.datasets[0].pointRadius = pointRadius;
      // legend
      realTimeData.options.legend.display = displayLegend;
    }

    this.setState({
      previewChart: realTimeData || previewChart,
      newChart: {
        ...newChart,
        pointRadius: typeof pointRadius !== "undefined" ? pointRadius : newChart.pointRadius,
        displayLegend: typeof displayLegend !== "undefined" ? displayLegend : newChart.displayLegend,
        startDate: (dateRange && dateRange.startDate) || newChart.startDate,
        endDate: (dateRange && dateRange.endDate) || newChart.endDate,
        timeInterval: timeInterval || newChart.timeInterval,
        includeZeros: typeof includeZeros !== "undefined" ? includeZeros : newChart.includeZeros,
        currentEndDate: typeof currentEndDate !== "undefined" ? currentEndDate : newChart.currentEndDate,
      },
    }, () => {
      if (includeZeros || includeZeros === false
        || currentEndDate || currentEndDate === false
        || timeInterval
      ) {
        this._onPreview();
      }
    });
  }

  /* API Stuff */
  _formatApiRequest = () => {
    const { apiRequest } = this.state;
    if (!apiRequest) return {};

    const { formattedHeaders } = apiRequest;

    let newHeaders = {};
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].key && formattedHeaders[i].value) {
        newHeaders = { [formattedHeaders[i].key]: formattedHeaders[i].value, ...newHeaders };
      }
    }

    const newRequest = apiRequest;
    newRequest.headers = newHeaders;

    this.setState({ noSource: false });

    return newRequest;
  }

  _onPaginationChanged = (type, value) => {
    const { newChart } = this.state;

    let newValue = value;
    if (type === "itemsLimit" && value && value !== "0") {
      newValue = Math.abs(parseInt(value, 10));
    }

    this.setState({
      newChart: {
        ...newChart, [type]: newValue,
      },
    });
  }

  /* End of API Stuff */

  _onPreview = (e, refresh) => {
    const { getPreviewData, match } = this.props;
    const { newChart, selectedConnection, noSource } = this.state;
    const previewData = newChart;

    let tempNoSource = noSource;
    if (refresh === true) {
      tempNoSource = false;
    }

    if (selectedConnection && selectedConnection.type === "api") {
      previewData.apiRequest = this._formatApiRequest();
    }

    this.setState({ previewLoading: true, previewError: false });
    getPreviewData(match.params.projectId, previewData, tempNoSource)
      .then((chartData) => {
        this.setState({ previewChart: chartData, previewLoading: false, noSource: true });
      })
      .catch(() => {
        this.setState({ previewLoading: false, previewError: true });
      });
  }

  _testQuery = () => {
    const { testQuery, match } = this.props;
    const { newChart } = this.state;
    this.setState({
      testError: false, testingQuery: true, testSuccess: false, testFailed: false,
    });
    return testQuery(match.params.projectId, newChart)
      .then((data) => {
        this.setState({
          testingQuery: false,
          testSuccess: true,
          queryData: data,
        });
      })
      .catch((error) => {
        if (error === 413) {
          this.setState({ testingQuery: false, testError: true });
        } else {
          this.setState({ testingQuery: false, testFailed: true, testError: true });
        }
      });
  }

  _apiTest = (data) => {
    this.setState({ testSuccess: true, queryData: data });
  }

  _validate = () => {
    const { newChart } = this.state;
    // Line chart with timeseries
    if ((newChart.type === "line" || newChart.type === "bar")
      && (newChart.subType === "lcTimeseries" || newChart.subType === "lcAddTimeseries"
      || newChart.subType === "bcTimeseries" || newChart.subType === "bcAddTimeseries")) {
      // check if the xAxis is properly formatted (the date is inside an array)
      if (newChart.xAxis.indexOf("[]") === -1 || (newChart.xAxis.match(/[]/g) || []).length > 1) { // eslint-disable-line
        this.setState({ lcArrayError: true });
        return false;
      }
    }

    return true;
  }

  _onAddNewDataset = () => {
    const { newChart } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets.push({
      xAxis: "root",
      legend: `Dataset #${tempChart.Datasets.length + 1}`,
    });

    this.setState({
      newChart: tempChart,
      activeDataset: tempChart.Datasets.length - 1,
      viewDatasetOptions: true
    });
  }

  _onRemoveDataset = (remove) => {
    const { newChart, activeDataset } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets[activeDataset].deleted = remove;
    this.setState({ newChart: tempChart });
    this._onPreview();
  }

  _onUpdateConfirmation = () => {
    const { newChart } = this.state;
    let showModal = false;
    for (const dataset of newChart.Datasets) { // eslint-disable-line
      if (dataset.deleted) {
        showModal = true;
        break;
      }
    }

    if (showModal) {
      this.setState({ removeModal: true });
    } else {
      this._onCreateChart();
    }
  }

  _updateDraft = () => {
    this.setState({ timeToSave: false });
    this._onCreateChart();

    setTimeout(() => {
      this.setState({ timeToSave: true });
    }, 10000);
  }

  _onSetAutosave = () => {
    const { autosave } = this.state;
    this.setState({ autosave: !autosave });
  }

  _onCreateChart = (create) => {
    const {
      createChart, match, runQuery, history, updateChart
    } = this.props;
    const { newChart, selectedConnection } = this.state;
    const updatedChart = newChart;

    if (selectedConnection && selectedConnection.type === "api") {
      updatedChart.apiRequest = this._formatApiRequest();
    }

    this.setState({ createLoading: true, removeModal: false });

    if (!newChart.id) {
      createChart(match.params.projectId, updatedChart)
        .then((chart) => {
          return runQuery(match.params.projectId, chart.id);
        })
        .then(() => {
          this.setState({ createLoading: false });
          history.push(`/${match.params.teamId}/${match.params.projectId}/dashboard`);
        })
        .catch(() => {
          this.setState({ createLoading: false, createError: true });
        });
    } else {
      if (create) updatedChart.draft = false;

      updateChart(
        match.params.projectId,
        newChart.id,
        updatedChart
      )
        .then((chart) => {
          this.setState({ createLoading: false });
          toast.success("Chart updated 👌", {
            position: "bottom-right",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            transition: Flip,
          });
          runQuery(match.params.projectId, chart.id);

          if (create) {
            history.push(`/${match.params.teamId}/${match.params.projectId}/dashboard`);
          }

          this.setState({
            newChart: {
              ...newChart, Datasets: chart.Datasets,
            },
          });

          return Promise.resolve(true);
        })
        .catch(() => {
          this.setState({ createLoading: false, createError: true });
        });
    }
  }

  render() {
    const {
      activeDataset, newChart, previewChart, selectedConnection, testSuccess,
      viewDatasetOptions, queryData, step, ddConnections,
      testError, testFailed, testingQuery, apiRequest, previewLoading,
      previewError, lcArrayError, createError, autosave,
      removeModal, createLoading, removeLoading,
    } = this.state;
    const { connections, match } = this.props;

    return (
      <div style={styles.container}>
        <Sidebar.Pushable as={Segment}>
          <Sidebar
            as={Segment}
            color="teal"
            animation="overlay"
            visible={viewDatasetOptions}
            width="very wide"
            direction="right"
            style={{ width: "50%" }}
          >
            <Container textAlign="center">
              <Button.Group widths="3">
                <Button
                  icon
                  labelPosition="left"
                  onClick={this._onPreview}
                >
                  <Icon name="refresh" />
                  Preview
                </Button>
                <Button
                  secondary
                  onClick={() => {
                    this.setState({ viewDatasetOptions: false });
                    this._onPreview();
                  }}
                >
                  Done
                </Button>
                {!newChart.Datasets[activeDataset].deleted
                  && (
                  <Button
                    basic
                    negative
                    icon
                    labelPosition="right"
                    onClick={() => this._onRemoveDataset(true)}
                  >
                    <Icon name="x" />
                    Remove
                  </Button>
                  )}
                {newChart.Datasets[activeDataset].deleted
                  && (
                  <Button
                    basic
                    icon
                    labelPosition="right"
                    onClick={() => this._onRemoveDataset(false)}
                  >
                    <Icon name="plus" />
                    Re-enable
                  </Button>
                  )}
              </Button.Group>
            </Container>
            <Divider />
            <Container text>
              <Popup
                trigger={(
                  <Button icon labelPosition="left">
                    <Icon name="info" />
                    How to select fields
                  </Button>
                )}
              >
                <Container text>
                  <Header>Selecting fields</Header>
                  <p>{"You can use the object visualizer below. Just click on it to expand your data tree."}</p>
                  <p>{"You can manually select a field just as you would access an attribute within an object in Javascript:"}</p>
                  <pre>root.someOtherObject.value</pre>
                  <p>{"Array fields are identified by appending '[]' at the end like so"}</p>
                  <pre>root.someArrayField[].value</pre>
                </Container>
              </Popup>
            </Container>
            <br />
            {queryData
              && (
              <ObjectExplorer
                objectData={queryData}
                type={newChart.type}
                subType={newChart.subType}
                onChange={this._onChangeAxis}
                xAxisField={newChart.Datasets[activeDataset].xAxis}
              />
              )}
            <br />
            {activeDataset !== false
              && (
              <ChartBuilder
                type={newChart.type}
                subType={newChart.subType}
                editChart={!!newChart.id}
                xAxis={newChart.Datasets[activeDataset].xAxis || ""}
                datasetColor={newChart.Datasets[activeDataset].datasetColor}
                fillColor={newChart.Datasets[activeDataset].fillColor}
                fill={newChart.Datasets[activeDataset].fill}
                legend={newChart.Datasets[activeDataset].legend}
                patterns={newChart.Datasets[activeDataset].patterns}
                dataArray={previewChart && previewChart.data.datasets[activeDataset]
                  ? previewChart.data.datasets[activeDataset].data
                  : newChart.chartData && newChart.chartData.data.datasets[activeDataset]
                    ? newChart.chartData.data.datasets[activeDataset].data : []}
                dataLabels={previewChart
                  ? previewChart.data.labels : newChart.chartData
                    ? newChart.chartData.data.labels : []}
                onChange={this._onChangeChart}
              />
              )}
          </Sidebar>
          <Sidebar.Pusher>
            <Container
              fluid
              style={{
                paddingLeft: 20,
                paddingRight: viewDatasetOptions ? 0 : 10,
              }}
              onClick={() => {
                if (viewDatasetOptions) {
                  this.setState({ viewDatasetOptions: false });
                }
              }}
            >
              <Segment attached style={styles.mainSegment}>
                <Step.Group fluid widths={4}>
                  <Step
                    active={step === 0}
                    onClick={() => this._onChangeStep(0)}
                  >
                    <Icon name="th large" />
                    <Step.Content>
                      <Step.Title>Chart type</Step.Title>
                      <Step.Description>Choose your chart type</Step.Description>
                    </Step.Content>
                  </Step>

                  <Step
                    active={step === 1}
                    disabled={!newChart.subType}
                    onClick={() => this._onChangeStep(1)}
                  >
                    <Icon name="plug" />
                    <Step.Content>
                      <Step.Title>Connect</Step.Title>
                      <Step.Description>Your database connection</Step.Description>
                    </Step.Content>
                  </Step>

                  <Step
                    active={step === 2}
                    disabled={
                      !newChart.connection_id
                      || !newChart.name
                      || !newChart.subType
                    }
                    onClick={() => this._onChangeStep(2)}
                  >
                    <Icon name="database" />
                    <Step.Content>
                      <Step.Title>Query</Step.Title>
                      <Step.Description>Get some data</Step.Description>
                    </Step.Content>
                  </Step>

                  <Step
                    active={step === 3}
                    disabled={
                      !newChart.connection_id
                      || !newChart.name
                      || !testSuccess
                      || !newChart.subType
                    }
                    onClick={() => this._onChangeStep(3)}
                  >
                    <Icon name="chart area" />
                    <Step.Content>
                      <Step.Title>Build</Step.Title>
                      <Step.Description>Build your chart</Step.Description>
                    </Step.Content>
                  </Step>
                </Step.Group>

                {step === 0
                  && (
                  <ChartTypesSelector
                    type={newChart.type}
                    subType={newChart.subType}
                    onChange={this._onChangeType}
                  />
                  )}

                {step === 1
                  && (
                  <Form>
                    <Form.Field>
                      <label>What will your chart show?</label>
                      <Input
                        placeholder="Give your chart a short description"
                        value={newChart.name || ""}
                        onChange={(e, data) => {
                          this.setState({ newChart: { ...newChart, name: data.value } });
                        }}
                      />
                    </Form.Field>

                    <Form.Field>
                      <label>Select a connection</label>
                      <Dropdown
                        placeholder="Select an available connection from the list"
                        selection
                        value={newChart.connection_id}
                        options={ddConnections}
                        disabled={connections.length < 1}
                        onChange={(e, data) => this._onChangeConnection(data.value)}
                      />
                    </Form.Field>
                    {connections.length < 1
                      && (
                      <Form.Field>
                        <Link to={`/${match.params.teamId}/${match.params.projectId}/connections`}>
                          <Button primary icon labelPosition="right">
                            <Icon name="plug" />
                              Go to connections
                          </Button>
                        </Link>
                      </Form.Field>
                      )}
                  </Form>
                  )}

                {step === 2 && selectedConnection.type === "mongodb"
                  && (
                  <MongoQueryBuilder
                    currentQuery={newChart.query}
                    onChangeQuery={(value) => {
                      this.setState({ newChart: { ...newChart, query: value } });
                    }}
                    testQuery={this._testQuery}
                    testSuccess={testSuccess}
                    testError={testError}
                    testFailed={testFailed}
                    testingQuery={testingQuery}
                  />
                  )}

                {step === 2 && selectedConnection.type === "api"
                  && (
                  <ApiBuilder
                    connection={selectedConnection}
                    onComplete={(data) => this._apiTest(data)}
                    apiRequest={apiRequest || ""}
                    onChangeRequest={(apiRequest) => {
                      this.setState({ apiRequest });
                    }}
                    chartId={newChart.id}
                    itemsLimit={newChart.itemsLimit}
                    items={newChart.items}
                    offset={newChart.offset}
                    pagination={newChart.pagination}
                    onPaginationChanged={this._onPaginationChanged}
                  />
                  )}

                {step === 2 && selectedConnection.type === "postgres"
                  && (
                  <PostgresQueryBuilder
                    currentQuery={newChart.query}
                    onChangeQuery={(value) => {
                      this.setState({ newChart: { ...newChart, query: value } });
                    }}
                    testQuery={this._testQuery}
                    testSuccess={testSuccess}
                    testError={testError}
                    testFailed={testFailed}
                    testingQuery={testingQuery}
                  />
                  )}

                {step === 2 && selectedConnection.type === "mysql"
                  && (
                  <MysqlQueryBuilder
                    currentQuery={newChart.query}
                    onChangeQuery={(value) => {
                      this.setState({ newChart: { ...newChart, query: value } });
                    }}
                    testQuery={this._testQuery}
                    testSuccess={testSuccess}
                    testError={testError}
                    testFailed={testFailed}
                    testingQuery={testingQuery}
                  />
                  )}

                {step === 3
                  && (
                  <Grid columns={2} centered divided>
                    <Grid.Column width={8}>
                      <Dimmer inverted active={previewLoading}>
                        <Loader inverted />
                      </Dimmer>
                      <Container textAlign="center">
                        <Header textAlign="left" as="h3" dividing>
                          Build your chart
                        </Header>
                        <Button.Group widths={10}>
                          <Button
                            icon
                            labelPosition="left"
                            onClick={this._onPreview}
                            style={{ marginBottom: 20 }}
                          >
                            <Icon name="refresh" />
                            Refresh preview
                          </Button>

                          <Button
                            icon
                            labelPosition="right"
                            onClick={() => this._onPreview(null, true)}
                            style={{ marginBottom: 20 }}
                            basic
                          >
                            <Icon name="angle double down" />
                            Get latest data
                          </Button>
                        </Button.Group>
                      </Container>
                      {previewChart
                        && (
                        <div style={{ maxHeight: "30em" }}>
                          {newChart.type === "line"
                            && (
                            <Line
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "bar"
                            && (
                            <Bar
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "pie"
                            && (
                            <Pie
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "doughnut"
                            && (
                            <Doughnut
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "radar"
                            && (
                            <Radar
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "polar"
                            && (
                            <Polar
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                        </div>
                        )}
                      {!previewChart
                        && <p>{"No data to preview. Configure your datasets and press the refresh button."}</p>}
                      {previewError
                        && (
                        <div>
                          <br />
                          <Message
                            negative
                            onDismiss={() => this.setState({ previewError: false })}
                          >
                            <Message.Header>
                              {"Oh snap! We could't render the chart for you"}
                            </Message.Header>
                            <p>{"Make sure your configuration, like the query and selected fields are valid."}</p>
                          </Message>
                        </div>
                        )}
                    </Grid.Column>
                    <Grid.Column width={8}>
                      <Header as="h3" dividing>
                        Configure your datasets
                      </Header>

                      <Header size="small">Datasets</Header>
                      {newChart.Datasets.map((dataset, index) => {
                        if (dataset.deleted) {
                          return (
                            <Button
                              key={dataset.legend}
                              basic
                              primary
                              icon
                              labelPosition="right"
                              onClick={() => {
                                this.setState({ viewDatasetOptions: true, activeDataset: index });
                              }}
                            >
                              <Icon name="x" />
                              {dataset.legend || "Dataset"}
                            </Button>
                          );
                        }
                        return (
                          <Button
                            key={dataset.legend}
                            primary
                            icon
                            labelPosition="right"
                            onClick={() => {
                              this.setState({ viewDatasetOptions: true, activeDataset: index });
                            }}
                          >
                            <Icon name="options" />
                            {dataset.legend || "Dataset"}
                          </Button>
                        );
                      })}
                      <br />

                      {newChart.type !== "polar"
                        && (
                        <List animated verticalAlign="middle">
                          <List.Item as="a" onClick={this._onAddNewDataset}>
                            <Icon name="plus" />
                            <List.Content>
                              <List.Header>
                                Add a new dataset
                              </List.Header>
                            </List.Content>
                          </List.Item>
                        </List>
                        )}
                      <Divider />

                      <Header size="small">
                        Global settings
                      </Header>
                      <TimeseriesGlobalSettings
                        type={newChart.type}
                        subType={newChart.subType}
                        pointRadius={newChart.pointRadius}
                        startDate={newChart.startDate}
                        endDate={newChart.endDate}
                        displayLegend={newChart.displayLegend}
                        includeZeros={newChart.includeZeros}
                        currentEndDate={newChart.currentEndDate}
                        timeInterval={newChart.timeInterval}
                        onChange={this._onChangeGlobalSettings}
                        onComplete={() => this._onPreview()}
                      />
                    </Grid.Column>
                  </Grid>
                  )}
                {createError
                  && (
                  <Message
                    negative
                    onDismiss={() => this.setState({ createError: false })}
                    header="There was a problem with your request"
                    content="This is on us, we couldn't process your request. Please try again."
                  />
                  )}
                {lcArrayError
                  && (
                  <Message
                    negative
                    onDismiss={() => this.setState({ lcArrayError: false })}
                    header="The data you selected is not correct"
                    content="In order to create a valid time series chart, you must select a date field that is within an array. Make sure there is only one array in your selector '[]'."
                  />
                  )}
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
                />
              </Segment>
              <Button.Group attached="bottom">
                <Button
                  secondary
                  icon
                  labelPosition="left"
                  disabled={step === 0}
                  onClick={() => this._onChangeStep(step - 1)}
                >
                  <Icon name="chevron left" />
                  Back
                </Button>

                {newChart.id && (
                  <Button
                    color={autosave ? "teal" : "gray"}
                    onClick={this._onSetAutosave}
                    icon
                    labelPosition="left"
                  >
                    <Icon name={autosave ? "toggle on" : "toggle off"} />
                    Autosave
                    { autosave ? " on" : " off" }
                  </Button>
                )}

                {newChart.id
                  && (
                  <Button
                    primary
                    loading={createLoading}
                    onClick={this._onUpdateConfirmation}
                    icon
                    labelPosition="right"
                  >
                    <Icon name="edit" />
                    Update the chart
                  </Button>
                  )}

                {step < 3
                  && (
                  <Button
                    secondary
                    icon
                    labelPosition="right"
                    onClick={() => {
                      if (step === 2 && !testSuccess && selectedConnection.type !== "api") {
                        this._testQuery();
                      } else {
                        this._onChangeStep(step + 1);
                      }
                    }}
                    loading={testingQuery}
                    disabled={
                      (step === 0 && !newChart.subType)
                      || (step === 1 && (!newChart.connection_id || !newChart.name))
                    }
                  >
                    <Icon name="chevron right" />
                    {(step === 2 && !testSuccess && selectedConnection.type !== "api")
                      ? "Run test" : "Next"}
                  </Button>
                  )}
                {step > 2 && newChart.draft
                  && (
                  <Button
                    secondary
                    icon
                    labelPosition="right"
                    disabled={!testSuccess}
                    loading={createLoading}
                    onClick={() => this._onCreateChart(true)}
                  >
                    <Icon name="checkmark" />
                    Create the chart
                  </Button>
                  )}
              </Button.Group>
            </Container>
          </Sidebar.Pusher>
        </Sidebar.Pushable>

        <Modal
          open={removeModal}
          basic
          size="small"
          onClose={() => this.setState({ removeModal: false })}
        >
          <Header
            icon="exclamation triangle"
            content="All the datasets that were market as deleted will be forever removed upon updating"
          />
          <Modal.Content>
            <p>
              {"You can always re-enable datasets while editing the chart, but once you save the changes all the datasets marked as deleted will be gone forever."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => this.setState({ removeModal: false })}
            >
              Go back
            </Button>
            <Button
              color="teal"
              inverted
              loading={!!removeLoading}
              onClick={() => this._onCreateChart()}
            >
              <Icon name="checkmark" />
              Update & Remove datasets
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
  mainContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  mainSegment: {
    minHeight: 600,
  },
};

AddChart.propTypes = {
  connections: PropTypes.array.isRequired,
  testQuery: PropTypes.func.isRequired,
  createChart: PropTypes.func.isRequired,
  updateChart: PropTypes.func.isRequired,
  runQuery: PropTypes.func.isRequired,
  getPreviewData: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    charts: state.chart.data,
    team: state.team.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    testQuery: (projectId, data) => dispatch(testQuery(projectId, data)),
    createChart: (projectId, data) => dispatch(createChart(projectId, data)),
    runQuery: (projectId, chartId) => dispatch(runQuery(projectId, chartId)),
    updateChart: (projectId, chartId, data) => dispatch(updateChart(projectId, chartId, data)),
    getPreviewData: (projectId, chart, noSource) => {
      return dispatch(getPreviewData(projectId, chart, noSource));
    },
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AddChart));
